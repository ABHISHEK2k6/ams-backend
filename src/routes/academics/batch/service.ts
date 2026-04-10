import { FastifyRequest, FastifyReply } from "fastify";
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

    const batch = await Batch.findById(id).populate({
      path: "staff_advisor",
      populate: {
        path: "user",
        select: "first_name last_name email",
      },
    });

    if (!batch) {
      return reply.status(404).send({
        status_code: 404,
        message: "Batch not found",
        data: "",
      });
    }

    return reply.send({
      status_code: 200,
      message: "Batch retrieved successfully",
      data: batch,
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
    const { name, adm_year, department, staff_advisor, id } =
      request.body as CreateBatchBody;
    const batchId = (id || generateBatchId(adm_year, department)).toUpperCase();

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

    const populatedBatch = await Batch.findById(batch._id).populate({
      path: "staff_advisor",
      populate: {
        path: "user",
        select: "first_name last_name email",
      },
    });

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

    if (updateData.id) {
      updateData.id = updateData.id.toUpperCase();
    }

    // Check if batch exists
    const batch = await Batch.findById(id);
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
        _id: { $ne: id },
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
        _id: { $ne: id },
      });

      if (existingBatchId) {
        return reply.status(422).send({
          status_code: 422,
          message: "Batch with this ID already exists",
          data: "",
        });
      }
    }

    const updatedBatch = await Batch.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate({
      path: "staff_advisor",
      populate: {
        path: "user",
        select: "first_name last_name email",
      },
    });

    return reply.send({
      status_code: 200,
      message: "Batch updated successfully",
      data: updatedBatch,
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

    const batch = await Batch.findByIdAndDelete(id);

    if (!batch) {
      return reply.status(404).send({
        status_code: 404,
        message: "Batch not found",
        data: "",
      });
    }

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
