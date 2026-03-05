import { FastifyRequest, FastifyReply } from "fastify";
import { Subject } from "@/plugins/db/models/academics.model";

interface ListSubjectsQuery {
  page?: number;
  limit?: number;
  sem?: string;
  type?: "Theory" | "Practical";
}

interface GetSubjectParams {
  id: string;
}

interface CreateSubjectBody {
  name: string;
  sem: string;
  subject_code: string;
  type: "Theory" | "Practical";
  total_marks: number;
  pass_mark: number;
  faculty_in_charge?: string[];
}

interface UpdateSubjectParams {
  id: string;
}

interface UpdateSubjectBody {
  name?: string;
  sem?: string;
  subject_code?: string;
  type?: "Theory" | "Practical";
  total_marks?: number;
  pass_mark?: number;
  faculty_in_charge?: string[];
}

interface DeleteSubjectParams {
  id: string;
}

export const listSubjectsHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { page = 1, limit = 10, sem, type } = request.query as ListSubjectsQuery;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};
    if (sem) filter.sem = sem;
    if (type) filter.type = type;

    const subjects = await Subject.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ sem: 1, subject_code: 1 });

    const total = await Subject.countDocuments(filter);

    return reply.send({
      status_code: 200,
      message: "Subjects retrieved successfully",
      data: {
        subjects,
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
      message: "Failed to retrieve subjects",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getSubjectByIdHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as GetSubjectParams;

    const subject = await Subject.findById(id);

    if (!subject) {
      return reply.status(404).send({
        status_code: 404,
        message: "Subject not found",
        data: "",
      });
    }

    return reply.send({
      status_code: 200,
      message: "Subject retrieved successfully",
      data: subject,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to retrieve subject",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createSubjectHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { name, sem, subject_code, type, total_marks, pass_mark, faculty_in_charge } = request.body as CreateSubjectBody;

    // Validate that pass_mark is not greater than total_marks
    if (pass_mark > total_marks) {
      return reply.status(422).send({
        status_code: 422,
        message: "Pass mark cannot be greater than total marks",
        data: "",
      });
    }

    const subject = await Subject.create({
      name,
      sem,
      subject_code,
      type,
      total_marks,
      pass_mark,
      faculty_in_charge,
    });

    return reply.status(201).send({
      status_code: 201,
      message: "Subject created successfully",
      data: subject,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to create subject",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateSubjectHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as UpdateSubjectParams;
    const updateData = request.body as UpdateSubjectBody;

    // Check if subject exists
    const subject = await Subject.findById(id);
    if (!subject) {
      return reply.status(404).send({
        status_code: 404,
        message: "Subject not found",
        data: "",
      });
    }

    // Validate that pass_mark is not greater than total_marks
    const newTotalMarks = updateData.total_marks ?? subject.total_marks;
    const newPassMark = updateData.pass_mark ?? subject.pass_mark;

    if (newPassMark > newTotalMarks) {
      return reply.status(422).send({
        status_code: 422,
        message: "Pass mark cannot be greater than total marks",
        data: "",
      });
    }

    const updatedSubject = await Subject.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    return reply.send({
      status_code: 200,
      message: "Subject updated successfully",
      data: updatedSubject,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to update subject",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteSubjectHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as DeleteSubjectParams;

    const subject = await Subject.findByIdAndDelete(id);

    if (!subject) {
      return reply.status(404).send({
        status_code: 404,
        message: "Subject not found",
        data: "",
      });
    }

    return reply.send({
      status_code: 200,
      message: "Subject deleted successfully",
      data: subject,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to delete subject",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
