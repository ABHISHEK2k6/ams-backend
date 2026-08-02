import authMiddleware from "../../middleware/auth";
import {
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
  RouteShorthandOptions,
} from "fastify";
import { isAdmin, isAnyStaff, isParent } from "@/middleware/roles";

import { userCreateSchema, userUpdateSchema, userListSchema, bulkCreateSchema, setPasswordSchema, resetPasswordSchema } from "./schema";
import { createUser, deleteUser, getUser, listUser, updateUser, bulkCreateUsers, setPassword, resetUserPassword } from "./service";

export default async function (fastify: FastifyInstance) {

  // Apply authentication middleware to all routes in this file
  fastify.addHook("preHandler", authMiddleware);

  fastify.get("/", getUser);
  fastify.post("/", { schema: userCreateSchema }, createUser);
  fastify.put("/", { schema: userUpdateSchema }, updateUser);

  // Set a password for the current user — only succeeds if they don't
  // already have a "credential" account (e.g. Google-only sign-in).
  // Use PUT / (updateUser) -> emailAndPassword flows or /change-password
  // (Better-Auth core, called directly from the frontend) once a password exists.
  fastify.post("/set-password", { schema: setPasswordSchema }, setPassword);

  // Admin-only routes
  fastify.post("/bulk", { schema: bulkCreateSchema, preHandler: [isAdmin] }, bulkCreateUsers);
  fastify.get<{ Params: { id: string } }>("/:id", getUser);
  fastify.delete<{ Params: { id: string } }>("/:id", { preHandler: [isAdmin] }, deleteUser);
  fastify.put<{ Params: { id: string } }>("/:id", { schema: userUpdateSchema, preHandler: [isAdmin] }, updateUser);
  fastify.get<{ Querystring: { page?: number; limit?: number; role: string; search?: string; } }>("/list", { schema: userListSchema, preHandler: [isAnyStaff] }, listUser);

  // Admin directly sets another user's password — works even if that user
  // has never had a "credential" account before (e.g. Google-only sign-in),
  // unlike Better-Auth's own admin.setUserPassword which silently no-ops
  // in that case (it only updates an existing credential account).
  fastify.post<{ Params: { id: string } }>(
    "/:id/reset-password",
    { schema: resetPasswordSchema, preHandler: [isAdmin] },
    resetUserPassword
  );
}
