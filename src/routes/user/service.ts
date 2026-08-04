import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { User, Account } from "@/plugins/db/models/auth.model";
import { Batch } from "@/plugins/db/models/academics.model";
import { auth } from "@/plugins/auth";
import { authClient } from "@/plugins/auth";
import {
  bulkCreateWorkspaceUsers,
  buildPrimaryEmail,
  generatePassword,
  getEmailDomain,
  hasRequiredEmailDomain,
  type WorkspaceUserInput,
} from "@/lib/google-workspace";
import { hashPassword } from "better-auth/crypto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toIsoString = (value: unknown): string | undefined => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
};

/**
 * Builds a clean user payload for API responses.
 * The profile sub-object is passed through as-is.
 */
const buildUserPayload = (user: any) => ({
  _id: String(user._id),
  email: user.email,
  role: user.role,
  first_name: user.first_name,
  last_name: user.last_name,
  name: user.name,
  ...(user.phone != null ? { phone: user.phone } : {}),
  ...(user.gender != null ? { gender: user.gender } : {}),
  ...(user.image != null ? { image: user.image } : {}),
  ...(user.emailVerified != null ? { emailVerified: user.emailVerified } : {}),
  ...(toIsoString(user.createdAt) ? { createdAt: toIsoString(user.createdAt) } : {}),
  ...(toIsoString(user.updatedAt) ? { updatedAt: toIsoString(user.updatedAt) } : {}),
  banned: Boolean(user.banned),
  ...(user.banReason != null ? { banReason: user.banReason } : {}),
  ...(toIsoString(user.banExpires) ? { banExpires: toIsoString(user.banExpires) } : {}),
  profile: user.profile ?? {},
});

/** Roles that use the staff profile shape */
const STAFF_ROLES = ["teacher", "principal", "hod", "admin", "staff"] as const;
const isStaffRole = (role: string) => (STAFF_ROLES as readonly string[]).includes(role);

const ADMISSION_DUPLICATE_STATUS_CODE = 4221;
const CANDIDATE_DUPLICATE_STATUS_CODE = 4222;
const BOTH_DUPLICATE_STATUS_CODE = 4223;

class StudentUniqueFieldError extends Error {
  statusCode: number;
  field: "adm_number" | "candidate_code" | "both";

  constructor(field: "adm_number" | "candidate_code" | "both", message: string) {
    super(message);
    this.name = "StudentUniqueFieldError";
    this.field = field;
    if (field === "adm_number") {
      this.statusCode = ADMISSION_DUPLICATE_STATUS_CODE;
    } else if (field === "candidate_code") {
      this.statusCode = CANDIDATE_DUPLICATE_STATUS_CODE;
    } else {
      this.statusCode = BOTH_DUPLICATE_STATUS_CODE;
    }
  }
}

/** Title-cases a name: capitalizes the first letter of each word, and after hyphens/apostrophes. */
const toTitleCase = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_match, sep, char) => sep + char.toUpperCase());

const normalizeStudentCode = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : undefined;
};

const isDuplicateKeyError = (error: unknown): boolean => {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
};

const getDuplicateFieldFromMongoError = (
  error: unknown
): "adm_number" | "candidate_code" | undefined => {
  if (!isDuplicateKeyError(error)) return undefined;

  const keyPattern = (error as { keyPattern?: Record<string, number> }).keyPattern ?? {};
  const keys = Object.keys(keyPattern);
  if (keys.some((k) => k.includes("profile.adm_number"))) return "adm_number";
  if (keys.some((k) => k.includes("profile.candidate_code"))) return "candidate_code";

  const keyValue = (error as { keyValue?: Record<string, unknown> }).keyValue ?? {};
  const keyValueKeys = Object.keys(keyValue);
  if (keyValueKeys.some((k) => k.includes("profile.adm_number"))) return "adm_number";
  if (keyValueKeys.some((k) => k.includes("profile.candidate_code"))) return "candidate_code";

  return undefined;
};

const assertStudentUniqueFields = async (
  profile: Record<string, unknown>,
  excludeUserId?: string
): Promise<{ admNumber?: string; candidateCode?: string }> => {
  const admNumber = normalizeStudentCode(profile.adm_number);
  const candidateCode = normalizeStudentCode(profile.candidate_code);

  if (!admNumber && !candidateCode) {
    return { admNumber, candidateCode };
  }

  const orClauses: Record<string, unknown>[] = [];
  if (admNumber) orClauses.push({ "profile.adm_number": admNumber });
  if (candidateCode) orClauses.push({ "profile.candidate_code": candidateCode });

  const filter: Record<string, unknown> = {
    role: "student",
    $or: orClauses,
  };

  if (excludeUserId) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeUserId) };
  }

  const existingStudents = await User.find(filter)
    .select("profile.adm_number profile.candidate_code")
    .lean();

  if (existingStudents.length > 0) {
    const hasAdmDuplicate = Boolean(
      admNumber &&
      existingStudents.some((student: any) => normalizeStudentCode(student?.profile?.adm_number) === admNumber)
    );
    const hasCandidateDuplicate = Boolean(
      candidateCode &&
      existingStudents.some((student: any) => normalizeStudentCode(student?.profile?.candidate_code) === candidateCode)
    );

    if (hasAdmDuplicate && hasCandidateDuplicate) {
      throw new StudentUniqueFieldError(
        "both",
        "Admission number and candidate code already exist for another student"
      );
    }
    if (hasAdmDuplicate) {
      throw new StudentUniqueFieldError("adm_number", "Admission number already exists for another student");
    }
    if (hasCandidateDuplicate) {
      throw new StudentUniqueFieldError("candidate_code", "Candidate code already exists for another student");
    }
  }

  return { admNumber, candidateCode };
};

const buildDuplicateStudentFieldResponse = async (
  profile: Record<string, unknown>,
  excludeUserId?: string
): Promise<{ status_code: number; message: string; data: string }> => {
  try {
    await assertStudentUniqueFields(profile, excludeUserId);
  } catch (validationError) {
    if (validationError instanceof StudentUniqueFieldError) {
      return {
        status_code: validationError.statusCode,
        message: validationError.message,
        data: "",
      };
    }
  }

  return {
    status_code: ADMISSION_DUPLICATE_STATUS_CODE,
    message: "Admission number already exists",
    data: "",
  };
};

const resolveDuplicateStudentResponseFromError = async (
  error: unknown,
  profile: Record<string, unknown>,
  excludeUserId?: string
): Promise<{ status_code: number; message: string; data: string }> => {
  const duplicateResponse = await buildDuplicateStudentFieldResponse(profile, excludeUserId);

  // If no detailed duplicate found, use index hint from Mongo duplicate error.
  if (
    duplicateResponse.status_code === ADMISSION_DUPLICATE_STATUS_CODE &&
    duplicateResponse.message === "Admission number already exists"
  ) {
    const duplicateField = getDuplicateFieldFromMongoError(error);
    if (duplicateField === "candidate_code") {
      return {
        status_code: CANDIDATE_DUPLICATE_STATUS_CODE,
        message: "Candidate code already exists",
        data: "",
      };
    }
  }

  return duplicateResponse;
};

// ─── GET /user  or  GET /user/:id ─────────────────────────────────────────────

export const getUser = async (
  request: FastifyRequest<{ Params: { id?: string } }>,
  reply: FastifyReply
) => {
  try {
    const userId = request.params.id || request.user.id;

    const user = await User.findById(userId)
      .populate({ path: "profile.batch", model: "Batch", select: "name id adm_year department" })
      .populate({ path: "profile.child", model: "User", select: "first_name last_name email role profile" })
      .lean();

    if (!user) {
      return reply.status(404).send({
        status_code: 404,
        message: "User not found",
        data: "",
      });
    }

    const role = user.role;

    // ── Check profile completeness and return 422 for the onboarding flow ───
    if (role === "student") {
      const p = (user.profile ?? {}) as any;
      if (!p.adm_number || !p.adm_year || !p.candidate_code || !p.department || !p.date_of_birth) {
        return reply.status(422).send({
          status_code: 422,
          message: "Student data needs to be added.",
          data: buildUserPayload(user),
        });
      }
    } else if (isStaffRole(role)) {
      const p = (user.profile ?? {}) as any;
      if (!p.designation || !p.department || !p.date_of_joining) {
        return reply.status(422).send({
          status_code: 422,
          message: "Staff data needs to be added.",
          data: buildUserPayload(user),
        });
      }
    } else if (role === "parent") {
      const p = (user.profile ?? {}) as any;
      if (!p.child || !p.relation) {
        return reply.status(422).send({
          status_code: 422,
          message: "Parent data needs to be added.",
          data: buildUserPayload(user),
        });
      }
    }

    return reply.send({
      status_code: 200,
      message: "User profile fetched successfully",
      data: buildUserPayload(user),
    });
  } catch (e) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch user profile",
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
};

// ─── POST /user  (onboarding — completes own profile) ────────────────────────

export const createUser = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  let duplicateCheckProfile: Record<string, unknown> | undefined;
  let duplicateExcludeUserId: string | undefined;
  try {
    const { image, phone, first_name, last_name, gender, profile } = request.body as {
      image?: string;
      phone: number;
      first_name: string;
      last_name: string;
      gender: string;
      profile?: Record<string, unknown>;
    };

    const userId = request.user.id;
    duplicateExcludeUserId = userId;

    const first_name_cased = toTitleCase(first_name);
    const last_name_cased = toTitleCase(last_name);

    // Derive name from first_name + last_name
    const name = `${first_name_cased} ${last_name_cased}`;

    const existingUser = await User.findById(userId).select("role").lean();
    if (!existingUser) {
      return reply.status(404).send({
        status_code: 404,
        message: "User not found",
        data: "",
      });
    }

    if (profile && typeof profile.batch === "string") {
      profile.batch = new mongoose.Types.ObjectId(profile.batch as string);
    }
    if (profile) {
      duplicateCheckProfile = profile;
    }

    if (existingUser.role === "student" && profile) {
      try {
        const { admNumber, candidateCode } = await assertStudentUniqueFields(profile, userId);
        if (admNumber) profile.adm_number = admNumber;
        if (candidateCode) profile.candidate_code = candidateCode;
      } catch (validationError) {
        if (validationError instanceof StudentUniqueFieldError) {
          return reply.status(422).send({
            status_code: validationError.statusCode,
            message: validationError.message,
            data: "",
          });
        }
        throw validationError;
      }
    }

    let user;
    try {
      user = await User.findByIdAndUpdate(
        userId,
        {
          name,
          first_name: first_name_cased,
          last_name: last_name_cased,
          phone,
          image,
          gender,
          updatedAt: new Date(),
          ...(profile ? { profile } : {}),
        },
        { new: true }
      );
    } catch (updateError) {
      if (isDuplicateKeyError(updateError)) {
        const duplicateResponse = await resolveDuplicateStudentResponseFromError(
          updateError,
          profile ?? {},
          userId
        );
        return reply.status(422).send(duplicateResponse);
      }
      throw updateError;
    }

    if (!user) {
      return reply.status(404).send({
        status_code: 404,
        message: "User not found",
        data: "",
      });
    }

    // Handle parent: resolve child_candidate_code → child User._id
    if (user.role === "parent" && (profile as any)?.child_candidate_code) {
      const rawCode = (profile as any).child_candidate_code;
      const code = normalizeStudentCode(rawCode);
      const childUser = code
        ? await User.findOne({ role: "student", "profile.candidate_code": code })
        : null;
      if (!childUser) {
        return reply.status(404).send({
          status_code: 404,
          message: `No student found with candidate code "${rawCode}"`,
          data: "",
        });
      }
      await User.findByIdAndUpdate(userId, {
        "profile.child": childUser._id,
        "profile.child_candidate_code": undefined,
      });
    }

    return reply.status(201).send({
      status_code: 201,
      message: "User profile created successfully",
      data: "",
    });
  } catch (e) {
    if (isDuplicateKeyError(e) && duplicateCheckProfile) {
      const duplicateResponse = await resolveDuplicateStudentResponseFromError(
        e,
        duplicateCheckProfile,
        duplicateExcludeUserId
      );

      return reply.status(422).send(duplicateResponse);
    }

    return reply.status(500).send({
      status_code: 500,
      message: "An error occurred while creating the user profile",
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
};

// ─── PUT /user  or  PUT /user/:id ─────────────────────────────────────────────

export const updateUser = async (
  request: FastifyRequest<{ Params: { id?: string } }>,
  reply: FastifyReply
) => {
  let duplicateCheckProfile: Record<string, unknown> | undefined;
  let duplicateExcludeUserId: string | undefined;
  try {
    const userId = request.params.id || request.user.id;
    duplicateExcludeUserId = userId;

    const body = request.body as {
      password?: string;
      image?: string;
      role?: string;
      phone?: number;
      first_name?: string;
      last_name?: string;
      gender?: string;
      profile?: Record<string, unknown>;
    };

    const existingUser = await User.findById(userId).select("first_name last_name role profile").lean();
    if (!existingUser) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }

    // Build the update payload
    const updatePayload: Record<string, unknown> = { updatedAt: new Date() };

    if (body.first_name != null) updatePayload.first_name = toTitleCase(body.first_name);
    if (body.last_name != null) updatePayload.last_name = toTitleCase(body.last_name);
    if (body.image != null) updatePayload.image = body.image;
    if (body.phone != null) updatePayload.phone = body.phone;
    if (body.gender != null) updatePayload.gender = body.gender;
    if (body.role != null) updatePayload.role = body.role;

    // Derive name whenever first or last name is updated
    if (body.first_name != null || body.last_name != null) {
      const newFirst = (updatePayload.first_name as string | undefined) ?? existingUser.first_name;
      const newLast = (updatePayload.last_name as string | undefined) ?? existingUser.last_name;
      updatePayload.name = `${newFirst} ${newLast}`;
    }

    // Sync name/image to Better-Auth if changed
    if (updatePayload.name || updatePayload.image) {
      const betterAuthPayload: Record<string, string> = {};
      if (updatePayload.name) betterAuthPayload.name = updatePayload.name as string;
      if (updatePayload.image) betterAuthPayload.image = updatePayload.image as string;

      if (Object.keys(betterAuthPayload).length > 0) {
        if (request.params.id) {
          try {
            await auth.api.adminUpdateUser({
              body: {
                userId: request.params.id,
                data: betterAuthPayload,
              },
              headers: request.headers as any,
            });
          } catch (e) {
            console.warn("Better-Auth adminUpdateUser failed:", e);
          }
        } else {
          try {
            await auth.api.updateUser({
              body: betterAuthPayload,
              headers: request.headers,
            });
          } catch (e) {
            console.warn("Better-Auth updateUser failed:", e);
          }
        }
      }
    }

    // Profile: merge-update fields using dot-notation to avoid overwriting other profile fields
    if (body.profile) {
      for (const [key, val] of Object.entries(body.profile)) {
        if (key === "batch" && typeof val === "string") {
          updatePayload[`profile.${key}`] = new mongoose.Types.ObjectId(val);
        } else {
          updatePayload[`profile.${key}`] = val;
        }
      }

      // Special case: parent child_candidate_code → resolve to User._id
      if ((body.profile as any).child_candidate_code) {
        const rawCode = (body.profile as any).child_candidate_code;
        const code = normalizeStudentCode(rawCode);
        const childUser = code
          ? await User.findOne({ role: "student", "profile.candidate_code": code })
          : null;
        if (!childUser) {
          return reply.status(404).send({
            status_code: 404,
            message: `No student found with candidate code "${rawCode}"`,
            data: "",
          });
        }
        updatePayload["profile.child"] = childUser._id;
        delete updatePayload["profile.child_candidate_code"];
      }
    }

    const targetRole = body.role ?? existingUser.role;
    let mergedStudentProfileForFallback: Record<string, unknown> | undefined;
    if (targetRole === "student") {
      const currentProfile = (existingUser.profile ?? {}) as Record<string, unknown>;
      const incomingProfile = (body.profile ?? {}) as Record<string, unknown>;
      const mergedStudentProfile: Record<string, unknown> = {
        adm_number: incomingProfile.adm_number ?? currentProfile.adm_number,
        candidate_code: incomingProfile.candidate_code ?? currentProfile.candidate_code,
      };
      mergedStudentProfileForFallback = mergedStudentProfile;
      duplicateCheckProfile = mergedStudentProfile;

      try {
        const { admNumber, candidateCode } = await assertStudentUniqueFields(mergedStudentProfile, userId);
        if (admNumber) updatePayload["profile.adm_number"] = admNumber;
        if (candidateCode) updatePayload["profile.candidate_code"] = candidateCode;
      } catch (validationError) {
        if (validationError instanceof StudentUniqueFieldError) {
          return reply.status(422).send({
            status_code: validationError.statusCode,
            message: validationError.message,
            data: "",
          });
        }
        throw validationError;
      }
    }

    let updated;
    try {
      updated = await User.findByIdAndUpdate(userId, updatePayload, { new: true });
    } catch (updateError) {
      if (isDuplicateKeyError(updateError)) {
        const fallbackProfile = mergedStudentProfileForFallback ?? {
          adm_number: (updatePayload["profile.adm_number"] as unknown) ?? (existingUser.profile as any)?.adm_number,
          candidate_code:
            (updatePayload["profile.candidate_code"] as unknown) ?? (existingUser.profile as any)?.candidate_code,
        };

        const duplicateResponse = await resolveDuplicateStudentResponseFromError(
          updateError,
          fallbackProfile,
          userId
        );
        return reply.status(422).send(duplicateResponse);
      }
      throw updateError;
    }
    if (!updated) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }

    return reply.status(200).send({
      status_code: 200,
      message: "User updated successfully",
      data: "",
    });
  } catch (e) {
    if (isDuplicateKeyError(e) && duplicateCheckProfile) {
      const duplicateResponse = await resolveDuplicateStudentResponseFromError(
        e,
        duplicateCheckProfile,
        duplicateExcludeUserId
      );

      return reply.status(422).send(duplicateResponse);
    }

    return reply.status(500).send({
      status_code: 500,
      message: "An error occurred while updating the user",
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
};

// ─── DELETE /user/:id ─────────────────────────────────────────────────────────

export const deleteUser = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const userID = request.params.id;

    // Remove from Better-Auth first
    try {
      await auth.api.removeUser({ body: { userId: userID }, headers: request.headers as any });
    } catch (err) {
      console.warn("Better-Auth removeUser failed:", err);
    }

    // Single delete — profile is embedded, no cascade needed
    await User.findByIdAndDelete(userID);

    return reply.status(204).send({
      status_code: 204,
      message: "Successfully deleted the user",
      data: "",
    });
  } catch (e) {
    return reply.status(500).send({
      status_code: 500,
      message: "Cannot delete the user",
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
};

// ─── GET /user/list?role=… ────────────────────────────────────────────────────

export const listUser = async (
  request: FastifyRequest<{
    Querystring: {
      page?:   number;
      limit?:  number;
      role:    string;
      search?: string;
      batch?:  string;
    };
  }>,
  reply: FastifyReply
) => {
  try {
    const { page = 1, limit = 10, role, search, batch } = request.query;
    const skip = (page - 1) * limit;

    // Base filter
    const filter: Record<string, unknown> = { role };
    if (batch) {
      filter["profile.batch"] = { $in: [new mongoose.Types.ObjectId(batch), batch] };
    }

    // Updated Text search logic
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      
      filter.$or = [
        { name:                  searchRegex },
        { email:                 searchRegex },
        { first_name:            searchRegex },
        { last_name:             searchRegex },
        // These lines enable searching by code/admission number
        { "profile.candidate_code": searchRegex },
        { "profile.adm_number":     searchRegex },
      ];
    }

    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select("-password_hash")
        .populate({ path: "profile.batch", select: "name id adm_year department" })
        .populate({ path: "profile.child", select: "first_name last_name email role profile" })
        .sort({ "profile.candidate_code": 1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]); 

    const totalPages = Math.ceil(totalCount / limit);

    return reply.send({
      status_code: 200,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)}s fetched successfully`,
      data: {
        users: users.map(buildUserPayload),
        pagination: {
          currentPage:   page,
          totalPages,
          totalUsers:    totalCount,
          limit,
          hasNextPage:   page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (e) {
    return reply.status(500).send({
      status_code: 500,
      message: "Error fetching users",
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
};

// ─── POST /user/bulk ─────────────────────────────────────────────────────────

export const bulkCreateUsers = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    let users = (request.body as {
      users: Array<{
        email?: string;
        generate_mail?: boolean;
        password?: string;
        first_name: string;
        last_name: string;
        role: string;
        adm_number?: string;
        adm_year?: number;
        candidate_code?: string;
        department?: string;
        date_of_birth?: Date;
        batch?: string;
        designation?: string;
        date_of_joining?: string;
        relation?: string;
        child_candidate_code?: string;
      }>;
    }).users;

    if (!users || users.length === 0) {
      return reply.status(400).send({
        status_code: 400,
        message: "No users provided.",
        data: "",
      });
    }

    users = users.map((u) => ({
      ...u,
      first_name: toTitleCase(u.first_name),
      last_name: toTitleCase(u.last_name),
    }));

    const roles = new Set(users.map((u) => u.role));
    if (roles.size > 1) {
      return reply.status(400).send({
        status_code: 400,
        message: "Mixed roles are not allowed in bulk creation. All users must have the same role.",
        data: "",
      });
    }

    const results = {
      success: [] as Array<{ email: string; role: string; userId: string; name: string; candidate_code: string }>,
      failed: [] as Array<{ email: string; error: string; name: string; candidate_code: string }>,
      credentials: [] as Array<{
        name: string;
        candidate_code: string;
        adm_year: number | undefined;
        department: string | undefined;
        email: string;
        password: string;
      }>,
    };

    const missingWorkspaceFields = users.filter(
      (u) => u.generate_mail === true && u.role === "student" && (!u.candidate_code || !u.adm_year || !u.department)
    );
    for (const u of missingWorkspaceFields) {
      results.failed.push({
        email: `${u.first_name} ${u.last_name}`,
        error: "generate_mail requires candidate_code, adm_year, and department for students",
        name: `${u.first_name} ${u.last_name}`,
        candidate_code: u.candidate_code ?? "",
      });
    }
    type ProcessEntry = {
      userData: (typeof users)[number];
      userName: string;
      userEmail: string;
      password: string;
      uniqueSuffix: string;
    };
    const usersToProcess: ProcessEntry[] = [];

    for (const userData of users) {
      if (userData.generate_mail === true && userData.role === "student" && (!userData.candidate_code || !userData.adm_year || !userData.department)) {
        continue;
      }

      const userName = `${userData.first_name} ${userData.last_name}`;
      const password = userData.password || generatePassword();
      const uniqueSuffix = userData.candidate_code
        ? userData.candidate_code.slice(-2)
        : Math.random().toString(36).slice(2, 5);
      let userEmail: string;

      if (userData.generate_mail === true) {
        const trimmedEmail = userData.email?.trim();
        userEmail = trimmedEmail || buildPrimaryEmail(userData.first_name, userData.last_name, uniqueSuffix);

        if (!hasRequiredEmailDomain(userEmail)) {
          results.failed.push({
            email: userEmail,
            error: `Email must be on the "${getEmailDomain()}" domain when Generate Mails is true`,
            name: userName,
            candidate_code: userData.candidate_code ?? "",
          });
          continue;
        }
      } else {
        if (!userData.email) {
          results.failed.push({
            email: userName,
            error: "email is required when generate_mail is false",
            name: userName,
            candidate_code: userData.candidate_code ?? "",
          });
          continue;
        }
        userEmail = userData.email;
      }

      usersToProcess.push({ userData, userName, userEmail, password, uniqueSuffix });
    }

    // Duplicate emails within this same upload (e.g. two rows generating the same address)
    const seenEmails = new Set<string>();
    const dedupedUsersToProcess = usersToProcess.filter(({ userData, userEmail, userName }) => {
      if (seenEmails.has(userEmail)) {
        results.failed.push({
          email: userEmail || userName,
          error: "Duplicate email within this upload",
          name: userName,
          candidate_code: userData.candidate_code ?? "",
        });
        return false;
      }
      seenEmails.add(userEmail);
      return true;
    });

    // Pre-check existing emails in ONE query — covers both manually supplied
    // and generated addresses, so we never call Workspace for an address
    // that's already taken.
    const candidateEmails = [...new Set(dedupedUsersToProcess.map((u) => u.userEmail))];
    const existingEmailSet = candidateEmails.length > 0
      ? new Set((await User.find({ email: { $in: candidateEmails } }).select("email").lean()).map((u: any) => u.email))
      : new Set<string>();

    const afterExistenceCheck = dedupedUsersToProcess.filter(({ userData, userEmail, userName }) => {
      if (existingEmailSet.has(userEmail)) {
        results.failed.push({
          email: userEmail,
          error: "User with this email already exists",
          name: userName,
          candidate_code: userData.candidate_code ?? "",
        });
        return false;
      }
      return true;
    });

    // Pre-check student admission/candidate uniqueness
    const requestAdmNumbers = new Set<string>();
    const requestCandidateCodes = new Set<string>();

    const afterIntraBatchStudentCheck = afterExistenceCheck.filter(({ userData, userEmail, userName }) => {
      if (userData.role !== "student") return true;

      const admNumber = normalizeStudentCode(userData.adm_number);
      const candidateCode = normalizeStudentCode(userData.candidate_code);

      if (admNumber && requestAdmNumbers.has(admNumber)) {
        results.failed.push({
          email: userEmail || userName,
          error: "Admission number already exists in this bulk request",
          name: userName,
          candidate_code: userData.candidate_code ?? "",
        });
        return false;
      }

      if (candidateCode && requestCandidateCodes.has(candidateCode)) {
        results.failed.push({
          email: userEmail || userName,
          error: "Candidate code already exists in this bulk request",
          name: userName,
          candidate_code: userData.candidate_code ?? "",
        });
        return false;
      }

      if (admNumber) {
        requestAdmNumbers.add(admNumber);
        userData.adm_number = admNumber;
      }

      if (candidateCode) {
        requestCandidateCodes.add(candidateCode);
        userData.candidate_code = candidateCode;
      }

      return true;
    });

    let afterStudentUniquenessCheck = afterIntraBatchStudentCheck;
    if (requestAdmNumbers.size > 0 || requestCandidateCodes.size > 0) {
      const existingStudents = await User.find({
        role: "student",
        $or: [
          ...(requestAdmNumbers.size > 0 ? [{ "profile.adm_number": { $in: [...requestAdmNumbers] } }] : []),
          ...(requestCandidateCodes.size > 0 ? [{ "profile.candidate_code": { $in: [...requestCandidateCodes] } }] : []),
        ],
      })
        .select("profile.adm_number profile.candidate_code")
        .lean();

      const existingAdmSet = new Set(
        existingStudents
          .map((u: any) => normalizeStudentCode(u?.profile?.adm_number))
          .filter(Boolean) as string[]
      );
      const existingCandidateSet = new Set(
        existingStudents
          .map((u: any) => normalizeStudentCode(u?.profile?.candidate_code))
          .filter(Boolean) as string[]
      );

      afterStudentUniquenessCheck = afterIntraBatchStudentCheck.filter(({ userData, userEmail, userName }) => {
        if (userData.role !== "student") return true;

        const admNumber = normalizeStudentCode(userData.adm_number);
        const candidateCode = normalizeStudentCode(userData.candidate_code);
        let isDuplicate = false;

        if (admNumber && existingAdmSet.has(admNumber)) {
          results.failed.push({
            email: userEmail || userName,
            error: "Admission number already exists",
            name: userName,
            candidate_code: userData.candidate_code ?? "",
          });
          isDuplicate = true;
        }

        if (candidateCode && existingCandidateSet.has(candidateCode)) {
          results.failed.push({
            email: userEmail || userName,
            error: "Candidate code already exists",
            name: userName,
            candidate_code: userData.candidate_code ?? "",
          });
          isDuplicate = true;
        }

        return !isDuplicate;
      });
    }

    // ── Google Workspace batch (only for rows that survived every check above) ─
    const workspaceEntries = afterStudentUniquenessCheck.filter(({ userData }) => userData.generate_mail === true);
    const workspaceFailedEmails = new Set<string>();

    if (workspaceEntries.length > 0) {
      try {
        const inputs: WorkspaceUserInput[] = workspaceEntries.map(({ userData, userEmail, password, uniqueSuffix }) => ({
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role,
          candidate_code: userData.candidate_code,
          adm_year: userData.adm_year,
          department: userData.department,
          unique_suffix: uniqueSuffix,
          email: userEmail,
          password,
        }));
        const workspaceResultMap = await bulkCreateWorkspaceUsers(inputs);

        for (const entry of workspaceEntries) {
          const wsResult = workspaceResultMap.get(entry.userEmail);
          if (!wsResult || wsResult.error) {
            results.failed.push({
              email: entry.userEmail,
              error: "Workspace account creation failed: " + (wsResult?.error ?? "No result"),
              name: entry.userName,
              candidate_code: entry.userData.candidate_code ?? "",
            });
            workspaceFailedEmails.add(entry.userEmail);
          }
        }
      } catch (wsError) {
        for (const entry of workspaceEntries) {
          results.failed.push({
            email: entry.userEmail,
            error: "Google Workspace batch failed: " + (wsError instanceof Error ? wsError.message : "Unknown error"),
            name: entry.userName,
            candidate_code: entry.userData.candidate_code ?? "",
          });
          workspaceFailedEmails.add(entry.userEmail);
        }
      }
    }

    const finalUniqueUsers = afterStudentUniquenessCheck.filter(
      ({ userEmail }) => !workspaceFailedEmails.has(userEmail)
    );

    // Preload batches for student lookups
    const batchByObjectId = new Map<string, string>();
    const batchByCode = new Map<string, string>();
    const preloadedBatches = await Batch.find({}).select("_id id").lean();
    for (const batch of preloadedBatches as Array<{ _id: any; id?: string }>) {
      batchByObjectId.set(batch._id.toString(), batch._id.toString());
      if (batch.id) batchByCode.set(batch.id.toUpperCase(), batch._id.toString());
    }

    // Preload child lookups for parent rows — resolve candidate code -> student User._id
    // in one query, rather than per-row, matching the batch-preload pattern above.
    const childCandidateCodes = new Set<string>();
    for (const { userData } of finalUniqueUsers) {
      const code = normalizeStudentCode(userData.child_candidate_code);
      if (userData.role === "parent" && code) childCandidateCodes.add(code);
    }
    const childIdByCandidateCode = new Map<string, string>();
    if (childCandidateCodes.size > 0) {
      const childStudents = await User.find({
        role: "student",
        "profile.candidate_code": { $in: [...childCandidateCodes] },
      })
        .select("_id profile.candidate_code")
        .lean();
      for (const child of childStudents as Array<{ _id: any; profile?: { candidate_code?: string } }>) {
        const code = normalizeStudentCode(child.profile?.candidate_code);
        if (code) childIdByCandidateCode.set(code, child._id.toString());
      }
    }

    // Process each user
    for (const { userData, userName, userEmail, password } of finalUniqueUsers) {
      try {
        const createdUser = await auth.api.createUser({
          body: {
            email: userEmail,
            password: password,
            name: userName,
          }
        });

        if (!createdUser?.user) {
          results.failed.push({
            email: userEmail,
            error: "Failed to create user account",
            name: userName,
            candidate_code: userData.candidate_code ?? "",
          });
          continue;
        }

        const userId = createdUser.user.id;

        // Build profile — shape depends on role
        const profile: Record<string, unknown> = {};
        if (userData.role === "student") {
          if (userData.adm_number) profile.adm_number = userData.adm_number;
          if (userData.adm_year) profile.adm_year = userData.adm_year;
          if (userData.candidate_code) profile.candidate_code = userData.candidate_code;
          if (userData.department) profile.department = userData.department;
          if (userData.date_of_birth) profile.date_of_birth = userData.date_of_birth;

          if (userData.batch) {
            const batchId = new mongoose.Types.ObjectId(mongoose.Types.ObjectId.isValid(userData.batch)
              ? batchByObjectId.get(userData.batch)
              : batchByCode.get(userData.batch.toUpperCase()));

            if (!batchId) {
              try { await auth.api.removeUser({ body: { userId }, headers: request.headers as any }); } catch {}
              await User.findByIdAndDelete(userId);
              results.failed.push({
                email: userEmail,
                error: "Batch not found for provided batch ID",
                name: userName,
                candidate_code: userData.candidate_code ?? "",
              });
              continue;
            }
            profile.batch = batchId;
          }
        } else if (isStaffRole(userData.role)) {
          if (userData.designation) profile.designation = userData.designation;
          if (userData.department) profile.department = userData.department;
          if (userData.date_of_joining) profile.date_of_joining = userData.date_of_joining;
        } else if (userData.role === "parent") {
          if (userData.relation) profile.relation = userData.relation;

          if (userData.child_candidate_code) {
            const childCode = normalizeStudentCode(userData.child_candidate_code);
            const childId = childCode ? childIdByCandidateCode.get(childCode) : undefined;

            if (!childId) {
              try { await auth.api.removeUser({ body: { userId }, headers: request.headers as any }); } catch {}
              await User.findByIdAndDelete(userId);
              results.failed.push({
                email: userEmail,
                error: `No student found with candidate code "${userData.child_candidate_code}"`,
                name: userName,
                candidate_code: "",
              });
              continue;
            }
            profile.child = new mongoose.Types.ObjectId(childId);
          }
        }

        // Single atomic update: role + split names + profile
        try {
          await User.findByIdAndUpdate(userId, {
            role: userData.role,
            first_name: userData.first_name,
            last_name: userData.last_name,
            emailVerified: true,
            updatedAt: new Date(),
            profile,
          });
        } catch (updateErr) {
          try { await auth.api.removeUser({ body: { userId }, headers: request.headers as any }); } catch {}
          await User.findByIdAndDelete(userId);
          const profileErrorMessage = isDuplicateKeyError(updateErr)
            ? "Admission number or candidate code already exists"
            : (updateErr instanceof Error ? updateErr.message : "Unknown error");
          results.failed.push({
            email: userEmail,
            error: "Profile update failed: " + profileErrorMessage,
            name: userName,
            candidate_code: userData.candidate_code ?? "",
          });
          continue;
        }

        results.success.push({
          email: userEmail,
          role: userData.role,
          userId,
          name: userName,
          candidate_code: userData.candidate_code ?? "",
        });

        if (userData.generate_mail === true) {
          results.credentials.push({
            name: userName,
            candidate_code: userData.candidate_code ?? "",
            adm_year: userData.adm_year,
            department: userData.department,
            email: userEmail,
            password,
          });
        }
      } catch (userError) {
        results.failed.push({
          email: userEmail,
          error: userError instanceof Error ? userError.message : "Unknown error",
          name: userName,
          candidate_code: userData.candidate_code ?? "",
        });
      }
    }

    const statusCode =
      results.success.length === 0 ? 422 : results.failed.length === 0 ? 201 : 207;

    return reply.status(statusCode).send({
      status_code: statusCode,
      message: `Bulk user creation completed. ${results.success.length} succeeded, ${results.failed.length} failed.`,
      data: results,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Bulk user creation failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ─── Set Password ──────────────────────────────────────────────────────────────

/**
 * Lets the current (logged-in) user set a password directly, without
 * needing a current one — only succeeds if they don't already have a
 * "credential" account (e.g. users who only ever signed in via Google).
 * Once a password exists, use Better-Auth's core /change-password instead
 * (called directly from the frontend via authClient.changePassword).
 */
export const setPassword = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { newPassword } = request.body as { newPassword: string };

    await auth.api.setPassword({
      body: { newPassword },
      headers: request.headers as any,
    });

    return reply.send({
      status_code: 200,
      message: "Password set successfully",
      data: "",
    });
  } catch (error: any) {
    const message =
      error?.body?.message ||
      (error instanceof Error ? error.message : "Failed to set password");
    const alreadySet = /already.*set/i.test(String(message));

    return reply.status(alreadySet ? 409 : 400).send({
      status_code: alreadySet ? 409 : 400,
      message: alreadySet
        ? "You already have a password set. Use the change password form instead."
        : message,
      data: "",
    });
  }
};

// ─── Admin Reset Password ──────────────────────────────────────────────────────

/**
 * Admin directly sets another user's password. Unlike Better-Auth's own
 * admin.setUserPassword (which only UPDATEs an existing "credential"
 * account and silently no-ops if the target user never had one — e.g.
 * Google-only sign-in), this creates the credential account if missing,
 * so it works correctly for every user regardless of how they signed up.
 */
export const resetUserPassword = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params;
    const { newPassword } = request.body as { newPassword: string };

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return reply.status(404).send({
        status_code: 404,
        message: "User not found",
        data: "",
      });
    }

    const hashed = await hashPassword(newPassword);
    const now = new Date();

    const existingAccount = await Account.findOne({ userId: id, providerId: "credential" });

    if (existingAccount) {
      existingAccount.password = hashed;
      existingAccount.updatedAt = now;
      await existingAccount.save();
    } else {
      await Account.create({
        _id: new mongoose.Types.ObjectId().toString(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: hashed,
        createdAt: now,
        updatedAt: now,
      });
    }

    return reply.send({
      status_code: 200,
      message: "Password reset successfully",
      data: "",
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to reset password",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
