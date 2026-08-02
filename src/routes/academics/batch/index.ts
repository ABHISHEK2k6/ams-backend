import { FastifyInstance } from "fastify";
import authMiddleware from "@/middleware/auth";
import { isAdmin, isAnyStaff, isParent } from "@/middleware/roles";
import { 
  listBatchesHandler, 
  getBatchByIdHandler, 
  createBatchHandler, 
  updateBatchHandler, 
  deleteBatchHandler 
} from "./service";
import { 
  listBatchesSchema, 
  getBatchByIdSchema, 
  createBatchSchema, 
  updateBatchSchema, 
  deleteBatchSchema 
} from "./schema";

export default async function (fastify: FastifyInstance) {
  // Apply authentication to all routes
  fastify.addHook("preHandler", authMiddleware);

  // List all batches - accessible by any staff
  fastify.get("/", { schema: listBatchesSchema, preHandler: [isAnyStaff] }, listBatchesHandler);

  // Get single batch - accessible by any staff
  fastify.get("/:id", { schema: getBatchByIdSchema, preHandler: [isAnyStaff,isParent] }, getBatchByIdHandler);

  // Create batch - admin only
  fastify.post("/", { schema: createBatchSchema, preHandler: [isAdmin] }, createBatchHandler);

  // Update batch - admin only
  fastify.put("/:id", { schema: updateBatchSchema, preHandler: [isAdmin] }, updateBatchHandler);

  // Delete batch - admin only
  fastify.delete("/:id", { schema: deleteBatchSchema, preHandler: [isAdmin] }, deleteBatchHandler);
}
