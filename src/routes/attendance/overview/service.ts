import { FastifyRequest, FastifyReply } from "fastify";
import { AttendanceSession } from "@/plugins/db/models/attendance.model";
import mongoose from "mongoose";

export const getOverview = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user.id;

    const pipeline: any[] = [
      { $match: { created_by: new mongoose.Types.ObjectId(userId), archived: { $ne: true } } },
      { $unwind: { path: "$records", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { session: "$_id", subject: "$subject", start_time: "$start_time" },
          sessionTotal: { $sum: { $cond: [{ $ifNull: ["$records._id", false] }, 1, 0] } },
          sessionPresent: { $sum: { $cond: [{ $eq: ["$records.status", "present"] }, 1, 0] } }
        }
      },
      {
        $group: {
          _id: "$_id.subject",
          totalClasses: { $sum: 1 },
          totalAttendanceAllSessions: { $sum: "$sessionTotal" },
          presentAttendanceAllSessions: { $sum: "$sessionPresent" },
          sessions: {
            $push: {
              start_time: "$_id.start_time",
              percentage: {
                $cond: [
                  { $gt: ["$sessionTotal", 0] },
                  { $round: [{ $multiply: [{ $divide: ["$sessionPresent", "$sessionTotal"] }, 100] }, 0] },
                  0
                ]
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: "subject",
          localField: "_id",
          foreignField: "_id",
          as: "subjectData"
        }
      },
      { $unwind: "$subjectData" },
      {
        $project: {
          _id: 0,
          className: "$subjectData.name",
          classCode: "$subjectData.subject_code",
          totalClasses: 1,
          averageAttendance: {
            $cond: [
              { $gt: ["$totalAttendanceAllSessions", 0] },
              { $round: [{ $multiply: [{ $divide: ["$presentAttendanceAllSessions", "$totalAttendanceAllSessions"] }, 100] }, 0] },
              0
            ]
          },
          sessions: 1
        }
      }
    ];

    const rawData = await AttendanceSession.aggregate(pipeline);

    const overview = rawData.map(item => {
      const sortedStats = [...item.sessions].sort(
        (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );

      let trend: "up" | "down" | "stable" = "stable";
      if (sortedStats.length >= 2) {
        const recent = sortedStats[0].percentage;
        const previous = sortedStats[1].percentage;
        if (recent > previous + 2) trend = "up";
        else if (recent < previous - 2) trend = "down";
      }

      return {
        className: item.className,
        classCode: item.classCode,
        totalClasses: item.totalClasses,
        averageAttendance: item.averageAttendance,
        trend,
      };
    });
    
    // Sort by className alphabetically
    overview.sort((a, b) => a.className.localeCompare(b.className));

    return reply.send({
      status_code: 200,
      message: "Overview retrieved successfully",
      data: overview,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch overview",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
