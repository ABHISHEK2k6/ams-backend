import { FastifyRequest, FastifyReply } from "fastify";
import { AttendanceSession } from "@/plugins/db/models/attendance.model";
import mongoose from "mongoose";

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
    const existingRecord = attendanceSession.records.find((r: any) => r.student.toString() === student);
    if (existingRecord) {
      return reply.status(422).send({
        status_code: 422,
        message: "Attendance record already exists for this student in this session",
        data: "",
      });
    }

    const newRecordData = {
      _id: new mongoose.Types.ObjectId(),
      student: new mongoose.Types.ObjectId(student),
      status,
      remarks: remarks || "",
      marked_at: new Date(),
    };

    await AttendanceSession.findByIdAndUpdate(
      session,
      { $push: { records: newRecordData } }
    );

    return reply.status(201).send({
      status_code: 201,
      message: "Attendance record created successfully",
      data: newRecordData,
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

    const existingStudentIds = attendanceSession.records.map((r: any) => r.student.toString());

    for (const record of records) {
      if (existingStudentIds.includes(record.student)) {
        errors.push({ student: record.student, message: "Record already exists" });
        continue;
      }

      const newRecord = {
        _id: new mongoose.Types.ObjectId(),
        student: new mongoose.Types.ObjectId(record.student),
        status: record.status,
        remarks: record.remarks || "",
        marked_at: currentTime,
      };

      createdRecords.push(newRecord);
    }

    if (createdRecords.length > 0) {
      await AttendanceSession.findByIdAndUpdate(
        session,
        { $push: { records: { $each: createdRecords } } }
      );
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

    const sessionDoc = await AttendanceSession.findOne({ "records._id": new mongoose.Types.ObjectId(recordId) })
      .populate("records.student", "name email first_name last_name")
      .populate("batch", "name code year")
      .populate("subject", "name code");

    if (!sessionDoc) {
      return reply.status(404).send({
        status_code: 404,
        message: "Attendance record not found",
        data: "",
      });
    }

    const record = (sessionDoc as any).records.id(recordId);

    // Students can view only their own attendance record.
    if (userRole === "student" && record.student._id.toString() !== userId.toString()) {
      return reply.status(403).send({
        status_code: 403,
        message: "You are not authorized to view this attendance record",
        data: "",
      });
    }

    const responseRecord = {
      _id: record._id,
      student: record.student,
      status: record.status,
      remarks: record.remarks,
      marked_at: record.marked_at,
      session: {
        _id: sessionDoc._id,
        batch: sessionDoc.batch,
        subject: sessionDoc.subject,
      }
    };

    return reply.send({
      status_code: 200,
      message: "Attendance record fetched successfully",
      data: responseRecord,
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
      subject?: string;
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
    const { page = 1, limit = 10, session, student, subject, status, from_date, to_date } = request.query;

    const pipeline: any[] = [];

    if (session) {
      if (!mongoose.Types.ObjectId.isValid(session)) {
          return reply.status(400).send({
              status_code: 400,
              message: "Invalid session ID format",
              data: ""
          });
      }
      pipeline.push({ $match: { _id: new mongoose.Types.ObjectId(session) } });
    }

    if (subject) {
      if (!mongoose.Types.ObjectId.isValid(subject)) {
          return reply.status(400).send({
              status_code: 400,
              message: "Invalid subject ID format",
              data: ""
          });
      }
      pipeline.push({ $match: { subject: new mongoose.Types.ObjectId(subject) } });
    }

    pipeline.push({ $unwind: "$records" });

    const recordMatch: any = {};
    if (student) {
        if (!mongoose.Types.ObjectId.isValid(student)) {
            return reply.status(400).send({
                status_code: 400,
                message: "Invalid student ID format",
                data: ""
            });
        }
        recordMatch["records.student"] = new mongoose.Types.ObjectId(student);
    }
    
    // Students can list only their own attendance records.
    if (userRole === "student") {
      recordMatch["records.student"] = new mongoose.Types.ObjectId(userId);
    }
    
    if (status) {
      recordMatch["records.status"] = status;
    }
    
    if (from_date || to_date) {
      recordMatch["records.marked_at"] = {};
      if (from_date) {
        recordMatch["records.marked_at"].$gte = new Date(from_date);
      }
      if (to_date) {
        recordMatch["records.marked_at"].$lte = new Date(to_date);
      }
    }

    if (Object.keys(recordMatch).length > 0) {
      pipeline.push({ $match: recordMatch });
    }

    pipeline.push({ $sort: { "records.marked_at": -1 } });

    const skip = (page - 1) * limit;

    const dataPipeline = [
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "records.student",
          foreignField: "_id",
          as: "studentInfo"
        }
      },
      {
        $lookup: {
          from: "batch",
          localField: "batch",
          foreignField: "_id",
          as: "batchInfo"
        }
      },
      {
        $lookup: {
          from: "subject",
          localField: "subject",
          foreignField: "_id",
          as: "subjectInfo"
        }
      },
      { $unwind: { path: "$studentInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$batchInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$subjectInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: "$records._id",
          student: {
             _id: "$studentInfo._id",
             name: "$studentInfo.name",
             email: "$studentInfo.email",
             first_name: "$studentInfo.first_name",
             last_name: "$studentInfo.last_name"
          },
          session: {
             _id: "$_id",
             batch: { _id: "$batchInfo._id", name: "$batchInfo.name", code: "$batchInfo.code", year: "$batchInfo.year" },
             subject: { _id: "$subjectInfo._id", name: "$subjectInfo.name", code: "$subjectInfo.code" }
          },
          status: "$records.status",
          remarks: "$records.remarks",
          marked_at: "$records.marked_at"
        }
      }
    ];

    pipeline.push({
      $facet: {
        totalData: [{ $count: "count" }],
        paginatedResults: dataPipeline
      }
    });

    const result = await AttendanceSession.aggregate(pipeline);
    
    const total = result[0].totalData.length > 0 ? result[0].totalData[0].count : 0;
    const records = result[0].paginatedResults;

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

    const sessionDoc = await AttendanceSession.findOne({ "records._id": new mongoose.Types.ObjectId(recordId) });
    if (!sessionDoc) {
      return reply.status(404).send({
        status_code: 404,
        message: "Attendance record not found",
        data: "",
      });
    }

    const record = (sessionDoc as any).records.id(recordId);

    // Check authorization: requestor must be the session creator OR have admin privileges
    if (
      sessionDoc.created_by.toString() !== userId.toString() &&
      !["admin", "principal", "hod"].includes(request.user.role)
    ) {
      return reply.status(403).send({
        status_code: 403,
        message: "You are not authorized to update this record",
        data: "",
      });
    }

    const updateData = request.body as any;
    
    // Build positional updates
    const updates: any = {};
    if (updateData.status) updates["records.$.status"] = updateData.status;
    if (updateData.remarks !== undefined) updates["records.$.remarks"] = updateData.remarks;

    if (Object.keys(updates).length > 0) {
      await AttendanceSession.findOneAndUpdate(
        { "records._id": new mongoose.Types.ObjectId(recordId) },
        { $set: updates },
        { new: true }
      );
    }
    
    // Fetch updated record manually to format uniformly
    const updatedSession = await AttendanceSession.findOne({ "records._id": new mongoose.Types.ObjectId(recordId) })
      .populate("records.student", "name email first_name last_name")
      .populate("batch", "name code year")
      .populate("subject", "name code");
      
    if (!updatedSession) {
       return reply.status(404).send({
         status_code: 404,
         message: "Error fetching updated record",
         data: ""
       });
    }

    const updatedRecordMatched = (updatedSession as any).records.id(recordId);

    const responseRecord = {
      _id: updatedRecordMatched._id,
      student: updatedRecordMatched.student,
      status: updatedRecordMatched.status,
      remarks: updatedRecordMatched.remarks,
      marked_at: updatedRecordMatched.marked_at,
      session: {
        _id: updatedSession._id,
        batch: updatedSession.batch,
        subject: updatedSession.subject,
      }
    };

    return reply.send({
      status_code: 200,
      message: "Attendance record updated successfully",
      data: responseRecord,
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

    const sessionDoc = await AttendanceSession.findOne({ "records._id": new mongoose.Types.ObjectId(recordId) });
    if (!sessionDoc) {
      return reply.status(404).send({
        status_code: 404,
        message: "Attendance record not found",
        data: "",
      });
    }

    const record = (sessionDoc as any).records.id(recordId);

    // Check authorization: requestor must be the session creator OR have admin privileges
    if (
      sessionDoc.created_by.toString() !== userId.toString() &&
      !["admin", "principal", "hod"].includes(request.user.role)
    ) {
      return reply.status(403).send({
        status_code: 403,
        message: "You are not authorized to delete this record",
        data: "",
      });
    }

    await AttendanceSession.findByIdAndUpdate(
      sessionDoc._id,
      { $pull: { records: { _id: new mongoose.Types.ObjectId(recordId) } } }
    );

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
