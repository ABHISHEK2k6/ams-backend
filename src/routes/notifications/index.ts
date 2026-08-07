import authMiddleware from "@/middleware/auth";
import {
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
  RouteShorthandOptions,
} from "fastify";
import { isAdmin, isAnyStaff, isTeacher } from "@/middleware/roles";
import { deleteNotification, getNotification, listAllNotifications, postNotification, updateNotification } from "./service";
import { notificationCreateSchema, notificationListAllSchema, notificationUpdateSchema } from "./schema";


export default async function (fastify : FastifyInstance) {
    fastify.addHook("preHandler" , authMiddleware)

    fastify.get("/", getNotification);
    fastify.post("/", {schema: notificationCreateSchema, preHandler: [isAnyStaff]}, postNotification);

    // Admin-only: unfiltered, paginated view of every notification in the system.
    fastify.get<{
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
    }>("/all", { schema: notificationListAllSchema, preHandler: [isAdmin] }, listAllNotifications);

    //staff-only routes
    fastify.delete<{ Params: { id: string } }>("/:id", { preHandler: [isAnyStaff] }, deleteNotification)
    fastify.put<{ Params: { id: string } }>("/:id", { schema: notificationUpdateSchema, preHandler: [isAnyStaff] }, updateNotification)
}