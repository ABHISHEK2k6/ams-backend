import { FastifyInstance } from "fastify";
import authMiddleware from "@/middleware/auth";
import { isAdmin, isAnyStaff } from "@/middleware/roles";
import {
  listGradeEntriesHandler,
  getGradeEntryByIdHandler,
  createGradeEntryHandler,
  bulkCreateGradeEntriesHandler,
  getGradeEntryMatrixHandler,
  getGradeEntrySummaryHandler,
  bulkUpsertGradeEntriesHandler,
  updateGradeEntryHandler,
  deleteGradeEntryHandler
} from "./service";
import {
  listGradeEntriesSchema,
  getGradeEntryByIdSchema,
  createGradeEntrySchema,
  bulkCreateGradeEntriesSchema,
  gradeEntryMatrixSchema,
  gradeEntrySummarySchema,
  bulkUpsertGradeEntriesSchema,
  updateGradeEntrySchema,
  deleteGradeEntrySchema
} from "./schema";

export default async function (fastify: FastifyInstance) {
  // Apply authentication to all routes
  fastify.addHook("preHandler", authMiddleware);

  // List grade entries - any authenticated role;
  fastify.get("/", { schema: listGradeEntriesSchema }, listGradeEntriesHandler);

  // Pivoted student x grade-field matrix for one batch+subject
  fastify.get("/matrix", { schema: gradeEntryMatrixSchema, preHandler: [isAnyStaff] }, getGradeEntryMatrixHandler);

  // Per-student, per-subject capped internal totals for a whole batch for class performance / semester report
  fastify.get("/summary", { schema: gradeEntrySummarySchema, preHandler: [isAnyStaff] }, getGradeEntrySummaryHandler);

  // Get single grade entry - accessible by any staff
  fastify.get("/:id", { schema: getGradeEntryByIdSchema, preHandler: [isAnyStaff] }, getGradeEntryByIdHandler);

  // Create grade entry - any staff can create
  fastify.post("/", { schema: createGradeEntrySchema, preHandler: [isAnyStaff] }, createGradeEntryHandler);

  // Bulk create grade entries - any staff can create
  fastify.post("/bulk", { schema: bulkCreateGradeEntriesSchema, preHandler: [isAnyStaff] }, bulkCreateGradeEntriesHandler);

  // Bulk create-or-update in one DB round trip — powers the teacher grid's single "Save" button
  fastify.post("/bulk-upsert", { schema: bulkUpsertGradeEntriesSchema, preHandler: [isAnyStaff] }, bulkUpsertGradeEntriesHandler);

  // Update grade entry - any staff can update
  fastify.put("/:id", { schema: updateGradeEntrySchema, preHandler: [isAnyStaff] }, updateGradeEntryHandler);

  // Delete grade entry - admin only
  fastify.delete("/:id", { schema: deleteGradeEntrySchema, preHandler: [isAdmin] }, deleteGradeEntryHandler);
}
