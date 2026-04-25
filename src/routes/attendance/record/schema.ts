import { RouteShorthandOptions } from "fastify";

export const recordCreateSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: ["session", "student", "status"],
    properties: {
      session: { type: "string" },
      student: { type: "string" },
      status: { 
        type: "string", 
        enum: ["present", "absent", "late", "excused"] 
      },
      remarks: { type: "string" },
    },
  },
};

export const recordBulkCreateSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: ["session", "records"],
    properties: {
      session: { type: "string" },
      records: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["student", "status"],
          properties: {
            student: { type: "string" },
            status: { 
              type: "string", 
              enum: ["present", "absent", "late", "excused"] 
            },
            remarks: { type: "string" },
          },
        },
      },
    },
  },
};

export const recordUpdateSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: [],
    properties: {
      status: { 
        type: "string", 
        enum: ["present", "absent", "late", "excused"] 
      },
      remarks: { type: "string" },
    },
  },
};

export const recordListSchema: RouteShorthandOptions["schema"] = {
  querystring: {
    type: "object",
    required: [],
    properties: {
      page: { type: "number", minimum: 1, default: 1 },
      limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
      session: { type: "string" },
      student: { type: "string" },
      subject: { type: "string" },
      status: { 
        type: "string", 
        enum: ["present", "absent", "late", "excused"] 
      },
      from_date: { type: "string", format: "date" },
      to_date: { type: "string", format: "date" },
    },
  },
};
