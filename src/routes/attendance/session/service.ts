import { FastifyRequest, FastifyReply } from "fastify";
import { AttendanceSession } from "@/plugins/db/models/attendance.model";
import { Teacher, User } from "@/plugins/db/models/auth.model";

export const createSession = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user.id;
    
    // Find the teacher associated with this user
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher) {
      return reply.status(404).send({
        status_code: 404,
        message: "Teacher profile not found",
        data: "",
      });
    }

    const { batch, subject, start_time, end_time, hours_taken, session_type } = request.body as {
      batch: string;
      subject: string;
      start_time: string;
      end_time: string;
      hours_taken: number;
      session_type: string;
    };

    const newSession = new AttendanceSession({
      batch,
      subject,
      created_by: teacher._id,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      hours_taken,
      session_type,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newSession.save();

    return reply.status(201).send({
      status_code: 201,
      message: "Attendance session created successfully",
      data: newSession,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to create attendance session",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getSession = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const sessionId = request.params.id;

    const session = await AttendanceSession.findById(sessionId)
      .populate("batch", "name code year")
      .populate("subject", "name code")
      .populate({
        path: "created_by",
        populate: {
          path: "user",
          select: "name email first_name last_name",
        },
      });

    if (!session) {
      return reply.status(404).send({
        status_code: 404,
        message: "Attendance session not found",
        data: "",
      });
    }

    return reply.send({
      status_code: 200,
      message: "Attendance session fetched successfully",
      data: session,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch attendance session",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const listSessions = async (
  request: FastifyRequest<{ 
    Querystring: { 
      page?: number; 
      limit?: number; 
      batch?: string;
      subject?: string;
      session_type?: string;
      from_date?: string;
      to_date?: string;
    } 
  }>,
  reply: FastifyReply
) => {
  try {
    const { page = 1, limit = 10, batch, subject, session_type, from_date, to_date } = request.query;

    // Build filter object
    const filter: any = {};
    
    if (batch) {
      filter.batch = batch;
    }
    
    if (subject) {
      filter.subject = subject;
    }
    
    if (session_type) {
      filter.session_type = session_type;
    }
    
    if (from_date || to_date) {
      filter.start_time = {};
      if (from_date) {
        filter.start_time.$gte = new Date(from_date);
      }
      if (to_date) {
        filter.start_time.$lte = new Date(to_date);
      }
    }

    const skip = (page - 1) * limit;

    const sessions = await AttendanceSession.find(filter)
      .populate("batch", "name code year")
      .populate("subject", "name code")
      .populate({
        path: "created_by",
        populate: {
          path: "user",
          select: "name email first_name last_name",
        },
      })
      .sort({ start_time: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AttendanceSession.countDocuments(filter);

    return reply.send({
      status_code: 200,
      message: "Attendance sessions fetched successfully",
      data: {
        sessions,
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
      message: "Failed to fetch attendance sessions",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getRecentSessions = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user.id;
    
    // Find the teacher associated with this user
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher) {
      return reply.status(404).send({
        status_code: 404,
        message: "Teacher profile not found",
        data: "",
      });
    }

    // Use aggregation to get unique batch-subject combinations
    const uniqueSessions = await AttendanceSession.aggregate([
      {
        $match: {
          created_by: teacher._id,
        },
      },
      {
        $group: {
          _id: {
            batch: "$batch",
            subject: "$subject",
          },
          sessionCount: { $sum: 1 },
          latestSession: { $max: "$start_time" },
        },
      },
      {
        $lookup: {
          from: "batch",
          localField: "_id.batch",
          foreignField: "_id",
          as: "batchInfo",
        },
      },
      {
        $lookup: {
          from: "subject",
          localField: "_id.subject",
          foreignField: "_id",
          as: "subjectInfo",
        },
      },
      {
        $unwind: {
          path: "$batchInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$subjectInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          batch: {
            _id: "$batchInfo._id",
            name: "$batchInfo.name",
            code: "$batchInfo.code",
            year: "$batchInfo.year",
          },
          subject: {
            _id: "$subjectInfo._id",
            name: "$subjectInfo.name",
            code: "$subjectInfo.code",
          },
          sessionCount: 1,
          latestSession: 1,
        },
      },
      {
        $sort: {
          latestSession: -1,
        },
      },
    ]);

    return reply.send({
      status_code: 200,
      message: "Recent sessions fetched successfully",
      data: uniqueSessions,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch recent sessions",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateSession = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const sessionId = request.params.id;
    const userId = request.user.id;

    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      return reply.status(404).send({
        status_code: 404,
        message: "Attendance session not found",
        data: "",
      });
    }

    // Check if user is the creator (unless admin/principal/hod)
    const teacher = await Teacher.findOne({ user: userId });
    if (
      teacher &&
      session.created_by.toString() !== teacher._id.toString() &&
      !["admin", "principal", "hod"].includes(request.user.role)
    ) {
      return reply.status(403).send({
        status_code: 403,
        message: "You are not authorized to update this session",
        data: "",
      });
    }

    const updateData = request.body as any;
    
    // Convert date strings to Date objects if provided
    if (updateData.start_time) {
      updateData.start_time = new Date(updateData.start_time);
    }
    if (updateData.end_time) {
      updateData.end_time = new Date(updateData.end_time);
    }
    
    updateData.updatedAt = new Date();

    const updatedSession = await AttendanceSession.findByIdAndUpdate(
      sessionId,
      updateData,
      { new: true }
    )
      .populate("batch", "name code year")
      .populate("subject", "name code")
      .populate({
        path: "created_by",
        populate: {
          path: "user",
          select: "name email first_name last_name",
        },
      });

    return reply.send({
      status_code: 200,
      message: "Attendance session updated successfully",
      data: updatedSession,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to update attendance session",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteSession = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const sessionId = request.params.id;
    const userId = request.user.id;

    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      return reply.status(404).send({
        status_code: 404,
        message: "Attendance session not found",
        data: "",
      });
    }

    // Check if user is the creator (unless admin/principal/hod)
    const teacher = await Teacher.findOne({ user: userId });
    if (
      teacher &&
      session.created_by.toString() !== teacher._id.toString() &&
      !["admin", "principal", "hod"].includes(request.user.role)
    ) {
      return reply.status(403).send({
        status_code: 403,
        message: "You are not authorized to delete this session",
        data: "",
      });
    }

    await AttendanceSession.findByIdAndDelete(sessionId);

    return reply.send({
      status_code: 200,
      message: "Attendance session deleted successfully",
      data: "",
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to delete attendance session",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
