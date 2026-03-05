import authMiddleware from "../../middleware/auth";
import {
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
  RouteShorthandOptions,
} from "fastify";
import { isAdmin } from "@/middleware/roles";

import { userCreateSchema, userUpdateSchema, userListSchema, bulkCreateSchema } from "./schema";
import { createUser, deleteUser, getUser, listUser, updateUser, bulkCreateUsers } from "./service";

export default async function (fastify: FastifyInstance) {

  // Apply authentication middleware to all routes in this file
  fastify.addHook("preHandler", authMiddleware);
  
  fastify.get("/", getUser);
  fastify.post("/", { schema: userCreateSchema }, createUser);
  fastify.put("/", { schema: userUpdateSchema }, updateUser);
  
  // Admin-only routes
  fastify.post("/bulk", { schema: bulkCreateSchema, preHandler: [isAdmin] }, bulkCreateUsers);
  fastify.get<{ Params: { id: string } }>("/:id", { preHandler: [isAdmin] }, getUser);
  fastify.delete<{ Params: { id: string } }>("/:id", { preHandler: [isAdmin] }, deleteUser);
  fastify.put<{ Params: { id: string } }>("/:id", { schema: userUpdateSchema, preHandler: [isAdmin] }, updateUser);
  fastify.get<{ Querystring: { page?: number; limit?: number; role: string; search?: string; } }>("/list", { schema: userListSchema, preHandler: [isAdmin] }, listUser);

  
}
