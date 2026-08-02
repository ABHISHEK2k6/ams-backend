import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { User } from "@/plugins/db/models/auth.model";
import { Batch } from "@/plugins/db/models/academics.model";
import { AttendanceSession } from "@/plugins/db/models/attendance.model";
import { getScopeBatchFilter } from "@/lib/scope";

interface CalendarMonthQuery {
  month: number;
  year: number;
  batch?: string;
  subject?: string;
}

interface CalendarDayQuery {
  date: string;
  batch?: string;
  subject?: string;
}

const ATTENDED_STATUSES = ["present", "late"];

/**
 * Resolves the AttendanceSession match stage for a role.
 * - student: only sessions where they have a record
 * - teacher: only sessions they created
 * - hod/principal/admin: batch-scoped via the shared access hierarchy (@/lib/scope)
 * - everyone else (parent, staff): no calendar data yet
 */
async function buildScopeMatch(user: {
  _id: unknown;
  role: string;
  profile?: { department?: string } | null;
}): Promise<Record<string, unknown> | null> {
  switch (user.role) {
    case "student":
      return { "records.student": user._id };
    case "teacher":
      return { created_by: user._id };
    case "hod":
    case "principal":
    case "admin": {
      const batchFilter = getScopeBatchFilter(user);
      const batchIds = await Batch.find(batchFilter).distinct("_id");
      return { batch: { $in: batchIds } };
    }
    default:
      return null;
  }
}

function applyDrilldownFilters(
  match: Record<string, unknown>,
  batch?: string,
  subject?: string
) {
  if (batch && mongoose.Types.ObjectId.isValid(batch)) {
    match.batch = new mongoose.Types.ObjectId(batch);
  }
  if (subject && mongoose.Types.ObjectId.isValid(subject)) {
    match.subject = new mongoose.Types.ObjectId(subject);
  }
}

export const getCalendarMonthHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { month, year, batch, subject } = request.query as CalendarMonthQuery;

    const user = await User.findById(request.user.id);
    if (!user) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }

    const scopeMatch = await buildScopeMatch(user);
    if (!scopeMatch) {
      return reply.send({
        status_code: 200,
        message: "No calendar data for this role yet",
        data: { role: user.role, days: [] },
      });
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));

    const match: Record<string, unknown> = {
      ...scopeMatch,
      start_time: { $gte: monthStart, $lt: monthEnd },
    };
    applyDrilldownFilters(match, batch, subject);

    if (user.role === "student") {
      const rows = await AttendanceSession.aggregate([
        { $match: match },
        { $unwind: "$records" },
        { $match: { "records.student": user._id } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$start_time", timezone: "UTC" } },
            total: { $sum: 1 },
            attended: { $sum: { $cond: [{ $in: ["$records.status", ATTENDED_STATUSES] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const days = rows.map((r: any) => ({
        date: r._id,
        count: r.total,
        status: r.attended === r.total ? "present" : r.attended === 0 ? "absent" : "partial",
      }));

      return reply.send({
        status_code: 200,
        message: "Calendar markers fetched",
        data: { role: user.role, days },
      });
    }

    const rows = await AttendanceSession.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$start_time", timezone: "UTC" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const days = rows.map((r: any) => ({ date: r._id, count: r.count }));

    return reply.send({
      status_code: 200,
      message: "Calendar markers fetched",
      data: { role: user.role, days },
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch calendar markers",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getCalendarDayHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { date, batch, subject } = request.query as CalendarDayQuery;

    const user = await User.findById(request.user.id);
    if (!user) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }

    const scopeMatch = await buildScopeMatch(user);
    if (!scopeMatch) {
      return reply.send({
        status_code: 200,
        message: "No calendar data for this role yet",
        data: { role: user.role, date, sessions: [] },
      });
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(dayStart.getTime())) {
      return reply.status(400).send({ status_code: 400, message: "Invalid date format", data: "" });
    }
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const match: Record<string, unknown> = {
      ...scopeMatch,
      start_time: { $gte: dayStart, $lt: dayEnd },
    };
    applyDrilldownFilters(match, batch, subject);

    const sessions = await AttendanceSession.find(match)
      .populate("subject", "name subject_code")
      .populate("batch", "name")
      .populate("created_by", "first_name last_name")
      .sort({ start_time: 1 });

    if (user.role === "student") {
      const result = sessions.map((s: any) => {
        const record = (s.records || []).find((r: any) => String(r.student) === String(user._id));
        return {
          sessionId: s._id,
          subject: s.subject?.name ?? "",
          batch: s.batch?.name ?? "",
          start_time: s.start_time,
          end_time: s.end_time,
          status: record?.status ?? "absent",
        };
      });

      return reply.send({
        status_code: 200,
        message: "Calendar day fetched",
        data: { role: user.role, date, sessions: result },
      });
    }

    const result = sessions.map((s: any) => {
      const records = s.records || [];
      const totalStudents = records.length;
      const studentsPresent = records.filter((r: any) => ATTENDED_STATUSES.includes(r.status)).length;

      return {
        sessionId: s._id,
        subject: s.subject?.name ?? "",
        batch: s.batch?.name ?? "",
        ...(user.role !== "teacher"
          ? { teacher: s.created_by ? `${s.created_by.first_name} ${s.created_by.last_name}` : "" }
          : {}),
        start_time: s.start_time,
        end_time: s.end_time,
        studentsPresent,
        totalStudents,
      };
    });

    return reply.send({
      status_code: 200,
      message: "Calendar day fetched",
      data: { role: user.role, date, sessions: result },
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch calendar day",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
