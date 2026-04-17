import { FastifyRequest, FastifyReply } from "fastify";
import { AttendanceRecord, AttendanceSession } from "@/plugins/db/models/attendance.model";

export const createRecord = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user.id;

    const { session, student, status, remarks } = request.body as {
      session: string;
      student: string;
      status: string;
      remarks?: string;
    };

    // Verify the session exists
    const attendanceSession = await AttendanceSession.findById(session);
    if (!attendanceSession) {
      return reply.status(404).send({
        status_code: 404,
        message: "Attendance session not found",
        data: "",
      });
    }

    // Check if record already exists for this student and session
    const existingRecord = await AttendanceRecord.findOne({ session, student });
    if (existingRecord) {
      return reply.status(422).send({
        status_code: 422,
        message: "Attendance record already exists for this student in this session",
        data: "",
      });
    }

    const newRecord = new AttendanceRecord({
      session,
      student,
      marked_by: userId,
      status,
      remarks: remarks || "",
      marked_at: new Date(),
    });

    await newRecord.save();

    return reply.status(201).send({
      status_code: 201,
      message: "Attendance record created successfully",
      data: newRecord,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to create attendance record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createBulkRecords = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user.id;

    const { session, records } = request.body as {
      session: string;
      records: Array<{ student: string; status: string; remarks?: string }>;
    };

    // Verify the session exists
    const attendanceSession = await AttendanceSession.findById(session);
    if (!attendanceSession) {
      return reply.status(404).send({
        status_code: 404,
        message: "Attendance session not found",
        data: "",
      });
    }

    const currentTime = new Date();
    const createdRecords = [];
    const errors = [];

    for (const record of records) {
      const existingRecord = await AttendanceRecord.findOne({
        session,
        student: record.student,
      });

      if (existingRecord) {
        errors.push({ student: record.student, message: "Record already exists" });
        continue;
      }

      const newRecord = new AttendanceRecord({
        session,
        student:   record.student,
        marked_by: userId,
        status:    record.status,
        remarks:   record.remarks || "",
        marked_at: currentTime,
      });

      await newRecord.save();
      createdRecords.push(newRecord);
    }

    return reply.status(201).send({
      status_code: 201,
      message: `Successfully created ${createdRecords.length} attendance records`,
      data: { created: createdRecords, errors: errors.length > 0 ? errors : undefined },
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to create bulk attendance records",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getRecord = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const recordId = request.params.id;
    const userId = request.user.id;
    const userRole = request.user.role;

    const record = await AttendanceRecord.findById(recordId)
      .populate("student", "name email first_name last_name")
      .populate({
        path: "session",
        populate: [
          { path: "batch", select: "name code year" },
          { path: "subject", select: "name code" },
        ],
      })
      .populate("marked_by", "name email first_name last_name");

    if (!record) {
      return reply.status(404).send({
        status_code: 404,
        message: "Attendance record not found",
        data: "",
      });
    }

    // Students can view only their own attendance record.
    if (userRole === "student" && record.student.toString() !== userId.toString()) {
      return reply.status(403).send({
        status_code: 403,
        message: "You are not authorized to view this attendance record",
        data: "",
      });
    }

    return reply.send({
      status_code: 200,
      message: "Attendance record fetched successfully",
      data: record,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch attendance record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const listRecords = async (
  request: FastifyRequest<{ 
    Querystring: { 
      page?: number; 
      limit?: number; 
      session?: string;
      student?: string;
      status?: string;
      from_date?: string;
      to_date?: string;
    } 
  }>,
  reply: FastifyReply
) => {
  try {
    const userId = request.user.id;
    const userRole = request.user.role;
    const { page = 1, limit = 10, session, student, status, from_date, to_date } = request.query;

    // Build filter object
    const filter: any = {};
    
    if (session) {
      filter.session = session;
    }
    
    if (student) {
      filter.student = student;
    }

    // Students can list only their own attendance records.
    if (userRole === "student") {
      filter.student = userId;
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (from_date || to_date) {
      filter.marked_at = {};
      if (from_date) {
        filter.marked_at.$gte = new Date(from_date);
      }
      if (to_date) {
        filter.marked_at.$lte = new Date(to_date);
      }
    }

    const skip = (page - 1) * limit;

    const records = await AttendanceRecord.find(filter)
      .populate("student", "name email first_name last_name")
      .populate({
        path: "session",
        populate: [
          { path: "batch", select: "name code year" },
          { path: "subject", select: "name code" },
        ],
      })
      .populate("marked_by", "name email first_name last_name")
      .sort({ marked_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AttendanceRecord.countDocuments(filter);

    return reply.send({
      status_code: 200,
      message: "Attendance records fetched successfully",
      data: {
        records,
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
      message: "Failed to fetch attendance records",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateRecord = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const recordId = request.params.id;
    const userId = request.user.id;

    const record = await AttendanceRecord.findById(recordId);
    if (!record) {
      return reply.status(404).send({
        status_code: 404,
        message: "Attendance record not found",
        data: "",
      });
    }

    // Check authorization: requestor must be the marker OR have admin privileges
    if (
      record.marked_by.toString() !== userId.toString() &&
      !["admin", "principal", "hod"].includes(request.user.role)
    ) {
      return reply.status(403).send({
        status_code: 403,
        message: "You are not authorized to update this record",
        data: "",
      });
    }

    const updateData = request.body as any;

    const updatedRecord = await AttendanceRecord.findByIdAndUpdate(
      recordId,
      updateData,
      { new: true }
    )
      .populate("student", "name email first_name last_name")
      .populate({
        path: "session",
        populate: [
          { path: "batch", select: "name code year" },
          { path: "subject", select: "name code" },
        ],
      })
      .populate("marked_by", "name email first_name last_name");

    return reply.send({
      status_code: 200,
      message: "Attendance record updated successfully",
      data: updatedRecord,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to update attendance record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteRecord = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const recordId = request.params.id;
    const userId = request.user.id;

    const record = await AttendanceRecord.findById(recordId);
    if (!record) {
      return reply.status(404).send({
        status_code: 404,
        message: "Attendance record not found",
        data: "",
      });
    }

    // Check authorization: requestor must be the marker OR have admin privileges
    if (
      record.marked_by.toString() !== userId.toString() &&
      !["admin", "principal", "hod"].includes(request.user.role)
    ) {
      return reply.status(403).send({
        status_code: 403,
        message: "You are not authorized to delete this record",
        data: "",
      });
    }

    await AttendanceRecord.findByIdAndDelete(recordId);

    return reply.send({
      status_code: 200,
      message: "Attendance record deleted successfully",
      data: "",
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to delete attendance record",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
