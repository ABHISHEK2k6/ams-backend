import { RouteShorthandOptions } from "fastify";

export const listBatchesSchema: RouteShorthandOptions["schema"] = {
  querystring: {
    type: "object",
    properties: {
      page: { type: "number", minimum: 1, default: 1 },
      limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
      department: { type: "string", enum: ["CSE", "ECE", "IT"] },
      adm_year: { type: "number" },
    },
  },
};

export const getBatchByIdSchema: RouteShorthandOptions["schema"] = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};

export const createBatchSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: ["name", "adm_year", "department", "staff_advisor"],
    properties: {
      name: { type: "string", minLength: 1 },
      id: { type: "string", pattern: "^[0-9]{2}[A-Z]{2,3}[0-9]*$" },
      batch_id: { type: "string", pattern: "^[0-9]{2}[A-Z]{2,3}[0-9]*$" },
      adm_year: { type: "number", minimum: 2000, maximum: 2100 },
      department: { type: "string", enum: ["CSE", "ECE", "IT"] },
      staff_advisor: { type: "string" }, // Teacher ObjectId
    },
  },
};

export const updateBatchSchema: RouteShorthandOptions["schema"] = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1 },
      id: { type: "string", pattern: "^[0-9]{2}[A-Z]{2,3}[0-9]*$" },
      batch_id: { type: "string", pattern: "^[0-9]{2}[A-Z]{2,3}[0-9]*$" },
      adm_year: { type: "number", minimum: 2000, maximum: 2100 },
      department: { type: "string", enum: ["CSE", "ECE", "IT"] },
      staff_advisor: { type: "string" }, // Teacher ObjectId
    },
  },
};

export const deleteBatchSchema: RouteShorthandOptions["schema"] = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};
