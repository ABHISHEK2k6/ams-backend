import { FastifyInstance } from "fastify";
import authMiddleware from "@/middleware/auth";
import { getCalendarMonthHandler, getCalendarDayHandler } from "./service";
import { getCalendarMonthSchema, getCalendarDaySchema } from "./schema";

export default async function (fastify: FastifyInstance) {
  fastify.addHook("preHandler", authMiddleware);

  // Scope is resolved server-side per role (see ./service.ts buildScopeMatch).
  fastify.get("/", { schema: getCalendarMonthSchema }, getCalendarMonthHandler);
  fastify.get("/day", { schema: getCalendarDaySchema }, getCalendarDayHandler);
}
