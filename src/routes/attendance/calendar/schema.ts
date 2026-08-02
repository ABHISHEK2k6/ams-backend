import { RouteShorthandOptions } from "fastify";

export const getCalendarMonthSchema: RouteShorthandOptions["schema"] = {
  querystring: {
    type: "object",
    required: ["month", "year"],
    properties: {
      month: { type: "number", minimum: 1, maximum: 12 },
      year: { type: "number", minimum: 2000, maximum: 2100 },
      batch: { type: "string" },
      subject: { type: "string" },
    },
  },
};

export const getCalendarDaySchema: RouteShorthandOptions["schema"] = {
  querystring: {
    type: "object",
    required: ["date"],
    properties: {
      date: { type: "string" }, // ISO date, e.g. 2026-08-03
      batch: { type: "string" },
      subject: { type: "string" },
    },
  },
};
