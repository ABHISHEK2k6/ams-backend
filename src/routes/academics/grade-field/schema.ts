import { RouteShorthandOptions } from "fastify";

export const listGradeFieldsSchema: RouteShorthandOptions["schema"] = {
  querystring: {
    type: "object",
    properties: {
      page: { type: "number", minimum: 1, default: 1 },
      limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
      batch: { type: "string" },
      subject: { type: "string" },
      type: { type: "string", enum: ["exam", "assignment", "practical", "attendance", "moderation"] },
    },
  },
};

export const getGradeFieldByIdSchema: RouteShorthandOptions["schema"] = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};

export const createGradeFieldSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: ["batch", "subject", "type", "name", "total_mark", "weightage"],
    properties: {
      _id: { type: "string" },
      batch: { type: "string" }, // Batch ObjectId
      subject: { type: "string" }, // Subject ID
      type: { type: "string", enum: ["exam", "assignment", "practical", "attendance", "moderation"] },
      name: { type: "string", minLength: 1 },
      total_mark: { type: "number", minimum: 0 },
      weightage: { type: "number", minimum: 0, maximum: 100 },
      value: { type: "string" }, // Required for moderation type
      description: { type: "string" }, // Only used for assignment type
      due_date: { type: "string", format: "date-time" }, // Only used for assignment type
    },
  },
};

export const updateGradeFieldSchema: RouteShorthandOptions["schema"] = {
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
      batch: { type: "string" },
      subject: { type: "string" },
      type: { type: "string", enum: ["exam", "assignment", "practical", "attendance", "moderation"] },
      name: { type: "string", minLength: 1 },
      total_mark: { type: "number", minimum: 0 },
      weightage: { type: "number", minimum: 0, maximum: 100 },
      value: { type: "string" },
      description: { type: "string" },
      due_date: { type: "string", format: "date-time" },
    },
  },
};

export const deleteGradeFieldSchema: RouteShorthandOptions["schema"] = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};
