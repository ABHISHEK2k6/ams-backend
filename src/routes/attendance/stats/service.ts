import { FastifyRequest, FastifyReply } from "fastify";
import { AttendanceSession } from "@/plugins/db/models/attendance.model";
import { User } from "@/plugins/db/models/auth.model";
import { Batch } from "@/plugins/db/models/academics.model";
import mongoose from "mongoose";

interface StatsQuery {
  student?: string;
}

export const getStats = async (
  request: FastifyRequest<{ Querystring: StatsQuery }>,
  reply: FastifyReply
) => {
  try {
    const userId = request.user.id;
    const userRole = request.user.role;
    // Accept either `student` (preferred) or `for_user` (legacy/frontend) as the query param.
    const q: any = request.query as any;
    const student = q.student ?? q.for_user;

    let targetStudentId = userId;

    if (student) {
      if (userRole === "student" && student !== userId) {
        return reply.status(403).send({
          status_code: 403,
          message: "Students can only view their own stats",
          data: "",
        });
      }

      // If the requester is a parent, allow only their associated child
      if (userRole === "parent") {
        let parentChild = (request.user as any)?.profile?.child;
        if (!parentChild) {
          const parentDoc = await User.findById(userId).select("profile.child").lean();
          parentChild = parentDoc?.profile?.child;
        }
        if (!parentChild) {
          return reply.status(403).send({
            status_code: 403,
            message: "Parent profile does not have an associated child",
            data: "",
          });
        }
        if (student !== parentChild.toString()) {
          return reply.status(403).send({
            status_code: 403,
            message: "Parents can only view stats for their associated child",
            data: "",
          });
        }
      }

      if (!mongoose.Types.ObjectId.isValid(student)) {
        return reply.status(400).send({
          status_code: 400,
          message: "Invalid student ID format",
          data: "",
        });
      }
      targetStudentId = student;
    } else {
      // No student param provided: if requester is a parent, use their child ID
      if (userRole === "parent") {
        let parentChild = (request.user as any)?.profile?.child;
        if (!parentChild) {
          const parentDoc = await User.findById(userId).select("profile.child").lean();
          parentChild = parentDoc?.profile?.child;
        }
        if (!parentChild) {
          return reply.status(403).send({
            status_code: 403,
            message: "Parent profile does not have an associated child",
            data: "",
          });
        }
        targetStudentId = parentChild.toString();
      }
    }

    const studentObjectId = new mongoose.Types.ObjectId(targetStudentId);

    const studentDoc = await User.findById(targetStudentId).select("profile.batch").lean();
    const batchId = (studentDoc as any)?.profile?.batch;
    const currentBatch = batchId
      ? await Batch.findById(batchId).select("sem department scheme").lean()
      : null;

    const pipeline: any[] = [
      { $match: { "records.student": studentObjectId } },
      { $unwind: "$records" },
      { $match: { "records.student": studentObjectId } },
      {
        $group: {
          _id: "$subject",
          totalClasses: { $sum: 1 },
          attendedClasses: {
            $sum: { $cond: [{ $eq: ["$records.status", "present"] }, 1, 0] }
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
      ...(currentBatch
        ? [
            {
              $match: {
                "subjectData.sem": currentBatch.sem,
                "subjectData.department": currentBatch.department,
                "subjectData.scheme": currentBatch.scheme,
              },
            },
          ]
        : []),
      {
        $project: {
          _id: 0,
          subjectName: "$subjectData.name",
          sem: "$subjectData.sem",
          totalClasses: 1,
          attendedClasses: 1,
          percentage: {
            $cond: [
              { $gt: ["$totalClasses", 0] },
              { $round: [{ $multiply: [{ $divide: ["$attendedClasses", "$totalClasses"] }, 100] }, 0] },
              0
            ]
          }
        }
      },
      {
        $addFields: {
          classesNeeded: {
            $cond: [
              { $lt: ["$percentage", 75] },
              { $subtract: [{ $multiply: [3, "$totalClasses"] }, { $multiply: [4, "$attendedClasses"] }] },
              0
            ]
          },
          classesCanSkip: {
            $cond: [
              { $gte: ["$percentage", 75] },
              { $floor: { $subtract: [{ $divide: [{ $multiply: [4, "$attendedClasses"] }, 3] }, "$totalClasses"] } },
              0
            ]
          }
        }
      },
      { $sort: { subjectName: 1 } }
    ];

    const stats = await AttendanceSession.aggregate(pipeline);

    return reply.send({
      status_code: 200,
      message: "Stats retrieved successfully",
      data: stats,
    });
  } catch (error) {
    return reply.status(500).send({
      status_code: 500,
      message: "Failed to fetch stats",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
