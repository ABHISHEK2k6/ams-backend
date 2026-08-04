/**
 * Shared access-hierarchy scope filter.
 *
 * staff advisor (teacher) -> their single advised batch
 * hod                     -> all batches in their department
 * principal / admin       -> all batches, no filter
 *
 * See docs/phase-2-grades/unified-dashboard.md § Access Hierarchy
 */

import mongoose from "mongoose";

/**
 * Normalizes a value that's supposed to be a Mongo ObjectId reference — already-cast
 */
export function resolveObjectIdString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }
  if (typeof value === "string") {
    return mongoose.Types.ObjectId.isValid(value) ? value : undefined;
  }
  if (typeof value === "object" && "_id" in (value as Record<string, unknown>)) {
    return resolveObjectIdString((value as Record<string, unknown>)._id);
  }
  const str = String(value);
  return mongoose.Types.ObjectId.isValid(str) ? str : undefined;
}

export interface ScopedUser {
  _id: unknown;
  role: string;
  profile?: { department?: string } | null;
}

export function getScopeBatchFilter(user: ScopedUser): Record<string, unknown> {
  switch (user.role) {
    case "admin":
    case "principal":
      return {};
    case "hod":
      return { department: user.profile?.department };
    case "teacher":
      return { staff_advisor: user._id };
    default:
      // staff/student/parent — no institutional analytics scope
      return { _id: null };
  }
}
