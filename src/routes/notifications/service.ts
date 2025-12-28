import { FastifyRequest, FastifyReply } from "fastify";
import { Parent, Student, Teacher, User, } from "@/plugins/db/models/auth.model";
import { Notification } from "@/plugins/db/models/notifications.models";
import { auth } from "@/plugins/auth";
import { authClient } from "@/plugins/auth";
import { Batch } from "@/plugins/db/models/academics.model";


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
    if (request.user.role == "principal" || request.user.role == "hod") { }
    else {
      return reply.status(403).send({
        "status_code": 403,
        "message": "Request Failed! User Role Not Satistfied (Should be principal or hod)",
        "data": ""
      })
    }
  }
  else if (targetGroup === "batch") {
    if (request.user.role == "principle" || request.user.role == "hod" || request.user.role == "teacher") { }
    else {
      return reply.status(403).send({
        "status_code": 403,
        "message": "Request Failed! User Role Not Satistfied (Should be principal or hod or teacher)",
        "data": ""
      })
    }
  }
  else if (targetGroup === "department") {
    if (request.user.role == "principle" || request.user.role == "hod") { }
    else {
      return reply.status(403).send({
        "status_code": 403,
        "message": "Request Failed! User Role Not Satistfied (Should be principal or hod)",
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
      Notificationtype: notificationType
    })
    await notificationInstance.save()
    return reply.status(201).send({
      "status_code": 201,
      "message": "successfully created the notification",
      "data": ""
    })
  }
  else {
    if (request.user.role == "principal" || request.user.role === "hod") {

      const notificationInstance = new Notification({
        targetUsers: targetUsers,
        targetGroup: targetGroup,
        title: title,
        message: message,
        priorityLevel: priorityLevel,
        Notificationtype: notificationType
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
        "message": "Request Failed , should be of principle or hod",
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

  let user_role_instance = null // used to track the specific role instance
  let notifications = []; // used to store the fetched notifications

  if (request.user.role === "student") {
    user_role_instance = await Student.findOne({
      user: user._id
    })

    if (!user_role_instance) {
      return reply.status(404).send({
        status_code: 404,
        message: "student not found",
        data: "",
      });
    }

    // Fetch notifications for students where targetGroup is 'college'
    notifications = await Notification.find({
      targetGroup: "college"
    });

    // Also fetch notifications where targetGroup is 'year', targetUsers includes 'student', and targetID matches adm_year
    if (user_role_instance && user_role_instance.adm_year) {
      const yearNotifications = await Notification.find({
        targetGroup: "year",
        targetUsers: { $in: ["student"] },
        targetID: user_role_instance.adm_year
      });
      notifications = notifications.concat(yearNotifications);
    }

    // Also fetch notifications where targetGroup is 'department', targetUsers includes 'student', and targetID matches department
    if (user_role_instance && user_role_instance.department) {
      const departmentNotifications = await Notification.find({
        targetGroup: "department",
        targetUsers: { $in: ["student"] },
        targetID: user_role_instance.department
      });
      notifications = notifications.concat(departmentNotifications);
    }

    // Also fetch notifications where targetGroup is 'batch', targetUsers includes 'student', and targetID matches batch ID
    if (user_role_instance && user_role_instance.batch) {
      const batchInstance = await Batch.findById(user_role_instance.batch);
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

    user_role_instance = await Teacher.findOne({
      user: user._id
    })

    if (!user_role_instance) {
      return reply.status(404).send({
        status_code: 404,
        message: "Staff not found",
        data: "",
      });
    }

    if (user_role_instance && user_role_instance.designation) {
      const notificationsForTeacher = await Notification.find({
        targetGroup: "college",
        targetUsers: { $in: ["staff"] },
        targetID: "all"
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

    user_role_instance = await Parent.findOne({
      user: user._id
    })

    if (!user_role_instance) {
      return reply.status(404).send({
        status_code: 404,
        message: "parent not found",
        data: "",
      });
    }

    if (user_role_instance && user_role_instance.child) {
      const NotificationsForParents = await Notification.find({
        targetGroup: "college",
        targetUsers: { $in: ["parent"] },
        targetID: "all"
      });
      notifications = NotificationsForParents;

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

export const deleteNotification = async (
  request : FastifyRequest<{ Params: { id: string } }>,
  reply : FastifyReply
) => {
  try {
    const notificationID = request.params.id;
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

  const notificationInstance = await Notification.findById(notificationID);
  if (!notificationInstance) {
    return reply.status(404).send({ 
      status_code: 404, 
      message:"Notification not found", 
      data:"" 
    });
  }

  const notification = await Notification.findByIdAndUpdate(notificationID, updatedBody, { new: true });
  return reply.status(200).send({
    status_code: 200,
    message: "Successfully updated the notification",
    data: { notification }
  });
}