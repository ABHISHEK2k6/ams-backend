import authMiddleware from "@/middleware/auth";
import {
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
  RouteShorthandOptions,
} from "fastify";
import { isAdmin, isStaff, isTeacher } from "@/middleware/roles";
import { deleteNotification, getNotification, postNotification, updateNotification } from "./service";
import { notificationCreateSchema, notificationUpdateSchema } from "./schema";


export default async function (fastify : FastifyInstance) {
    fastify.addHook("preHandler" , authMiddleware)

    fastify.get("/", { preHandler: [isStaff] }, getNotification);
    fastify.post("/", {schema: notificationCreateSchema, preHandler: [isStaff]}, postNotification);

    //staff-only routes
    fastify.delete<{ Params: { id: string } }>("/:id", { preHandler: [isStaff] }, deleteNotification)
    fastify.put<{ Params: { id: string } }>("/:id", { schema: notificationUpdateSchema, preHandler: [isStaff] }, updateNotification)
}