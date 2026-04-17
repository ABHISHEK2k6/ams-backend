import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { Batch } from "@/plugins/db/models/academics.model";
import { User } from "@/plugins/db/models/auth.model";

interface ListBatchesQuery {
  page?: number;
  limit?: number;
  department?: "CSE" | "ECE" | "IT";
  adm_year?: number;
}

interface GetBatchParams {
  id: string;
}

interface CreateBatchBody {
  name: string;
  id?: string;
  batch_id?: string;
  adm_year: number;
  department: "CSE" | "ECE" | "IT";
  staff_advisor: string;
}

interface UpdateBatchParams {
  id: string;
}

interface UpdateBatchBody {
  name?: string;
  id?: string;
  batch_id?: string;
  adm_year?: number;
  department?: "CSE" | "ECE" | "IT";
  staff_advisor?: string;
}

interface DeleteBatchParams {
  id: string;
}

const generateBatchId = (admYear: number, department: string) => {
  const yearSuffix = String(admYear).slice(-2).padStart(2, "0");
  return `${yearSuffix}${department.toUpperCase()}`;
};

const BATCH_ID_REGEX = /^[0-9]{2}[A-Z]{2,3}[0-9]*$/;

const normalizeBatchId = (value?: string) => {
  if (!value) return undefined;
  return value.trim().toUpperCase();
};

const findBatchByRouteId = async (routeId: string) => {
  const trimmedId = routeId.trim();
  if (mongoose.isValidObjectId(trimmedId)) {
    const byObjectId = await Batch.findById(trimmedId);
    if (byObjectId) return byObjectId;
  }

  return Batch.findOne({ id: trimmedId.toUpperCase() });
};

export const listBatchesHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { page = 1, limit = 10, department, adm_year } = request.query as ListBatchesQuery;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};
    if (department) filter.department = department;
    if (adm_year) filter.adm_year = adm_year;

    const batches = await Batch.find(filter)
      .populate("staff_advisor", "first_name last_name name email role")
      .skip(skip)
      .limit(limit)
      .sort({ adm_year: -1, name: 1 });

    const total = await Batch.countDocuments(filter);

    return reply.send({
      status_code: 200,
      message: "Batches retrieved successfully",
      data: {
        batches,
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
      message: "Failed to retrieve batches",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getBatchByIdHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as GetBatchParams;

    const batch = await findBatchByRouteId(id);

    if (!batch) {
      return reply.status(404).send({
        status_code: 404,
        message: "Batch not found",
        data: "",
      });
    }

    const populatedBatch = await Batch.findById(batch._id).populate(
      "staff_advisor",
      "first_name last_name name email role"
    );

    return reply.send({
      status_code: 200,
      message: "Batch retrieved successfully",
      data: populatedBatch,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to retrieve batch",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createBatchHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { name, adm_year, department, staff_advisor, id, batch_id } =
      request.body as CreateBatchBody;
    const requestedId = normalizeBatchId(id || batch_id);
    const batchId = requestedId || generateBatchId(adm_year, department);

    if (!BATCH_ID_REGEX.test(batchId)) {
      return reply.status(422).send({
        status_code: 422,
        message: "Invalid batch ID format. Expected YY[A-Z]{2,3} with optional numeric suffix (e.g., 24CSE1)",
        data: "",
      });
    }

    // Check if staff advisor user exists and is a staff role
    const staffUser = await User.findById(staff_advisor);
    if (!staffUser || !['teacher','hod','principal','admin','staff'].includes(staffUser.role)) {
      return reply.status(404).send({
        status_code: 404,
        message: "Staff advisor not found or not a staff role",
        data: "",
      });
    }

    // Check if batch with same name and year already exists
    const existingBatch = await Batch.findOne({ name, adm_year });
    if (existingBatch) {
      return reply.status(422).send({
        status_code: 422,
        message: "Batch with this name and admission year already exists",
        data: "",
      });
    }

    const existingBatchId = await Batch.findOne({ id: batchId });
    if (existingBatchId) {
      return reply.status(422).send({
        status_code: 422,
        message: "Batch with this ID already exists",
        data: "",
      });
    }

    const batch = await Batch.create({
      name,
      id: batchId,
      adm_year,
      department,
      staff_advisor,
    });

    const populatedBatch = await Batch.findById(batch._id).populate(
      "staff_advisor",
      "first_name last_name name email role"
    );

    return reply.status(201).send({
      status_code: 201,
      message: "Batch created successfully",
      data: populatedBatch,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to create batch",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateBatchHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as UpdateBatchParams;
    const updateData = request.body as UpdateBatchBody;

    const requestedId = normalizeBatchId(updateData.id || updateData.batch_id);
    delete updateData.batch_id;

    if (requestedId) {
      if (!BATCH_ID_REGEX.test(requestedId)) {
        return reply.status(422).send({
          status_code: 422,
          message: "Invalid batch ID format. Expected YY[A-Z]{2,3} with optional numeric suffix (e.g., 24CSE1)",
          data: "",
        });
      }

      updateData.id = requestedId;
    }

    // Check if batch exists
    const batch = await findBatchByRouteId(id);
    if (!batch) {
      return reply.status(404).send({
        status_code: 404,
        message: "Batch not found",
        data: "",
      });
    }

    // If updating staff advisor, check if user exists and is a staff role
    if (updateData.staff_advisor) {
      const staffUser = await User.findById(updateData.staff_advisor);
      if (!staffUser || !['teacher','hod','principal','admin','staff'].includes(staffUser.role)) {
        return reply.status(404).send({
          status_code: 404,
          message: "Staff advisor not found or not a staff role",
          data: "",
        });
      }
    }

    // Check if updating to a name/year combination that already exists
    if (updateData.name || updateData.adm_year) {
      const nameToCheck = updateData.name || batch.name;
      const yearToCheck = updateData.adm_year || batch.adm_year;
      
      const existingBatch = await Batch.findOne({
        name: nameToCheck,
        adm_year: yearToCheck,
        _id: { $ne: batch._id },
      });

      if (existingBatch) {
        return reply.status(422).send({
          status_code: 422,
          message: "Batch with this name and admission year already exists",
          data: "",
        });
      }
    }

    if (updateData.id) {
      const existingBatchId = await Batch.findOne({
        id: updateData.id,
        _id: { $ne: batch._id },
      });

      if (existingBatchId) {
        return reply.status(422).send({
          status_code: 422,
          message: "Batch with this ID already exists",
          data: "",
        });
      }
    }

    const updatedBatch = await Batch.findByIdAndUpdate(batch._id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedBatch) {
      return reply.status(404).send({
        status_code: 404,
        message: "Batch not found",
        data: "",
      });
    }

    let responseBatch = updatedBatch;
    try {
      const populatedBatch = await Batch.findById(updatedBatch._id).populate(
        "staff_advisor",
        "first_name last_name name email role"
      );

      if (populatedBatch) {
        responseBatch = populatedBatch;
      }
    } catch (populateError) {
      request.log.warn(
        {
          err: populateError,
          batchId: updatedBatch._id,
        },
        "Batch updated successfully but staff_advisor populate failed; returning unpopulated document"
      );
    }

    return reply.send({
      status_code: 200,
      message: "Batch updated successfully",
      data: responseBatch,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to update batch",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteBatchHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as DeleteBatchParams;

    const batchToDelete = await findBatchByRouteId(id);
    if (!batchToDelete) {
      return reply.status(404).send({
        status_code: 404,
        message: "Batch not found",
        data: "",
      });
    }

    const batch = await Batch.findByIdAndDelete(batchToDelete._id);

    return reply.send({
      status_code: 200,
      message: "Batch deleted successfully",
      data: batch,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to delete batch",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
