import authMiddleware from "../../middleware/auth";
import {
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
  RouteShorthandOptions,
} from "fastify";
import { isAdmin } from "@/middleware/roles";

import { userCreateSchema, userUpdateSchema } from "./schema";
import { createUser, deleteUser, getUser, updateUser } from "./service";

export default async function (fastify: FastifyInstance) {

  // Apply authentication middleware to all routes in this file
  fastify.addHook("preHandler", authMiddleware);
  
  fastify.get("/", getUser);
  fastify.post("/", { schema: userCreateSchema }, createUser);
  fastify.put("/", { schema: userUpdateSchema }, updateUser);

  // Admin-only routes
  fastify.get<{ Params: { id: string } }>("/:id", { preHandler: [isAdmin] }, getUser);
  fastify.delete<{ Params: { id: string } }>("/:id", { preHandler: [isAdmin] }, deleteUser);
  fastify.put<{ Params: { id: string } }>("/:id", { schema: userUpdateSchema, preHandler: [isAdmin] }, updateUser);

}
