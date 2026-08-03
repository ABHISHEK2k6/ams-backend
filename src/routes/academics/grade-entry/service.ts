import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { GradeEntry, GradeField } from "@/plugins/db/models/grade.models";
import { User } from "@/plugins/db/models/auth.model";
import { Batch } from "@/plugins/db/models/academics.model";
import { getScopeBatchFilter } from "@/lib/scope";

interface ListGradeEntriesQuery {
  page?: number;
  limit?: number;
  user?: string;
  grade_field?: string;
  is_absent?: boolean;
}

interface GetGradeEntryParams {
  id: string;
}

interface CreateGradeEntryBody {
  _id?: string;
  user: string;
  grade_field: string;
  mark: number;
  is_absent: boolean;
  remarks?: string;
}

interface BulkCreateGradeEntriesBody {
  entries: CreateGradeEntryBody[];
}

interface UpdateGradeEntryParams {
  id: string;
}

interface UpdateGradeEntryBody {
  user?: string;
  grade_field?: string;
  mark?: number;
  is_absent?: boolean;
  remarks?: string;
}

interface DeleteGradeEntryParams {
  id: string;
}

interface GradeEntryMatrixQuery {
  batch: string;
  subject: string;
}

interface GradeEntrySummaryQuery {
  batch: string;
}

interface BulkUpsertGradeEntryItem {
  user: string;
  grade_field: string;
  mark: number;
  is_absent: boolean;
  remarks?: string;
}

interface BulkUpsertGradeEntriesBody {
  entries: BulkUpsertGradeEntryItem[];
}

/** Whether `batchId` falls within the requesting user's role-scoped batch access (see @/lib/scope). */
async function isBatchInScope(requester: { _id: unknown; role: string; profile?: unknown }, batchId: string): Promise<boolean> {
  const scopeFilter = getScopeBatchFilter(requester as any);
  const batch = await Batch.exists({ _id: batchId, ...scopeFilter });
  return Boolean(batch);
}

export const listGradeEntriesHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { page = 1, limit = 10, grade_field, is_absent } = request.query as ListGradeEntriesQuery;
    let { user } = request.query as ListGradeEntriesQuery;
    const skip = (page - 1) * limit;

    const requester = await User.findById(request.user.id).lean();
    if (!requester) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }
    const isSelfScoped = (requester as any).role === "student" || (requester as any).role === "parent";
    if ((requester as any).role === "student") {
      user = String(requester._id);
    } else if ((requester as any).role === "parent") {
      const childId = (requester as any).profile?.child;
      if (!childId) {
        return reply.send({
          status_code: 200,
          message: "Grade entries retrieved successfully",
          data: { gradeEntries: [], pagination: { page, limit, total: 0, totalPages: 0 } },
        });
      }
      user = String(childId);
    }

    // Build filter
    const filter: any = {};
    if (user) filter.user = user;
    if (grade_field) filter.grade_field = grade_field;
    if (is_absent !== undefined) filter.is_absent = is_absent;

    let gradeEntries = await GradeEntry.find(filter)
      .populate("user", "first_name last_name email role")
      .populate({
        path: "grade_field",
        populate: [
          { path: "batch", select: "name adm_year department" },
          { path: "subject", select: "_id name sem subject_code type total_marks" },
        ],
      })
      .skip(skip)
      .limit(limit)
      .sort({ updated_at: -1 });

    // Student/parent must never see marks for a field the teacher hasn't published yet.
    if (isSelfScoped) {
      gradeEntries = gradeEntries.filter((entry: any) => entry.grade_field?.published === true);
    }

    const total = await GradeEntry.countDocuments(filter);

    return reply.send({
      status_code: 200,
      message: "Grade entries retrieved successfully",
      data: {
        gradeEntries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to retrieve grade entries",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getGradeEntryByIdHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as GetGradeEntryParams;

    const gradeEntry = await GradeEntry.findById(id)
      .populate("user", "first_name last_name email role")
      .populate({
        path: "grade_field",
        populate: [
          { path: "batch", select: "name adm_year department" },
          { path: "subject", select: "_id sem subject_code type" },
        ],
      });

    if (!gradeEntry) {
      return reply.status(404).send({
        status_code: 404,
        message: "Grade entry not found",
        data: "",
      });
    }

    return reply.send({
      status_code: 200,
      message: "Grade entry retrieved successfully",
      data: gradeEntry,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to retrieve grade entry",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createGradeEntryHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const gradeEntryData = request.body as CreateGradeEntryBody;

    // Validate user exists
    const user = await User.findById(gradeEntryData.user);
    if (!user) {
      return reply.status(404).send({
        status_code: 404,
        message: "User not found",
        data: "",
      });
    }

    // Validate grade field exists
    const gradeField = await GradeField.findById(gradeEntryData.grade_field);
    if (!gradeField) {
      return reply.status(404).send({
        status_code: 404,
        message: "Grade field not found",
        data: "",
      });
    }

    // Moderation fields apply their raw value to every student directly
    if (gradeField.type === "moderation") {
      return reply.status(422).send({
        status_code: 422,
        message: "Grade entries are not needed for moderation fields, the field's value applies to every student directly",
        data: "",
      });
    }

    // Validate mark doesn't exceed total_mark
    if (gradeEntryData.mark > gradeField.total_mark!) {
      return reply.status(422).send({
        status_code: 422,
        message: `Mark cannot exceed total mark of ${gradeField.total_mark}`,
        data: "",
      });
    }

    // Check if entry already exists for this user and grade field
    const existingEntry = await GradeEntry.findOne({
      user: gradeEntryData.user,
      grade_field: gradeEntryData.grade_field,
    });

    if (existingEntry) {
      return reply.status(422).send({
        status_code: 422,
        message: "Grade entry already exists for this user and grade field",
        data: "",
      });
    }

    // If absent, set mark to 0
    const entryData = {
      ...gradeEntryData,
      mark: gradeEntryData.is_absent ? 0 : gradeEntryData.mark,
      updated_at: new Date(),
    };

    const gradeEntry = await GradeEntry.create(entryData);

    const populatedGradeEntry = await GradeEntry.findById(gradeEntry._id)
      .populate("user", "first_name last_name email role")
      .populate({
        path: "grade_field",
        populate: [
          { path: "batch", select: "name adm_year department" },
          { path: "subject", select: "_id sem subject_code type" },
        ],
      });

    return reply.status(201).send({
      status_code: 201,
      message: "Grade entry created successfully",
      data: populatedGradeEntry,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to create grade entry",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const bulkCreateGradeEntriesHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { entries } = request.body as BulkCreateGradeEntriesBody;

    const results = {
      successful: [] as any[],
      failed: [] as any[],
    };

    // Process each entry
    for (const entryData of entries) {
      try {
        // Validate user exists
        const user = await User.findById(entryData.user);
        if (!user) {
          results.failed.push({
            data: entryData,
            reason: "User not found",
          });
          continue;
        }

        // Validate grade field exists
        const gradeField = await GradeField.findById(entryData.grade_field);
        if (!gradeField) {
          results.failed.push({
            data: entryData,
            reason: "Grade field not found",
          });
          continue;
        }

        // Moderation fields apply their raw value to every student directly
        if (gradeField.type === "moderation") {
          results.failed.push({
            data: entryData,
            reason: "Grade entries are not needed for moderation fields",
          });
          continue;
        }

        // Validate mark doesn't exceed total_mark
        if (entryData.mark > gradeField.total_mark!) {
          results.failed.push({
            data: entryData,
            reason: `Mark cannot exceed total mark of ${gradeField.total_mark}`,
          });
          continue;
        }

        // Check if entry already exists
        const existingEntry = await GradeEntry.findOne({
          user: entryData.user,
          grade_field: entryData.grade_field,
        });

        if (existingEntry) {
          results.failed.push({
            data: entryData,
            reason: "Grade entry already exists",
          });
          continue;
        }

        // If absent, set mark to 0
        const finalData = {
          ...entryData,
          mark: entryData.is_absent ? 0 : entryData.mark,
          updated_at: new Date(),
        };

        const gradeEntry = await GradeEntry.create(finalData);
        results.successful.push(gradeEntry);
      } catch (error) {
        results.failed.push({
          data: entryData,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const statusCode = results.failed.length > 0 ? (results.successful.length > 0 ? 207 : 422) : 201;

    return reply.status(statusCode).send({
      status_code: statusCode,
      message: `Bulk create completed. ${results.successful.length} successful, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to bulk create grade entries",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateGradeEntryHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as UpdateGradeEntryParams;
    const updateData = request.body as UpdateGradeEntryBody;

    // Check if grade entry exists
    const gradeEntry = await GradeEntry.findById(id);
    if (!gradeEntry) {
      return reply.status(404).send({
        status_code: 404,
        message: "Grade entry not found",
        data: "",
      });
    }

    // Validate user if provided
    if (updateData.user) {
      const user = await User.findById(updateData.user);
      if (!user) {
        return reply.status(404).send({
          status_code: 404,
          message: "User not found",
          data: "",
        });
      }
    }

    // Validate grade field if provided
    let gradeField = await GradeField.findById(gradeEntry.grade_field);
    if (updateData.grade_field) {
      gradeField = await GradeField.findById(updateData.grade_field);
      if (!gradeField) {
        return reply.status(404).send({
          status_code: 404,
          message: "Grade field not found",
          data: "",
        });
      }
    }

    // Moderation fields apply their raw value to every student directly 
    if (gradeField?.type === "moderation") {
      return reply.status(422).send({
        status_code: 422,
        message: "Grade entries are not needed for moderation fields, the field's value applies to every student directly",
        data: "",
      });
    }

    // Validate mark doesn't exceed total_mark
    if (updateData.mark !== undefined && gradeField) {
      if (updateData.mark > gradeField.total_mark!) {
        return reply.status(422).send({
          status_code: 422,
          message: `Mark cannot exceed total mark of ${gradeField.total_mark}`,
          data: "",
        });
      }
    }

    // Check for duplicate if user or grade_field is being updated
    if (updateData.user || updateData.grade_field) {
      const targetUser = updateData.user ?? gradeEntry.user;
      const targetGradeField = updateData.grade_field ?? gradeEntry.grade_field;

      const existingEntry = await GradeEntry.findOne({
        user: targetUser,
        grade_field: targetGradeField,
        _id: { $ne: id },
      });

      if (existingEntry) {
        return reply.status(422).send({
          status_code: 422,
          message: "Grade entry already exists for this user and grade field",
          data: "",
        });
      }
    }

    // If is_absent is set to true, set mark to 0
    if (updateData.is_absent === true) {
      updateData.mark = 0;
    }

    // Update timestamp
    const finalUpdateData = {
      ...updateData,
      updated_at: new Date(),
    };

    const updatedGradeEntry = await GradeEntry.findByIdAndUpdate(id, finalUpdateData, {
      new: true,
      runValidators: true,
    })
      .populate("user", "first_name last_name email role")
      .populate({
        path: "grade_field",
        populate: [
          { path: "batch", select: "name adm_year department" },
          { path: "subject", select: "_id sem subject_code type" },
        ],
      });

    return reply.send({
      status_code: 200,
      message: "Grade entry updated successfully",
      data: updatedGradeEntry,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to update grade entry",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteGradeEntryHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as DeleteGradeEntryParams;

    const gradeEntry = await GradeEntry.findByIdAndDelete(id);

    if (!gradeEntry) {
      return reply.status(404).send({
        status_code: 404,
        message: "Grade entry not found",
        data: "",
      });
    }

    return reply.send({
      status_code: 200,
      message: "Grade entry deleted successfully",
      data: gradeEntry,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to delete grade entry",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ─── GET /academics/grade-entry/matrix ─────────────────────────────────────────
// Pivots grade fields (columns) x students (rows) x entries for one batch+subject,
// so the teacher grade grid can render from a single fetch instead of N+1 calls.

export const getGradeEntryMatrixHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { batch, subject } = request.query as GradeEntryMatrixQuery;

    const requester = await User.findById(request.user.id);
    if (!requester) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }

    if (!(await isBatchInScope(requester, batch))) {
      return reply.status(403).send({
        status_code: 403,
        message: "This batch is outside your access scope",
        data: "",
      });
    }

    const gradeFields = await GradeField.find({ batch, subject })
      .populate("subject", "_id name subject_code total_marks pass_mark")
      .sort({ createdAt: 1 });

    // profile.batch is a Mixed-field path, so it's stored as an ObjectId but
    // isn't auto-cast by Mongoose — match both forms explicitly.
    const students = await User.find({
      role: "student",
      "profile.batch": { $in: [new mongoose.Types.ObjectId(batch), batch] },
    })
      .select("first_name last_name profile.adm_number profile.candidate_code")
      .sort({ "profile.candidate_code": 1 })
      .lean();

    const gradeFieldIds = gradeFields.map((gf) => gf._id);
    const entries = gradeFieldIds.length > 0
      ? await GradeEntry.find({ grade_field: { $in: gradeFieldIds } }).lean()
      : [];

    const entryMap: Record<string, Record<string, any>> = {};
    for (const entry of entries as any[]) {
      const sid = String(entry.user);
      const gfid = String(entry.grade_field);
      if (!entryMap[sid]) entryMap[sid] = {};
      entryMap[sid][gfid] = entry;
    }

    const studentRows = students.map((s: any) => ({
      user: s,
      entries: entryMap[String(s._id)] ?? {},
    }));

    return reply.send({
      status_code: 200,
      message: "Grade matrix fetched successfully",
      data: { gradeFields, students: studentRows },
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch grade matrix",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ─── GET /academics/grade-entry/summary ────────────────────────────────────────
// Per-student, per-subject weighted internal total for a whole batch, capped at
// each subject's total_marks. Powers the Class Performance / Semester Grade Report view.

export const getGradeEntrySummaryHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { batch } = request.query as GradeEntrySummaryQuery;

    const requester = await User.findById(request.user.id);
    if (!requester) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }

    if (!(await isBatchInScope(requester, batch))) {
      return reply.status(403).send({
        status_code: 403,
        message: "This batch is outside your access scope",
        data: "",
      });
    }

    const gradeFields = await GradeField.find({ batch })
      .populate("subject", "name subject_code sem total_marks")
      .lean();

    // profile.batch is a Mixed-field path, so it's stored as an ObjectId but
    // isn't auto-cast by Mongoose — match both forms explicitly.
    const students = await User.find({
      role: "student",
      "profile.batch": { $in: [new mongoose.Types.ObjectId(batch), batch] },
    })
      .select("first_name last_name profile.adm_number profile.candidate_code")
      .sort({ "profile.candidate_code": 1 })
      .lean();

    const gradeFieldIds = gradeFields.map((gf: any) => gf._id);
    const entries = gradeFieldIds.length > 0
      ? await GradeEntry.find({ grade_field: { $in: gradeFieldIds } }).lean()
      : [];

    const entryMap: Record<string, Record<string, any>> = {};
    for (const entry of entries as any[]) {
      const gfid = String(entry.grade_field);
      const sid = String(entry.user);
      if (!entryMap[gfid]) entryMap[gfid] = {};
      entryMap[gfid][sid] = entry;
    }

    // Group grade fields by subject
    const subjectMap: Record<string, { subject: any; fields: any[] }> = {};
    for (const gf of gradeFields as any[]) {
      if (!gf.subject) continue;
      const subjectId = String(gf.subject._id);
      if (!subjectMap[subjectId]) subjectMap[subjectId] = { subject: gf.subject, fields: [] };
      subjectMap[subjectId].fields.push(gf);
    }

    const subjects = Object.values(subjectMap).map((s) => s.subject);

    const studentRows = students.map((student: any) => {
      const sid = String(student._id);
      const totals: Record<string, number> = {};

      for (const [subjectId, { subject: subj, fields }] of Object.entries(subjectMap)) {
        let rawTotal = 0;
        for (const field of fields) {
          if (field.type === "moderation") {
            // Applies its raw value to every student directly — no entry, no weightage.
            const moderationValue = Number(field.value);
            if (!Number.isNaN(moderationValue)) rawTotal += moderationValue;
            continue;
          }
          const gfid = String(field._id);
          const entry = entryMap[gfid]?.[sid];
          if (entry) {
            rawTotal += (entry.mark / field.total_mark) * field.weightage;
          }
        }
        const cappedTotal = Math.min(rawTotal, subj.total_marks);
        totals[subjectId] = Math.round(cappedTotal * 100) / 100;
      }

      return { user: student, totals };
    });

    return reply.send({
      status_code: 200,
      message: "Grade summary fetched successfully",
      data: { subjects, students: studentRows },
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch grade summary",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ─── POST /academics/grade-entry/bulk-upsert ───────────────────────────────────
// Create-or-update in a single DB round trip via bulkWrite, so a teacher's grid
// save touches the DB once regardless of how many cells changed.

export const bulkUpsertGradeEntriesHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { entries } = request.body as BulkUpsertGradeEntriesBody;

    const requester = await User.findById(request.user.id);
    if (!requester) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }

    const gradeFieldIds = [...new Set(entries.map((e) => e.grade_field))];
    const gradeFields = await GradeField.find({ _id: { $in: gradeFieldIds } });
    const gradeFieldMap = new Map(gradeFields.map((gf) => [String(gf._id), gf]));

    // Every referenced grade field's batch must be within the requester's scope —
    // checked once per distinct batch, not per entry.
    const batchIds = [...new Set(gradeFields.map((gf) => String(gf.batch)))];
    for (const batchId of batchIds) {
      if (!(await isBatchInScope(requester, batchId))) {
        return reply.status(403).send({
          status_code: 403,
          message: "One or more grade fields belong to a batch outside your access scope",
          data: "",
        });
      }
    }

    const now = new Date();
    const ops: any[] = [];
    const rejected: Array<{ data: BulkUpsertGradeEntryItem; reason: string }> = [];

    for (const entryData of entries) {
      const gradeField = gradeFieldMap.get(entryData.grade_field);
      if (!gradeField) {
        rejected.push({ data: entryData, reason: "Grade field not found" });
        continue;
      }

      // Moderation fields apply their raw value to every student directly
      if (gradeField.type === "moderation") {
        rejected.push({ data: entryData, reason: "Grade entries are not needed for moderation fields" });
        continue;
      }

      const mark = entryData.is_absent ? 0 : entryData.mark;
      if (mark > gradeField.total_mark!) {
        rejected.push({
          data: entryData,
          reason: `Mark cannot exceed total mark of ${gradeField.total_mark}`,
        });
        continue;
      }

      ops.push({
        updateOne: {
          filter: { user: entryData.user, grade_field: entryData.grade_field },
          update: {
            $set: {
              mark,
              is_absent: entryData.is_absent,
              remarks: entryData.remarks ?? "",
              updated_at: now,
            },
            $setOnInsert: {
              _id: new mongoose.Types.ObjectId().toString(),
              user: entryData.user,
              grade_field: entryData.grade_field,
            },
          },
          upsert: true,
        },
      });
    }

    if (ops.length === 0) {
      return reply.status(422).send({
        status_code: 422,
        message: "No valid entries to save",
        data: { rejected },
      });
    }

    const result = await GradeEntry.bulkWrite(ops);

    const statusCode = rejected.length > 0 ? 207 : 200;
    return reply.status(statusCode).send({
      status_code: statusCode,
      message: `Bulk upsert completed. ${ops.length} saved, ${rejected.length} rejected.`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
        rejected,
      },
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to bulk upsert grade entries",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
