import { FastifyInstance } from "fastify";
import authMiddleware from "@/middleware/auth";
import { isAnyStaff } from "@/middleware/roles";
import { getOverviewHandler } from "./service";
import { getOverviewSchema } from "./schema";

export default async function (fastify: FastifyInstance) {
  fastify.addHook("preHandler", authMiddleware);

  // Scope is resolved server-side from the caller's role (see @/lib/scope).
  fastify.get("/", { schema: getOverviewSchema, preHandler: [isAnyStaff] }, getOverviewHandler);
}
