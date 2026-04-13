import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { User } from "@/plugins/db/models/auth.model";
import { Batch } from "@/plugins/db/models/academics.model";
import { auth } from "@/plugins/auth";
import { authClient } from "@/plugins/auth";
import { bulkCreateWorkspaceUsers, type WorkspaceUserInput } from "@/lib/google-workspace";

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
  _id:          String(user._id),
  email:        user.email,
  role:         user.role,
  first_name:   user.first_name,
  last_name:    user.last_name,
  name:         user.name,
  ...(user.phone        != null ? { phone: user.phone }               : {}),
  ...(user.gender       != null ? { gender: user.gender }             : {}),
  ...(user.image        != null ? { image: user.image }               : {}),
  ...(user.emailVerified!= null ? { emailVerified: user.emailVerified }: {}),
  ...(toIsoString(user.createdAt) ? { createdAt: toIsoString(user.createdAt) } : {}),
  ...(toIsoString(user.updatedAt) ? { updatedAt: toIsoString(user.updatedAt) } : {}),
  profile:      user.profile ?? {},
});

/** Roles that use the staff profile shape */
const STAFF_ROLES = ["teacher", "principal", "hod", "admin", "staff"] as const;
const isStaffRole = (role: string) => (STAFF_ROLES as readonly string[]).includes(role);

// ─── GET /user  or  GET /user/:id ─────────────────────────────────────────────

export const getUser = async (
  request: FastifyRequest<{ Params: { id?: string } }>,
  reply: FastifyReply
) => {
  try {
    const userId = request.params.id || request.user.id;

    const user = await User.findById(userId)
      .populate({ path: "profile.batch", select: "name id adm_year department" })
      .populate({ path: "profile.child", select: "first_name last_name email role profile" })
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
  try {
    const { image, phone, first_name, last_name, gender, profile } = request.body as {
      image?:      string;
      phone:       number;
      first_name:  string;
      last_name:   string;
      gender:      string;
      profile?:    Record<string, unknown>;
    };

    const userId = request.user.id;

    // Derive name from first_name + last_name
    const name = `${first_name} ${last_name}`;

    if (profile && typeof profile.batch === "string") {
      profile.batch = new mongoose.Types.ObjectId(profile.batch as string);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        name,
        first_name,
        last_name,
        phone,
        image,
        gender,
        updatedAt: new Date(),
        ...(profile ? { profile } : {}),
      },
      { new: true }
    );

    if (!user) {
      return reply.status(404).send({
        status_code: 404,
        message: "User not found",
        data: "",
      });
    }

    // Handle parent: resolve childID → child User._id
    if (user.role === "parent" && (profile as any)?.childID) {
      const childUser = await User.findById((profile as any).childID);
      if (!childUser || childUser.role !== "student") {
        return reply.status(404).send({
          status_code: 404,
          message: "Invalid childID: student user not found.",
          data: "",
        });
      }
      await User.findByIdAndUpdate(userId, {
        "profile.child":    childUser._id,
        "profile.childID":  undefined,
      });
    }

    return reply.status(201).send({
      status_code: 201,
      message: "User profile created successfully",
      data: "",
    });
  } catch (e) {
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
  try {
    const userId = request.params.id || request.user.id;

    const body = request.body as {
      password?:   string;
      image?:      string;
      role?:       string;
      phone?:      number;
      first_name?: string;
      last_name?:  string;
      gender?:     string;
      profile?:    Record<string, unknown>;
    };

    // Build the update payload
    const updatePayload: Record<string, unknown> = { updatedAt: new Date() };

    if (body.first_name != null) updatePayload.first_name = body.first_name;
    if (body.last_name  != null) updatePayload.last_name  = body.last_name;
    if (body.image      != null) updatePayload.image      = body.image;
    if (body.phone      != null) updatePayload.phone      = body.phone;
    if (body.gender     != null) updatePayload.gender     = body.gender;
    if (body.role       != null) updatePayload.role       = body.role;

    // Derive name whenever first or last name is updated
    if (body.first_name != null || body.last_name != null) {
      const existing = await User.findById(userId).select("first_name last_name").lean();
      if (!existing) {
        return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
      }
      const newFirst = body.first_name ?? existing.first_name;
      const newLast  = body.last_name  ?? existing.last_name;
      updatePayload.name = `${newFirst} ${newLast}`;
    }

    // Sync name/image to Better-Auth if changed
    if (updatePayload.name || updatePayload.image) {
      await auth.api.updateUser({
        body: {
          name:  updatePayload.name  as string | undefined,
          image: updatePayload.image as string | undefined,
        },
        headers: request.headers,
      });
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

      // Special case: parent childID → resolve to User._id
      if ((body.profile as any).childID) {
        const childUser = await User.findById((body.profile as any).childID);
        if (!childUser || childUser.role !== "student") {
          return reply.status(404).send({
            status_code: 404,
            message: "Invalid childID: student user not found.",
            data: "",
          });
        }
        updatePayload["profile.child"]   = childUser._id;
        delete updatePayload["profile.childID"];
      }
    }

    const updated = await User.findByIdAndUpdate(userId, updatePayload, { new: true });
    if (!updated) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }

    return reply.status(200).send({
      status_code: 200,
      message: "User updated successfully",
      data: "",
    });
  } catch (e) {
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
    await authClient.admin.removeUser({ userId: userID });

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
      filter["profile.batch"] = new mongoose.Types.ObjectId(batch);
    }

    // Text search — applies to user-level fields only
    if (search) {
      filter.$or = [
        { name:       { $regex: search, $options: "i" } },
        { email:      { $regex: search, $options: "i" } },
        { first_name: { $regex: search, $options: "i" } },
        { last_name:  { $regex: search, $options: "i" } },
      ];
    }

    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select("-password_hash")
        .populate({ path: "profile.batch", select: "name id adm_year department" })
        .populate({ path: "profile.child", select: "first_name last_name email role profile" })
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    console.log(users);

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
        email?:          string;
        generate_mail?:  boolean;
        password?:       string;
        first_name:      string;
        last_name:       string;
        role:            string;
        adm_number?:     string;
        adm_year?:       number;
        candidate_code?: string;
        department?:     string;
        date_of_birth?:  Date;
        batch?:          string;
      }>;
    }).users;

    if (!users || users.length === 0) {
      return reply.status(400).send({
        status_code: 400,
        message: "No users provided.",
        data: "",
      });
    }

    const roles = new Set(users.map((u) => u.role));
    if (roles.size > 1) {
      return reply.status(400).send({
        status_code: 400,
        message: "Mixed roles are not allowed in bulk creation. All users must have the same role.",
        data: "",
      });
    }

    const results = {
      success: [] as Array<{ email: string; role: string; userId: string }>,
      failed:  [] as Array<{ email: string; error: string }>,
    };

    // ── Google Workspace batch ────────────────────────────────────────────────
    const workspaceCandidates = users.filter(
      (u) => u.generate_mail === true && u.candidate_code && u.adm_year && u.department
    );

    const missingWorkspaceFields = users.filter(
      (u) => u.generate_mail === true && (!u.candidate_code || !u.adm_year || !u.department)
    );
    for (const u of missingWorkspaceFields) {
      results.failed.push({
        email: `${u.first_name} ${u.last_name}`,
        error: "generate_mail requires candidate_code, adm_year, and department",
      });
    }

    let workspaceResultMap = new Map<string, { primaryEmail: string; error?: string }>();
    if (workspaceCandidates.length > 0) {
      try {
        const inputs: WorkspaceUserInput[] = workspaceCandidates.map((u) => ({
          first_name:     u.first_name,
          last_name:      u.last_name,
          candidate_code: u.candidate_code!,
          adm_year:       u.adm_year!,
          department:     u.department!,
        }));
        workspaceResultMap = await bulkCreateWorkspaceUsers(inputs);
      } catch (wsError) {
        for (const u of workspaceCandidates) {
          results.failed.push({
            email: `${u.first_name} ${u.last_name}`,
            error: "Google Workspace batch failed: " + (wsError instanceof Error ? wsError.message : "Unknown error"),
          });
        }
        const failedCodes = new Set(workspaceCandidates.map((u) => u.candidate_code));
        users = users.filter((u) => !failedCodes.has(u.candidate_code));
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Resolve emails
    type ProcessEntry = { userData: (typeof users)[number]; userName: string; userEmail: string };
    const usersToProcess: ProcessEntry[] = [];

    for (const userData of users) {
      if (userData.generate_mail === true && (!userData.candidate_code || !userData.adm_year || !userData.department)) {
        continue;
      }

      const userName = `${userData.first_name} ${userData.last_name}`;
      let userEmail: string;

      if (userData.generate_mail === true) {
        const wsResult = workspaceResultMap.get(userData.candidate_code!);
        if (!wsResult || wsResult.error) {
          results.failed.push({ email: userName, error: "Workspace account creation failed: " + (wsResult?.error ?? "No result") });
          continue;
        }
        userEmail = wsResult.primaryEmail;
      } else {
        if (!userData.email) {
          results.failed.push({ email: userName, error: "email is required when generate_mail is false" });
          continue;
        }
        userEmail = userData.email;
      }

      usersToProcess.push({ userData, userName, userEmail });
    }

    // Pre-check existing emails in one query
    const candidateEmails = [...new Set(usersToProcess.map((u) => u.userEmail))];
    const existingEmailSet = candidateEmails.length > 0
      ? new Set((await User.find({ email: { $in: candidateEmails } }).select("email").lean()).map((u: any) => u.email))
      : new Set<string>();

    const finalUsers = usersToProcess.filter(({ userEmail }) => {
      if (existingEmailSet.has(userEmail)) {
        results.failed.push({ email: userEmail, error: "User with this email already exists" });
        return false;
      }
      return true;
    });

    // Preload batches for student lookups
    const batchByObjectId = new Map<string, string>();
    const batchByCode     = new Map<string, string>();
    const preloadedBatches = await Batch.find({}).select("_id id").lean();
    for (const batch of preloadedBatches as Array<{ _id: any; id?: string }>) {
      batchByObjectId.set(batch._id.toString(), batch._id.toString());
      if (batch.id) batchByCode.set(batch.id.toUpperCase(), batch._id.toString());
    }

    // Process each user
    for (const { userData, userName, userEmail } of finalUsers) {
      try {
        const password = userData.password || Math.random().toString(36).slice(-12) + "A1!";

        const createdUser = await authClient.signUp.email({
          email:    userEmail,
          password: password,
          name:     userName,
        });

        if (!createdUser?.data?.user) {
          results.failed.push({ email: userEmail, error: "Failed to create user account" });
          continue;
        }

        const userId = createdUser.data.user.id;

        // Build profile for students (other roles can extend later)
        const profile: Record<string, unknown> = {};
        if (userData.role === "student") {
          if (userData.adm_number)     profile.adm_number     = userData.adm_number;
          if (userData.adm_year)       profile.adm_year       = userData.adm_year;
          if (userData.candidate_code) profile.candidate_code = userData.candidate_code;
          if (userData.department)     profile.department     = userData.department;
          if (userData.date_of_birth)  profile.date_of_birth  = userData.date_of_birth;

          if (userData.batch) {
            const batchId = new mongoose.Types.ObjectId(mongoose.Types.ObjectId.isValid(userData.batch)
              ? batchByObjectId.get(userData.batch)
              : batchByCode.get(userData.batch.toUpperCase()));

            if (!batchId) {
              await authClient.admin.removeUser({ userId });
              await User.findByIdAndDelete(userId);
              results.failed.push({ email: userEmail, error: "Batch not found for provided batch ID" });
              continue;
            }
            profile.batch = batchId;
          }
        }

        // Single atomic update: role + split names + profile
        try {
          await User.findByIdAndUpdate(userId, {
            role:       userData.role,
            first_name: userData.first_name,
            last_name:  userData.last_name,
            updatedAt:  new Date(),
            profile,
          });
        } catch (updateErr) {
          await authClient.admin.removeUser({ userId });
          await User.findByIdAndDelete(userId);
          results.failed.push({
            email: userEmail,
            error: "Profile update failed: " + (updateErr instanceof Error ? updateErr.message : "Unknown error"),
          });
          continue;
        }

        results.success.push({ email: userEmail, role: userData.role, userId });
      } catch (userError) {
        results.failed.push({
          email: userEmail,
          error: userError instanceof Error ? userError.message : "Unknown error",
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
