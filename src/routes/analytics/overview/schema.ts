import { RouteShorthandOptions } from "fastify";

export const getOverviewSchema: RouteShorthandOptions["schema"] = {
  querystring: {
    type: "object",
    properties: {
      atRiskThreshold: { type: "number", minimum: 0, maximum: 100, default: 75 },
      windowDays: { type: "number", minimum: 1, maximum: 180, default: 30 },
    },
  },
};
