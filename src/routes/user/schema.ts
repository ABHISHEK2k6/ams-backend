import { RouteShorthandOptions } from "fastify";

export const userUpdateSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: [],
    properties: {
      name: { type: "string", minLength: 3 },
      password: { type: "string", minLength: 8 },
      image: { type: "string" },
      role: {
        type: "string",
        enum: [
          "student",
          "teacher",
          "parent",
          "principal",
          "hod",
          "staff",
          "admin",
        ],
      },
      phone: { type: "number" },
      first_name: { type: "string" },
      last_name: { type: "string" },
      gender: { type: "string", enum: ["male", "female", "other"] },

      student: {
        type: "object",
        required: [],
        properties: {
          adm_number: { type: "string" },
          adm_year: { type: "number" },
          candidate_code: { type: "string" },
          department: { type: "string", enum: ["CSE", "ECE", "IT"] },
          date_of_birth: { type: "string", format: "date" },
        },
        additionalProperties: false,
      },

      teacher: {
        type: "object",
        required: [],
        properties: {
          designation: { type: "string" },
          department: { type: "string" },
          date_of_joining: { type: "string", format: "date" },
        },
        additionalProperties: false,
      },

      parent: {
        type: "object",
        required: [],
        properties: {
          relation: { type: "string", enum: ["mother", "father", "guardian"] },
          childID: { type: "string" },
        },
        additionalProperties: false,
      },
    },

    allOf: [
      {
        if: {
          required: ["student"],
        },
        then: {
          properties: {
            student: {
              anyOf: [
                { required: ["adm_number"] },
                { required: ["adm_year"] },
                { required: ["candidate_code"] },
                { required: ["department"] },
                { required: ["date_of_birth"] },
              ],
            },
          },
        },
      },
      {
        if: {
          required: ["teacher"],
        },
        then: {
          properties: {
            teacher: {
              anyOf: [
                { required: ["designation"] },
                { required: ["department"] },
                { required: ["date_of_joining"] },
              ],
            },
          },
        },
      },
      {
        if: {
          required: ["parent"],
        },
        then: {
          properties: {
            parent: {
              anyOf: [
                { required: ["relation"] },
                { required: ["childID"] },
              ],
            },
          },
        },
      },
    ],

    additionalProperties: false,
  },
};

export const userCreateSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: [
      "name",
      "first_name",
      "last_name",
      "gender",
      "phone",
    ],
    properties: {
      name: { type: "string", minLength: 3 },
      password: { type: "string", minLength: 8 },
      email: { type: "string" },
      image: { type: "string" },
      phone: { type: "number" },
      first_name: { type: "string" },
      last_name: { type: "string" },
      gender: { type: "string", enum: ["male", "female", "other"] },

      student: {
        type: "object",
        required: ["adm_number", "adm_year", "date_of_birth", "department"],
        properties: {
          adm_number: { type: "string" },
          adm_year: { type: "number" },
          candidate_code: { type: "string" },
          department: { type: "string", enum: ["CSE", "ECE", "IT"] },
          date_of_birth: { type: "string", format: "date" },
        },
        additionalProperties: false,
      },

      teacher: {
        type: "object",
        required: ["designation", "date_of_joining"],
        properties: {
          designation: { type: "string" },
          department: { type: "string" },
          date_of_joining: { type: "string", format: "date" },
        },
        additionalProperties: false,
      },

      parent: {
        type: "object",
        required: ["relation", "childID"],
        properties: {
          relation: { type: "string", enum: ["mother", "father", "guardian"] },
          childID: { type: "string" },
        },
        additionalProperties: false,
      },
    },

    allOf: [
      {
        if: {
          required: ["student"],
        },
        then: {
          properties: {
            student: {
              required: ["adm_number", "adm_year", "date_of_birth", "department"],
            },
          },
        },
      },
      {
        if: {
          required: ["teacher"],
        },
        then: {
          properties: {
            teacher: {
              required: ["designation", "date_of_joining"],
            },
          },
        },
      },
      {
        if: {
          required: ["parent"],
        },
        then: {
          properties: {
            parent: {
              required: ["relation", "childID"],
            },
          },
        },
      },
    ],

    additionalProperties: false,
  },
};
