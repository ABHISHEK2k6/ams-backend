import { FastifyInstance } from "fastify";
import authMiddleware from "@/middleware/auth";
import { isAnyStaff } from "@/middleware/roles";
import {
  listGradeFieldsHandler,
  getGradeFieldByIdHandler,
  createGradeFieldHandler,
  updateGradeFieldHandler,
  deleteGradeFieldHandler,
  syncAttendanceGradeFieldHandler
} from "./service";
import {
  listGradeFieldsSchema,
  getGradeFieldByIdSchema,
  createGradeFieldSchema,
  updateGradeFieldSchema,
  deleteGradeFieldSchema,
  syncAttendanceGradeFieldSchema
} from "./schema";

export default async function (fastify: FastifyInstance) {
  // Apply authentication to all routes
  fastify.addHook("preHandler", authMiddleware);

  // List grade fields - any authenticated role;
  fastify.get("/", { schema: listGradeFieldsSchema }, listGradeFieldsHandler);

  // Get single grade field - accessible by any staff
  fastify.get("/:id", { schema: getGradeFieldByIdSchema, preHandler: [isAnyStaff] }, getGradeFieldByIdHandler);

  // Create grade field - any staff can create
  fastify.post("/", { schema: createGradeFieldSchema, preHandler: [isAnyStaff] }, createGradeFieldHandler);

  // Update grade field - any staff can update
  fastify.put("/:id", { schema: updateGradeFieldSchema, preHandler: [isAnyStaff] }, updateGradeFieldHandler);

  // Delete grade field - any staff, scoped to their own batch access
  fastify.delete("/:id", { schema: deleteGradeFieldSchema, preHandler: [isAnyStaff] }, deleteGradeFieldHandler);

  // Re-pull attendance and overwrite this attendance-type field's entries - any staff, scoped
  fastify.post("/:id/sync-attendance", { schema: syncAttendanceGradeFieldSchema, preHandler: [isAnyStaff] }, syncAttendanceGradeFieldHandler);
  
}
