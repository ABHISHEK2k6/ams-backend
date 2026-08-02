/**
 * Shared access-hierarchy scope filter.
 *
 * staff advisor (teacher) -> their single advised batch
 * hod                     -> all batches in their department
 * principal / admin       -> all batches, no filter
 *
 * See docs/phase-2-grades/unified-dashboard.md § Access Hierarchy
 */

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
