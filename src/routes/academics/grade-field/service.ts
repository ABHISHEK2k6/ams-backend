import { FastifyRequest, FastifyReply } from "fastify";
import { GradeField } from "@/plugins/db/models/grade.models";
import { Batch, Subject } from "@/plugins/db/models/academics.model";

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
  total_mark: number;
  weightage: number;
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
    const { page = 1, limit = 10, batch, subject, type } = request.query as ListGradeFieldsQuery;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};
    if (batch) filter.batch = batch;
    if (subject) filter.subject = subject;
    if (type) filter.type = type;

    const gradeFields = await GradeField.find(filter)
      .populate("batch", "name adm_year department")
      .populate("subject", "_id sem subject_code type")
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

    // Validate weightage total doesn't exceed 100 for same batch/subject
    const existingFields = await GradeField.find({
      batch: gradeFieldData.batch,
      subject: gradeFieldData.subject,
    });

    const totalWeightage = existingFields.reduce((sum, field) => sum + field.weightage, 0) + gradeFieldData.weightage;
    if (totalWeightage > 100) {
      return reply.status(422).send({
        status_code: 422,
        message: `Total weightage would exceed 100%. Current total: ${totalWeightage - gradeFieldData.weightage}%, attempting to add: ${gradeFieldData.weightage}%`,
        data: "",
      });
    }

    const gradeField = await GradeField.create(gradeFieldData);

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
    if (updateData.weightage || updateData.batch || updateData.subject) {
      const targetBatch = updateData.batch ?? gradeField.batch;
      const targetSubject = updateData.subject ?? gradeField.subject;
      const newWeightage = updateData.weightage ?? gradeField.weightage;

      const existingFields = await GradeField.find({
        batch: targetBatch,
        subject: targetSubject,
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

    const gradeField = await GradeField.findByIdAndDelete(id);

    if (!gradeField) {
      return reply.status(404).send({
        status_code: 404,
        message: "Grade field not found",
        data: "",
      });
    }

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
