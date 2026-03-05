import authMiddleware from "@/middleware/auth";
import {
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
  RouteShorthandOptions,
} from "fastify";
import { isAdmin, isPrincipal, isHOD, isAnyStaff } from "@/middleware/roles";
import { 
  createSession, 
  getSession, 
  listSessions, 
  getRecentSessions,
  updateSession, 
  deleteSession 
} from "./service";
import { 
  sessionCreateSchema, 
  sessionUpdateSchema, 
  sessionListSchema 
} from "./schema";

export default async function (fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook("preHandler", authMiddleware);

  // Routes accessible to all authenticated staff members
  fastify.get<{ 
    Querystring: { 
      page?: number; 
      limit?: number; 
      batch?: string;
      subject?: string;
      session_type?: string;
      from_date?: string;
      to_date?: string;
    } 
  }>("/", { 
    schema: sessionListSchema, 
    preHandler: [isAnyStaff] 
  }, listSessions);

  // Get unique batch-subject combinations for current user
  fastify.get("/recent", { 
    preHandler: [isAnyStaff] 
  }, getRecentSessions);

  fastify.get<{ Params: { id: string } }>("/:id", { 
    preHandler: [isAnyStaff] 
  }, getSession);

  fastify.post("/", { 
    schema: sessionCreateSchema, 
    preHandler: [isAnyStaff] 
  }, createSession);

  fastify.put<{ Params: { id: string } }>("/:id", { 
    schema: sessionUpdateSchema, 
    preHandler: [isAnyStaff] 
  }, updateSession);

  // Delete route - restricted to admin, principal, hod, or the creator
  fastify.delete<{ Params: { id: string } }>("/:id", { 
    preHandler: [isAnyStaff] 
  }, deleteSession);
}
