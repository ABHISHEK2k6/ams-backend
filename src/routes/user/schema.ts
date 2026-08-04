import { RouteShorthandOptions } from "fastify";

// ─── List ─────────────────────────────────────────────────────────────────────

export const userListSchema: RouteShorthandOptions["schema"] = {
  querystring: {
    type: "object",
    required: ["role"],
    properties: {
      page: { type: "number", minimum: 1, default: 1 },
      limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
      role: {
        type: "string",
        enum: ["student", "teacher", "parent", "principal", "hod", "staff", "admin"],
      },
      search: { type: "string", minLength: 1 },
      batch: { type: "string" },
    },
  },
};

// ─── Shared profile sub-schemas ───────────────────────────────────────────────

const studentProfileSchema = {
  type: "object",
  properties: {
    adm_number:     { type: "string" },
    adm_year:       { type: "number" },
    candidate_code: { type: "string" },
    department:     { type: "string", enum: ["CSE", "ECE", "IT"] },
    date_of_birth:  { type: "string", format: "date" },
    batch:          { type: "string" },
  },
  additionalProperties: false,
};

const staffProfileSchema = {
  type: "object",
  required: ["designation", "date_of_joining"],
  properties: {
    designation:    { type: "string" },
    department:     { type: "string" },
    date_of_joining:{ type: "string", format: "date" },
  },
  additionalProperties: false,
};

const parentProfileSchema = {
  type: "object",
  required: ["relation", "child_candidate_code"],
  properties: {
    relation: { type: "string", enum: ["mother", "father", "guardian"] },
    child_candidate_code: { type: "string" }, // candidate code of the student child, resolved to User._id server-side
  },
  additionalProperties: false,
};

// ─── Onboarding (POST /user) ──────────────────────────────────────────────────
// Called during the onboarding flow to complete a user's profile.

export const userCreateSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: ["first_name", "last_name", "gender", "phone"],
    properties: {
      image:      { type: "string" },
      phone:      { type: "number" },
      first_name: { type: "string", minLength: 1 },
      last_name:  { type: "string", minLength: 1 },
      gender:     { type: "string", enum: ["male", "female", "other"] },
      profile:    { type: "object", additionalProperties: true },
    },
    additionalProperties: false,
  },
};

// ─── Update (PUT /user or PUT /user/:id) ──────────────────────────────────────

export const userUpdateSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: [],
    properties: {
      password:   { type: "string", minLength: 8 },
      image:      { type: "string" },
      role: {
        type: "string",
        enum: ["student", "teacher", "parent", "principal", "hod", "staff", "admin"],
      },
      phone:      { type: "number" },
      first_name: { type: "string", minLength: 1 },
      last_name:  { type: "string", minLength: 1 },
      gender:     { type: "string", enum: ["male", "female", "other"] },
      profile:    { type: "object", additionalProperties: true },
    },
    additionalProperties: false,
  },
};

// ─── Bulk create (POST /user/bulk) ─────────────────────────────────────────────

export const bulkCreateSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: ["users"],
    properties: {
      users: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["first_name", "last_name", "role"],
          properties: {
            email:          { type: "string", format: "email" },
            generate_mail:  { type: "boolean", default: false },
            password:       { type: "string", minLength: 8 },
            first_name:     { type: "string", minLength: 1 },
            last_name:      { type: "string", minLength: 1 },
            role: {
              type: "string",
              enum: ["student", "teacher", "parent", "principal", "hod", "staff", "admin"],
            },
            // Student-specific flat fields (mapped to profile in service)
            adm_number:     { type: "string" },
            adm_year:       { type: "number" },
            candidate_code: { type: "string" },
            department:     { type: "string" },
            date_of_birth:  { type: "string", format: "date" },
            batch:          { type: "string" },
            // Staff-specific flat fields (teacher/hod/principal/staff/admin)
            designation:    { type: "string" },
            date_of_joining:{ type: "string", format: "date" },
            // Parent-specific flat fields
            relation:       { type: "string", enum: ["mother", "father", "guardian"] },
            child_candidate_code: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
};

// ─── Set Password ──────────────────────────────────────────────────────────────

export const setPasswordSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: ["newPassword"],
    properties: {
      newPassword: { type: "string", minLength: 8 },
    },
    additionalProperties: false,
  },
};

// ─── Admin Reset Password ──────────────────────────────────────────────────────

export const resetPasswordSchema: RouteShorthandOptions["schema"] = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
  body: {
    type: "object",
    required: ["newPassword"],
    properties: {
      newPassword: { type: "string", minLength: 8 },
    },
    additionalProperties: false,
  },
};

export { studentProfileSchema, staffProfileSchema, parentProfileSchema };
