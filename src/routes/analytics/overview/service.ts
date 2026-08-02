import { FastifyRequest, FastifyReply } from "fastify";
import { User } from "@/plugins/db/models/auth.model";
import { Batch } from "@/plugins/db/models/academics.model";
import { AttendanceSession } from "@/plugins/db/models/attendance.model";
import { Notification } from "@/plugins/db/models/notifications.models";
import { getScopeBatchFilter } from "@/lib/scope";

interface OverviewQuery {
  atRiskThreshold?: number;
  windowDays?: number;
}

export const getOverviewHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { atRiskThreshold = 75, windowDays = 30 } = request.query as OverviewQuery;

    const user = await User.findById(request.user.id);
    if (!user) {
      return reply.status(404).send({ status_code: 404, message: "User not found", data: "" });
    }

    const batchFilter = getScopeBatchFilter(user);
    const batches = await Batch.find(batchFilter).select("_id name department");
    const batchIds = batches.map((b) => b._id);
    const batchMap = new Map(batches.map((b) => [String(b._id), b]));

    const isTeacher = user.role === "teacher";
    const scopeLabel =
      user.role === "hod" ? "department" : isTeacher ? "class" : "institution";

    if (isTeacher && batchIds.length === 0) {
      // Not a staff advisor for any batch — no class-analytics to show.
      return reply.send({
        status_code: 200,
        message: "No advised class",
        data: null,
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const [totalStudents, totalTeachers, sessionsToday, attendanceAgg] = await Promise.all([
      User.countDocuments({ role: "student", "profile.batch": { $in: batchIds } }),
      isTeacher
        ? Promise.resolve(1)
        : User.countDocuments({
            role: "teacher",
            ...(user.role === "hod" ? { "profile.department": user.profile?.department } : {}),
          }),
      AttendanceSession.countDocuments({ batch: { $in: batchIds }, start_time: { $gte: todayStart } }),
      AttendanceSession.aggregate([
        { $match: { batch: { $in: batchIds }, start_time: { $gte: since } } },
        { $unwind: "$records" },
        {
          $group: {
            _id: { student: "$records.student", batch: "$batch" },
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ["$records.status", "present"] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            student: "$_id.student",
            batch: "$_id.batch",
            percentage: {
              $cond: [
                { $gt: ["$total", 0] },
                { $multiply: [{ $divide: ["$present", "$total"] }, 100] },
                0,
              ],
            },
          },
        },
      ]),
    ]);

    const totalBatches = batchIds.length;

    const avgAttendance = attendanceAgg.length
      ? Math.round(
          attendanceAgg.reduce((sum: number, r: any) => sum + r.percentage, 0) / attendanceAgg.length
        )
      : 0;

    const atRiskRecords = attendanceAgg.filter((r: any) => r.percentage < atRiskThreshold);
    const atRiskStudentIds = [...new Set(atRiskRecords.map((r: any) => String(r.student)))];

    // Attendance grouped by batch — feeds the department/batch bar chart.
    const byBatch = new Map<string, { total: number; count: number }>();
    for (const r of attendanceAgg as any[]) {
      const key = String(r.batch);
      const entry = byBatch.get(key) ?? { total: 0, count: 0 };
      entry.total += r.percentage;
      entry.count += 1;
      byBatch.set(key, entry);
    }
    const attendanceChart = [...byBatch.entries()].map(([batchId, entry]) => {
      const batch = batchMap.get(batchId);
      return {
        batchId,
        name: batch?.name ?? "Unknown",
        department: batch?.department ?? "",
        avgAttendance: entry.count ? Math.round(entry.total / entry.count) : 0,
      };
    });

    // Top 20 most at-risk students (lowest attendance %), scoped.
    const worstPerStudent = new Map<string, any>();
    for (const r of atRiskRecords as any[]) {
      const key = String(r.student);
      const existing = worstPerStudent.get(key);
      if (!existing || r.percentage < existing.percentage) worstPerStudent.set(key, r);
    }
    const atRiskTop = [...worstPerStudent.values()]
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 20);

    const atRiskStudents = await User.find({ _id: { $in: atRiskTop.map((r) => r.student) } }).select(
      "first_name last_name"
    );
    const atRiskStudentMap = new Map(atRiskStudents.map((s) => [String(s._id), s]));

    const atRiskTable = atRiskTop.map((r) => {
      const student = atRiskStudentMap.get(String(r.student));
      const batch = batchMap.get(String(r.batch));
      return {
        studentId: String(r.student),
        name: student ? `${student.first_name} ${student.last_name}` : "Unknown",
        batch: batch?.name ?? "",
        attendancePercentage: Math.round(r.percentage),
      };
    });

    const recentAnnouncements = await Notification.find({ Notificationtype: "announcement" })
      .sort({ _id: -1 })
      .limit(5)
      .select("title message priorityLevel targetGroup createdBy");

    return reply.send({
      status_code: 200,
      message: "Overview fetched",
      data: {
        scope: scopeLabel,
        totalStudents,
        totalTeachers,
        totalBatches,
        sessionsToday,
        avgAttendance,
        atRiskCount: atRiskStudentIds.length,
        attendanceChart,
        atRiskTable,
        recentAnnouncements,
      },
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch analytics overview",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
