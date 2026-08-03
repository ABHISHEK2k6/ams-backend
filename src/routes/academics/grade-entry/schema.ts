import { RouteShorthandOptions } from "fastify";

export const listGradeEntriesSchema: RouteShorthandOptions["schema"] = {
  querystring: {
    type: "object",
    properties: {
      page: { type: "number", minimum: 1, default: 1 },
      limit: { type: "number", minimum: 1, maximum: 500, default: 10 },
      user: { type: "string" },
      grade_field: { type: "string" },
      is_absent: { type: "boolean" },
    },
  },
};

export const getGradeEntryByIdSchema: RouteShorthandOptions["schema"] = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};

export const createGradeEntrySchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: ["user", "grade_field", "mark", "is_absent"],
    properties: {
      _id: { type: "string" },
      user: { type: "string" }, // User ObjectId
      grade_field: { type: "string" }, // GradeField ObjectId
      mark: { type: "number", minimum: 0 },
      is_absent: { type: "boolean" },
      remarks: { type: "string" },
    },
  },
};

export const bulkCreateGradeEntriesSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: ["entries"],
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          required: ["user", "grade_field", "mark", "is_absent"],
          properties: {
            _id: { type: "string" },
            user: { type: "string" },
            grade_field: { type: "string" },
            mark: { type: "number", minimum: 0 },
            is_absent: { type: "boolean" },
            remarks: { type: "string" },
          },
        },
        minItems: 1,
      },
    },
  },
};

export const gradeEntryMatrixSchema: RouteShorthandOptions["schema"] = {
  querystring: {
    type: "object",
    required: ["batch", "subject"],
    properties: {
      batch: { type: "string" },
      subject: { type: "string" },
    },
  },
};

export const gradeEntrySummarySchema: RouteShorthandOptions["schema"] = {
  querystring: {
    type: "object",
    required: ["batch"],
    properties: {
      batch: { type: "string" },
    },
  },
};

export const bulkUpsertGradeEntriesSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: ["entries"],
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          required: ["user", "grade_field", "mark", "is_absent"],
          properties: {
            user: { type: "string" },
            grade_field: { type: "string" },
            mark: { type: "number", minimum: 0 },
            is_absent: { type: "boolean" },
            remarks: { type: "string" },
          },
        },
        minItems: 1,
      },
    },
  },
};

export const updateGradeEntrySchema: RouteShorthandOptions["schema"] = {
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
      user: { type: "string" },
      grade_field: { type: "string" },
      mark: { type: "number", minimum: 0 },
      is_absent: { type: "boolean" },
      remarks: { type: "string" },
    },
  },
};

export const deleteGradeEntrySchema: RouteShorthandOptions["schema"] = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};
