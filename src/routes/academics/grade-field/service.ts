import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { GradeField, GradeEntry } from "@/plugins/db/models/grade.models";
import { Batch, Subject } from "@/plugins/db/models/academics.model";
import { AttendanceSession } from "@/plugins/db/models/attendance.model";
import { User } from "@/plugins/db/models/auth.model";
import { getScopeBatchFilter } from "@/lib/scope";

const ATTENDED_STATUSES = ["present", "late"];

/**
 * Computes every student's attendance percentage for a batch+subject (across
 * all attendance sessions taken so far) and scales it onto `totalMark`.
 * Students with no attendance sessions recorded yet default to 0%.
 */
async function computeAttendanceMarks(
  batchId: string,
  subjectId: string,
  totalMark: number
): Promise<Array<{ user: string; mark: number; attended: number; total: number }>> {
  const attendanceRows = await AttendanceSession.aggregate([
    { $match: { batch: new mongoose.Types.ObjectId(batchId), subject: new mongoose.Types.ObjectId(subjectId) } },
    { $unwind: "$records" },
    {
      $group: {
        _id: "$records.student",
        total: { $sum: 1 },
        attended: { $sum: { $cond: [{ $in: ["$records.status", ATTENDED_STATUSES] }, 1, 0] } },
      },
    },
  ]);

  const countsByStudent = new Map<string, { attended: number; total: number }>();
  for (const row of attendanceRows) {
    countsByStudent.set(String(row._id), { attended: row.attended, total: row.total });
  }

  const students = await User.find({
    role: "student",
    "profile.batch": { $in: [new mongoose.Types.ObjectId(batchId), batchId] },
  })
    .select("_id")
    .lean();

  return students.map((student: any) => {
    const { attended, total } = countsByStudent.get(String(student._id)) ?? { attended: 0, total: 0 };
    const percentage = total > 0 ? (attended / total) * 100 : 0;
    const mark = Math.round((percentage / 100) * totalMark * 100) / 100;
    return { user: String(student._id), mark, attended, total };
  });
}

/** Writes computed attendance marks as GradeEntry rows in one bulkWrite — creates or overwrites. */
async function syncAttendanceEntries(gradeField: { _id: unknown; batch: unknown; subject: unknown; total_mark?: number | null }): Promise<number> {
  const marks = await computeAttendanceMarks(String(gradeField.batch), String(gradeField.subject), gradeField.total_mark ?? 0);
  if (marks.length === 0) return 0;

  const now = new Date();
  const ops = marks.map(({ user, mark, attended, total }) => ({
    updateOne: {
      filter: { user, grade_field: gradeField._id },
      update: {
        // remarks records the classes attended out of total this mark was
        // calculated from (e.g. "7/10"), shown alongside the mark in the UI.
        $set: { mark, is_absent: false, remarks: `${attended}/${total}`, updated_at: now },
        $setOnInsert: { _id: new mongoose.Types.ObjectId().toString(), user, grade_field: gradeField._id },
      },
      upsert: true,
    },
  }));

  await GradeEntry.bulkWrite(ops);
  return ops.length;
}

/**
 * Resolves the batch a student/parent is allowed to see grade fields for —
 * their own batch, or their linked child's batch for a parent. Returns null
 * if the role isn't self-scoped (staff roles pass through unrestricted) or
 * if no batch can be resolved (e.g. parent with no linked child yet).
 */
async function resolveSelfScopedBatch(requester: { role: string; profile?: any }): Promise<string | null | undefined> {
  if (requester.role === "student") {
    return requester.profile?.batch ? String(requester.profile.batch) : null;
  }
  if (requester.role === "parent") {
    const childId = requester.profile?.child;
    if (!childId) return null;
    const child = await User.findById(childId).select("profile.batch").lean();
    const childBatch = (child as any)?.profile?.batch;
    return childBatch ? String(childBatch) : null;
  }
  return undefined; // not a self-scoped role — staff behavior unchanged
}

interface ListGradeFieldsQuery {
  page?: number;
  limit?: number;
  batch?: string;
  subject?: string;
  type?: "exam" | "assignment" | "practical" | "attendance" | "moderation";
}

interface GetGradeFieldParams {
  id: string;
}

interface CreateGradeFieldBody {
  _id?: string;
  batch: string;
  subject: string;
  type: "exam" | "assignment" | "practical" | "attendance" | "moderation";
  name: string;
  /** Required for every type except moderation (which applies its raw `value` directly, uncapped). */
  total_mark?: number;
  /** Optional — if omitted, weightage is split equally across all fields for this batch+subject. */
  weightage?: number;
  /** Whether students/parents can see this field yet. Defaults to false (draft). */
  published?: boolean;
  value?: string;
  description?: string;
  due_date?: string;
}

interface UpdateGradeFieldParams {
  id: string;
}

interface UpdateGradeFieldBody {
  batch?: string;
  subject?: string;
  type?: "exam" | "assignment" | "practical" | "attendance" | "moderation";
  name?: string;
  total_mark?: number;
  weightage?: number;
  published?: boolean;
  value?: string;
  description?: string;
  due_date?: string;
}

interface DeleteGradeFieldParams {
  id: string;
}

export const listGradeFieldsHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { page = 1, limit = 10, subject, type } = request.query as ListGradeFieldsQuery;
    let { batch } = request.query as ListGradeFieldsQuery;
    const skip = (page - 1) * limit;

    const requester = await User.findById(request.user.id).lean();
    if (!requester) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }

    const selfScopedBatch = await resolveSelfScopedBatch(requester as any);
    if (selfScopedBatch !== undefined) {
      // Student/parent — batch is forced to their own (or their child's), never client-supplied.
      if (!selfScopedBatch) {
        return reply.send({
          status_code: 200,
          message: "Grade fields retrieved successfully",
          data: { gradeFields: [], pagination: { page, limit, total: 0, totalPages: 0 } },
        });
      }
      batch = selfScopedBatch;
    }

    // Build filter
    const filter: any = {};
    if (batch) filter.batch = batch;
    if (subject) filter.subject = subject;
    if (type) filter.type = type;
    // Student/parent only ever see fields the teacher has published — staff
    // (who can see selfScopedBatch === undefined) always see everything, drafts included.
    if (selfScopedBatch !== undefined) filter.published = true;

    const gradeFields = await GradeField.find(filter)
      .populate("batch", "name adm_year department")
      .populate("subject", "_id name sem subject_code type total_marks")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await GradeField.countDocuments(filter);

    return reply.send({
      status_code: 200,
      message: "Grade fields retrieved successfully",
      data: {
        gradeFields,
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
      message: "Failed to retrieve grade fields",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getGradeFieldByIdHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as GetGradeFieldParams;

    const gradeField = await GradeField.findById(id)
      .populate("batch", "name adm_year department")
      .populate("subject", "_id sem subject_code type");

    if (!gradeField) {
      return reply.status(404).send({
        status_code: 404,
        message: "Grade field not found",
        data: "",
      });
    }

    return reply.send({
      status_code: 200,
      message: "Grade field retrieved successfully",
      data: gradeField,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to retrieve grade field",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createGradeFieldHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const gradeFieldData = request.body as CreateGradeFieldBody;

    // Validate batch exists
    const batch = await Batch.findById(gradeFieldData.batch);
    if (!batch) {
      return reply.status(404).send({
        status_code: 404,
        message: "Batch not found",
        data: "",
      });
    }

    // Validate subject exists
    const subject = await Subject.findById(gradeFieldData.subject);
    if (!subject) {
      return reply.status(404).send({
        status_code: 404,
        message: "Subject not found",
        data: "",
      });
    }

    // Validate moderation type has value
    if (gradeFieldData.type === "moderation" && !gradeFieldData.value) {
      return reply.status(422).send({
        status_code: 422,
        message: "Value is required for moderation type",
        data: "",
      });
    }

    // total_mark doesn't apply to moderation fields (they apply their raw
    // `value` directly) — required for every other type.
    if (gradeFieldData.type !== "moderation" && (gradeFieldData.total_mark === undefined || gradeFieldData.total_mark === null)) {
      return reply.status(422).send({
        status_code: 422,
        message: "Total mark is required for this type",
        data: "",
      });
    }

    let weightage: number;
    let total_mark: number | undefined;

    if (gradeFieldData.type === "moderation") {
      // Moderation fields apply their raw value to every student directly —
      // they don't consume from the batch+subject's 100%-weightage pool, and
      // have no max mark of their own.
      weightage = 0;
      total_mark = undefined;
    } else {
      total_mark = gradeFieldData.total_mark;

      // Only non-moderation fields participate in the weightage pool.
      const existingFields = await GradeField.find({
        batch: gradeFieldData.batch,
        subject: gradeFieldData.subject,
        type: { $ne: "moderation" },
      });

      weightage = gradeFieldData.weightage as number;

      if (weightage === undefined || weightage === null) {
        // No weightage supplied — split evenly across all fields (existing + this
        // one) for this batch+subject, for now, and rebalance the existing ones to match.
        const equalShare = Math.round((100 / (existingFields.length + 1)) * 100) / 100;
        weightage = equalShare;
        if (existingFields.length > 0) {
          await GradeField.updateMany(
            { _id: { $in: existingFields.map((f) => f._id) } },
            { $set: { weightage: equalShare } }
          );
        }
      } else {
        // Explicit weightage — validate the total still doesn't exceed 100%.
        const totalWeightage = existingFields.reduce((sum, field) => sum + field.weightage, 0) + weightage;
        if (totalWeightage > 100) {
          return reply.status(422).send({
            status_code: 422,
            message: `Total weightage would exceed 100%. Current total: ${totalWeightage - weightage}%, attempting to add: ${weightage}%`,
            data: "",
          });
        }
      }
    }

    const gradeField = await GradeField.create({ ...gradeFieldData, weightage, total_mark });

    // Attendance fields are auto-populated from existing attendance sessions
    // the moment they're created — no manual entry needed to start.
    if (gradeField.type === "attendance") {
      await syncAttendanceEntries(gradeField);
    }

    const populatedGradeField = await GradeField.findById(gradeField._id)
      .populate("batch", "name adm_year department")
      .populate("subject", "_id sem subject_code type");

    return reply.status(201).send({
      status_code: 201,
      message: "Grade field created successfully",
      data: populatedGradeField,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to create grade field",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateGradeFieldHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as UpdateGradeFieldParams;
    const updateData = request.body as UpdateGradeFieldBody;

    // Check if grade field exists
    const gradeField = await GradeField.findById(id);
    if (!gradeField) {
      return reply.status(404).send({
        status_code: 404,
        message: "Grade field not found",
        data: "",
      });
    }

    // Validate batch if provided
    if (updateData.batch) {
      const batch = await Batch.findById(updateData.batch);
      if (!batch) {
        return reply.status(404).send({
          status_code: 404,
          message: "Batch not found",
          data: "",
        });
      }
    }

    // Validate subject if provided
    if (updateData.subject) {
      const subject = await Subject.findById(updateData.subject);
      if (!subject) {
        return reply.status(404).send({
          status_code: 404,
          message: "Subject not found",
          data: "",
        });
      }
    }

    // Validate moderation type has value
    const newType = updateData.type ?? gradeField.type;
    const newValue = updateData.value ?? gradeField.value;
    if (newType === "moderation" && !newValue) {
      return reply.status(422).send({
        status_code: 422,
        message: "Value is required for moderation type",
        data: "",
      });
    }

    // Validate weightage total if weightage, batch, or subject is being updated
    // — moderation fields don't participate in the weightage pool at all.
    if (newType !== "moderation" && (updateData.weightage || updateData.batch || updateData.subject)) {
      const targetBatch = updateData.batch ?? gradeField.batch;
      const targetSubject = updateData.subject ?? gradeField.subject;
      const newWeightage = updateData.weightage ?? gradeField.weightage;

      const existingFields = await GradeField.find({
        batch: targetBatch,
        subject: targetSubject,
        type: { $ne: "moderation" },
        _id: { $ne: id },
      });

      const totalWeightage = existingFields.reduce((sum, field) => sum + field.weightage, 0) + newWeightage;
      if (totalWeightage > 100) {
        return reply.status(422).send({
          status_code: 422,
          message: `Total weightage would exceed 100%. Current total: ${totalWeightage - newWeightage}%, attempting to set: ${newWeightage}%`,
          data: "",
        });
      }
    }

    const updatedGradeField = await GradeField.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("batch", "name adm_year department")
      .populate("subject", "_id sem subject_code type");

    return reply.send({
      status_code: 200,
      message: "Grade field updated successfully",
      data: updatedGradeField,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to update grade field",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteGradeFieldHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as DeleteGradeFieldParams;

    const gradeField = await GradeField.findById(id);
    if (!gradeField) {
      return reply.status(404).send({
        status_code: 404,
        message: "Grade field not found",
        data: "",
      });
    }

    // A teacher/hod may only delete columns for a batch within their own scope
    // (admin/principal are unrestricted) — same rule as the grade-entry endpoints.
    const requester = await User.findById(request.user.id);
    if (!requester) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }
    if (requester.role !== "admin") {
      const scopeFilter = getScopeBatchFilter(requester);
      const inScope = await Batch.exists({ _id: gradeField.batch, ...scopeFilter });
      if (!inScope) {
        return reply.status(403).send({
          status_code: 403,
          message: "This batch is outside your access scope",
          data: "",
        });
      }
    }

    await GradeField.findByIdAndDelete(id);
    // Cascade: entries for a deleted column are meaningless without it.
    await GradeEntry.deleteMany({ grade_field: id });

    return reply.send({
      status_code: 200,
      message: "Grade field deleted successfully",
      data: gradeField,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to delete grade field",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

interface SyncAttendanceGradeFieldParams {
  id: string;
}

// ─── POST /academics/grade-field/:id/sync-attendance ───────────────────────────
// Re-pulls attendance for this field's batch+subject and overwrites every
// student's entry — used by the grid's refresh icon on attendance-type columns.
export const syncAttendanceGradeFieldHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as SyncAttendanceGradeFieldParams;

    const gradeField = await GradeField.findById(id);
    if (!gradeField) {
      return reply.status(404).send({ status_code: 404, message: "Grade field not found", data: "" });
    }

    if (gradeField.type !== "attendance") {
      return reply.status(422).send({
        status_code: 422,
        message: "Only attendance-type grade fields can be synced from attendance records",
        data: "",
      });
    }

    const requester = await User.findById(request.user.id);
    if (!requester) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }
    if (requester.role !== "admin") {
      const scopeFilter = getScopeBatchFilter(requester);
      const inScope = await Batch.exists({ _id: gradeField.batch, ...scopeFilter });
      if (!inScope) {
        return reply.status(403).send({
          status_code: 403,
          message: "This batch is outside your access scope",
          data: "",
        });
      }
    }

    const count = await syncAttendanceEntries(gradeField);

    return reply.send({
      status_code: 200,
      message: `Attendance synced for ${count} student(s)`,
      data: { count },
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to sync attendance",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
