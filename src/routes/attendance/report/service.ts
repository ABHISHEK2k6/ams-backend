import { FastifyRequest, FastifyReply } from "fastify";
import { AttendanceSession } from "@/plugins/db/models/attendance.model";
import { Subject, Batch } from "@/plugins/db/models/academics.model";
import mongoose from "mongoose";

export interface ReportQuery {
  subject: string;
  batch: string;
}

export const getReport = async (
  request: FastifyRequest<{ Querystring: ReportQuery }>,
  reply: FastifyReply
) => {
  try {
    const { subject, batch } = request.query;

    if (!mongoose.Types.ObjectId.isValid(subject) || !mongoose.Types.ObjectId.isValid(batch)) {
      return reply.status(400).send({
        status_code: 400,
        message: "Invalid subject or batch ID format",
        data: "",
      });
    }

    // Fetch all sessions for this subject and batch, sorted by start_time ascending
    const sessions = await AttendanceSession.find({
      subject: new mongoose.Types.ObjectId(subject),
      batch: new mongoose.Types.ObjectId(batch),
    })
      .sort({ start_time: 1 })
      .populate("subject", "name subject_code")
      .populate("batch", "name")
      .populate("records.student", "name email first_name last_name profile.candidate_code roll_no");

    if (!sessions || sessions.length === 0) {
      const subjectDoc = await Subject.findById(subject).lean();
      const batchDoc = await Batch.findById(batch).lean();

      return reply.send({
        status_code: 200,
        message: "No sessions found for the specified subject and batch",
        data: {
          className: subjectDoc?.name || "Unknown Subject",
          classCode: subjectDoc?.subject_code || "N/A",
          batchName: batchDoc?.name || "Unknown Batch",
          sessions: [],
          students: [],
        },
      });
    }

    const className = (sessions[0].subject as any)?.name || "Unknown Subject";
    const classCode = (sessions[0].subject as any)?.subject_code || "N/A";
    const batchName = (sessions[0].batch as any)?.name || "Unknown Batch";

    const sessionHeaders = sessions.map(s => ({
      _id: s._id,
      start_time: s.start_time,
      end_time: s.end_time,
      session_type: s.session_type,
    }));

    const studentMap = new Map<string, any>();

    sessions.forEach(session => {
      const sessionId = session._id.toString();

      session.records.forEach((record: any) => {
        if (!record.student) return;
        const studentId = record.student._id.toString();
        
        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            _id: studentId,
            name: record.student.name || `${record.student.first_name || ''} ${record.student.last_name || ''}`.trim(),
            email: record.student.email,
            candidate_code: record.student.profile?.candidate_code,
            roll_no: record.student.roll_no,
            attendance: {},
            totalPresent: 0,
            totalSessions: 0,
          });
        }

        const studentData = studentMap.get(studentId);
        studentData.attendance[sessionId] = record.status;
        studentData.totalSessions += 1;
        if (record.status === "present") {
          studentData.totalPresent += 1;
        }
      });
    });

    const students = Array.from(studentMap.values()).map(student => {
      const percentage = student.totalSessions > 0 
        ? Math.round((student.totalPresent / student.totalSessions) * 100) 
        : 0;
      
      return {
        ...student,
        percentage,
      };
    });

    // Sort students by name
    students.sort((a, b) => a.name.localeCompare(b.name));

    return reply.send({
      status_code: 200,
      message: "Report retrieved successfully",
      data: {
        className,
        classCode,
        batchName,
        sessions: sessionHeaders,
        students,
      },
    });

  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch report",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
