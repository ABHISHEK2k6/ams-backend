import { FastifyRequest, FastifyReply } from "fastify";
import { User } from "@/plugins/db/models/auth.model";
import { Notification } from "@/plugins/db/models/notifications.models";
import { auth } from "@/plugins/auth";
import { authClient } from "@/plugins/auth";
import { Batch } from "@/plugins/db/models/academics.model";
import { resolveObjectIdString } from "@/lib/scope";


export const postNotification = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {

  const userID = request.user.id;
  const user = await User.findById(userID);
  // checking if the user model exists or not
  if (!user) {
    return reply.status(404).send({
      status_code: 404,
      message: "User not found",
      data: "",
    });
  }
 
  const { targetGroup, targetID, targetUsers, title, message, priorityLevel, notificationType } = request.body as {
    targetGroup: string;
    targetID?: string;
    targetUsers: [string];
    title: string;
    priorityLevel: number;
    message: string;
    notificationType: String;

  }

  if (targetGroup === "year") {
    // Admins have unrestricted access. Otherwise allow principal/hod, or
    // teachers when they are targeting parents specifically.
    const targetingParents = Array.isArray(targetUsers) && targetUsers.includes("parent");
    if (request.user.role === "admin" || request.user.role === "principal" || request.user.role === "hod" || (request.user.role === "teacher" && targetingParents)) {
      // allowed
    } else {
      return reply.status(403).send({
        "status_code": 403,
        "message": "Request Failed! User Role Not Satisfied (Should be admin, principal or hod, or teacher when targeting parents)",
        "data": ""
      })
    }
  }
  else if (targetGroup === "batch") {
    // Admins have unrestricted access. Otherwise allow principal/hod/teacher.
    // Teachers can target both students and parents.
    if (request.user.role === "admin" || request.user.role === "principal" || request.user.role === "hod" || request.user.role === "teacher") { }
    else {
      return reply.status(403).send({
        "status_code": 403,
        "message": "Request Failed! User Role Not Satisfied (Should be admin, principal or hod or teacher)",
        "data": ""
      })
    }
  }
  else if (targetGroup === "department") {
    // Admins have unrestricted access. Otherwise allow principal/hod, or
    // teachers when targeting parents specifically.
    const targetingParentsDept = Array.isArray(targetUsers) && targetUsers.includes("parent");
    if (request.user.role === "admin" || request.user.role === "principal" || request.user.role === "hod" || (request.user.role === "teacher" && targetingParentsDept)) {
      // allowed
    } else {
      return reply.status(403).send({
        "status_code": 403,
        "message": "Request Failed! User Role Not Satisfied (Should be admin, principal or hod, or teacher when targeting parents)",
        "data": ""
      })
    }
  }

  if (targetGroup != "college") {
    const notificationInstance = new Notification({
      targetID: targetID,
      targetUsers: targetUsers,
      targetGroup: targetGroup,
      title: title,
      message: message,
      priorityLevel: priorityLevel,
      Notificationtype: notificationType,
      createdBy: userID
    })
    await notificationInstance.save()
    return reply.status(201).send({
      "status_code": 201,
      "message": "successfully created the notification",
      "data": ""
    })
  }
  else {
    if (request.user.role === "admin" || request.user.role == "principal" || request.user.role === "hod") {

      const notificationInstance = new Notification({
        targetUsers: targetUsers,
        targetGroup: targetGroup,
        title: title,
        message: message,
        priorityLevel: priorityLevel,
        Notificationtype: notificationType,
        createdBy: userID
      })
      await notificationInstance.save()
      return reply.status(201).send({
        "status_code": 201,
        "message": "successfully created the notification",
        "data": ""
      })
    }
    else {
      return reply.status(403).send({
        "status_code": 403,
        "message": "Request Failed , should be of admin, principal or hod",
        "data": ""
      })
    }
  }
}

export const getNotification = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {

  const userID = request.user.id;
  const user = await User.findById(userID);

  // checking if the user model exists or not
  if (!user) {
    return reply.status(404).send({
      status_code: 404,
      message: "User not found",
      data: "",
    });
  }

  let notifications: any[] = [];

  if (request.user.role === "student") {
    const profile = (user.profile ?? {}) as any;

    // Fetch college-wide notifications
    notifications = await Notification.find({ targetGroup: "college" });

    if (profile.adm_year) {
      const yearNotifications = await Notification.find({
        targetGroup: "year",
        targetUsers: { $in: ["student"] },
        targetID: profile.adm_year
      });
      notifications = notifications.concat(yearNotifications);
    }

    if (profile.department) {
      const departmentNotifications = await Notification.find({
        targetGroup: "department",
        targetUsers: { $in: ["student"] },
        targetID: profile.department
      });
      notifications = notifications.concat(departmentNotifications);
    }

    if (profile.batch) {
      const batchInstance = await Batch.findById(profile.batch);
      if (batchInstance) {
        const batchNotifications = await Notification.find({
          targetGroup: "batch",
          targetUsers: { $in: ["student"] },
          targetID: batchInstance._id
        });
        notifications = notifications.concat(batchNotifications);
      }
    }

    return reply.status(200).send({
      "status_code": 200,
      "message": "Successfully fetched college, year, department and batch notifications for student",
      "data": { notifications }
    });
  }
  else if (["teacher", "principal", "hod", "admin", "staff"].includes(request.user.role)) {
    const profile = (user.profile ?? {}) as any;

    if (profile.designation) {
      const notificationsForTeacher = await Notification.find({
        $or: [
          {
            targetGroup: "college",
            targetUsers: { $in: ["staff"] },
            targetID: "all"
          },
          { createdBy: userID }
        ]
      });

      notifications = notificationsForTeacher;

      return reply.status(200).send({
        "status_code": 200,
        "message": "Successfully fetched the notifications for staffs",
        "data": { notifications }
      });
    }
  }
  else if (request.user.role === "parent") {
    const profile = (user.profile ?? {}) as any;

    const childId = resolveObjectIdString(profile.child);
    if (childId) {
      // Ensure we have child's profile details to match batch/year/department
      const child = await User.findById(childId).lean();
      const childProfile = (child?.profile ?? {}) as any;

      const notificationsForParents: any[] = [];

      // College-wide parent notifications
      const collegeNotifs = await Notification.find({
        targetGroup: "college",
        targetUsers: { $in: ["parent"] },
        targetID: "all"
      });
      notificationsForParents.push(...collegeNotifs);

      // Year-level (compare as string) and include notifications sent to "all"
      if (childProfile.adm_year) {
        const yearNotifs = await Notification.find({
          targetGroup: "year",
          targetUsers: { $in: ["parent"] },
          targetID: { $in: [String(childProfile.adm_year), "all"] }
        });
        notificationsForParents.push(...yearNotifs);
      }

      // Department-level: include notifications targeted to the specific department or to "all"
      if (childProfile.department) {
        const deptNotifs = await Notification.find({
          targetGroup: "department",
          targetUsers: { $in: ["parent"] },
          targetID: { $in: [childProfile.department, "all"] }
        });
        notificationsForParents.push(...deptNotifs);
      }

      // Batch-level: include notifications targeted to the specific batch or to "all"
      if (childProfile.batch) {
        const batchNotifs = await Notification.find({
          targetGroup: "batch",
          targetUsers: { $in: ["parent"] },
          targetID: { $in: [String(childProfile.batch), "all"] }
        });
        notificationsForParents.push(...batchNotifs);
      }

      notifications = notificationsForParents;

      return reply.status(200).send({
        "status_code": 200,
        "message": "Successfully fetched the notifications for parents",
        "data": { notifications }
      });
    }
  }
  else {
    return reply.status(200).send({
      "status_code": 200,
      "message": "No Notifications found",
      "data": ""
    })
  }
}

// ─── GET /notifications/all — admin-only, unfiltered list ────────────────────

export const listAllNotifications = async (
  request: FastifyRequest<{
    Querystring: {
      page?: number;
      limit?: number;
      search?: string;
      targetGroup?: string;
      notificationType?: string;
      priorityLevel?: string;
      sort?: "createdAt" | "title" | "priorityLevel";
      order?: "asc" | "desc";
    };
  }>,
  reply: FastifyReply
) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      targetGroup,
      notificationType,
      priorityLevel,
      sort = "createdAt",
      order = "desc",
    } = request.query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (targetGroup) filter.targetGroup = targetGroup;
    if (notificationType) filter.Notificationtype = notificationType;
    if (priorityLevel) filter.priorityLevel = priorityLevel;
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [{ title: searchRegex }, { message: searchRegex }];
    }

    // The schema has no timestamps field, so "createdAt" order is derived
    // from the ObjectId itself, which is chronological.
    const sortField = sort === "createdAt" ? "_id" : sort;
    const sortOrder = order === "asc" ? 1 : -1;

    const [notifications, totalCount] = await Promise.all([
      Notification.find(filter)
        .populate("createdBy", "name email role")
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return reply.status(200).send({
      status_code: 200,
      message: "Successfully fetched all notifications",
      data: {
        notifications,
        pagination: {
          currentPage: page,
          totalPages,
          totalNotifications: totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (e) {
    return reply.status(500).send({
      status_code: 500,
      message: "Error fetching notifications",
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
};

export const deleteNotification = async (
  request : FastifyRequest<{ Params: { id: string } }>,
  reply : FastifyReply
) => {
  try {
    const notificationID = request.params.id;
    const existing = await Notification.findById(notificationID).select("createdBy");
    if (!existing) {
      return reply.status(404).send({
        status_code: 404,
        message: "Notification not found",
        data: ""
      });
    }

    const isOwner = existing.createdBy && String(existing.createdBy) === String(request.user.id);
    const isPrivileged = ["admin", "principal", "hod"].includes(request.user.role);
    if (!isOwner && !isPrivileged) {
      return reply.status(403).send({
        status_code: 403,
        message: "Forbidden - You can only delete your own notifications",
        data: ""
      });
    }

    await Notification.findByIdAndDelete(notificationID)
    return reply.status(204).send({
      status_code: 204,
      message : "Successfully deleted the notification",
      data: ""
    })
  }
  catch (e) {
    return reply.status(404).send({
      status_code: 404,
      message: "Cant delete the notification",
      error: e,
    });
  }
}

export const updateNotification = async (
  request : FastifyRequest<{ Params: { id: string } }>,
  reply : FastifyReply
) => {
  const notificationID = request.params.id;
  const updatedBody = request.body as {
    targetGroup?: string;
    targetID?: string;
    targetUsers?: [string];
    title?: string;
    priorityLevel?: number;
    message?: string;
    notificationType?: String;
  }

  const notificationInstance = await Notification.findById(notificationID).select("createdBy");
  if (!notificationInstance) {
    return reply.status(404).send({ 
      status_code: 404, 
      message:"Notification not found", 
      data:"" 
    });
  }

  const isOwner = notificationInstance.createdBy && String(notificationInstance.createdBy) === String(request.user.id);
  const isPrivileged = ["admin", "principal", "hod"].includes(request.user.role);
  if (!isOwner && !isPrivileged) {
    return reply.status(403).send({
      status_code: 403,
      message: "Forbidden - You can only update your own notifications",
      data: ""
    });
  }

  const notification = await Notification.findByIdAndUpdate(notificationID, updatedBody, { new: true });
  return reply.status(200).send({
    status_code: 200,
    message: "Successfully updated the notification",
    data: { notification }
  });
}