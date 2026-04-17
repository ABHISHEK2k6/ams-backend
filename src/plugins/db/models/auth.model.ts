import mongoose, { InferSchemaType } from "mongoose";

const { Schema, model } = mongoose;

// ─── Profile interfaces (TypeScript-level enforcement) ──────────────────────

export interface StudentProfile {
  adm_number?: string;
  adm_year?: number;
  candidate_code?: string;
  department?: "CSE" | "ECE" | "IT";
  date_of_birth?: Date;
  batch?: mongoose.Types.ObjectId; // ref: Batch
}

export interface StaffProfile {
  designation?: string;
  department?: string;
  date_of_joining?: Date;
}

export interface ParentProfile {
  relation?: "mother" | "father" | "guardian";
  child?: mongoose.Types.ObjectId; // ref: User (student)
}

export type UserProfile = StudentProfile | StaffProfile | ParentProfile | Record<string, never>;

// ─── User (unified) ─────────────────────────────────────────────────────────

const userSchema = new Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId },
    // Better-Auth managed
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Boolean, required: true },
    image: { type: String },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },

    // AMS core fields
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    role: {
      type: String,
      required: true,
      default: "student",
      enum: ["student", "teacher", "parent", "principal", "hod", "staff", "admin"],
    },
    gender: {
      type: String,
      required: false,
      enum: ["male", "female", "other"],
    },
    phone: { type: Number, required: true },
    password_hash: { type: String, required: false },

    // Role-specific data — shape varies by role, typed via UserProfile interfaces above
    profile: { type: Schema.Types.Mixed, default: {} },
  },
  { collection: "user" },
);

// Enforce unique student onboarding identifiers when present.
userSchema.index(
  { "profile.adm_number": 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: "student",
      "profile.adm_number": { $exists: true, $type: "string" },
    },
  }
);

userSchema.index(
  { "profile.candidate_code": 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: "student",
      "profile.candidate_code": { $exists: true, $type: "string" },
    },
  }
);

// ─── Auth supporting collections (Better-Auth managed) ──────────────────────

const sessionSchema = new Schema(
  {
    _id: { type: String },
    expiresAt: { type: Date, required: true },
    token: { type: String, required: true, unique: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    userId: { type: String, ref: "User", required: true },
  },
  { collection: "session" },
);

const accountSchema = new Schema(
  {
    _id: { type: String },
    accountId: { type: String, required: true },
    providerId: { type: String, required: true },
    userId: { type: String, ref: "User", required: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    idToken: { type: String },
    accessTokenExpiresAt: { type: Date },
    refreshTokenExpiresAt: { type: Date },
    scope: { type: String },
    password: { type: String },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: "account" },
);

const verificationSchema = new Schema(
  {
    _id: { type: String },
    identifier: { type: String, required: true },
    value: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { collection: "verification" },
);

// ─── Exports ─────────────────────────────────────────────────────────────────

const User = model("User", userSchema);
const Session = model("Session", sessionSchema);
const Account = model("Account", accountSchema);
const Verification = model("Verification", verificationSchema);

export type UserType = InferSchemaType<typeof userSchema>;
export type SessionType = InferSchemaType<typeof sessionSchema>;

export { User, Session, Account, Verification };
