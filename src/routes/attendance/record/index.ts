import authMiddleware from "@/middleware/auth";
import {
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
  RouteShorthandOptions,
} from "fastify";
import { isAnyStaff, isAnyStaffOrStudent } from "@/middleware/roles";
import { 
  createRecord,
  createBulkRecords, 
  getRecord, 
  listRecords, 
  updateRecord, 
  deleteRecord 
} from "./service";
import { 
  recordCreateSchema,
  recordBulkCreateSchema, 
  recordUpdateSchema, 
  recordListSchema 
} from "./schema";

export default async function (fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook("preHandler", authMiddleware);

  // Routes accessible to all authenticated staff members
  fastify.get<{ 
    Querystring: { 
      page?: number; 
      limit?: number; 
      session?: string;
      student?: string;
      status?: string;
      from_date?: string;
      to_date?: string;
    } 
  }>("/", { 
    schema: recordListSchema, 
    preHandler: [isAnyStaffOrStudent] 
  }, listRecords);

  fastify.get<{ Params: { id: string } }>("/:id", { 
    preHandler: [isAnyStaffOrStudent] 
  }, getRecord);

  // Create single attendance record
  fastify.post("/", { 
    schema: recordCreateSchema, 
    preHandler: [isAnyStaff] 
  }, createRecord);

  // Create bulk attendance records
  fastify.post("/bulk", { 
    schema: recordBulkCreateSchema, 
    preHandler: [isAnyStaff] 
  }, createBulkRecords);

  fastify.put<{ Params: { id: string } }>("/:id", { 
    schema: recordUpdateSchema, 
    preHandler: [isAnyStaff] 
  }, updateRecord);

  // Delete route - restricted to admin, principal, hod, or the marker
  fastify.delete<{ Params: { id: string } }>("/:id", { 
    preHandler: [isAnyStaff] 
  }, deleteRecord);
}
