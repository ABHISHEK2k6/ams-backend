import { google } from "googleapis";

export interface WorkspaceUserInput {
  first_name: string;
  last_name: string;
  role: string;
  /** Present for students; */
  candidate_code?: string;
  adm_year?: number;
  department?: string;
  /** Unique suffix used to build the email when no manual email is given — candidate code's last 2 digits for students, a random suffix otherwise. */
  unique_suffix: string;
  email?: string;
  password: string;
}

export interface WorkspaceUserResult {
  primaryEmail: string;
  error?: string;
}

/** Canonical institution email domain — single source of truth for generation and validation. */
export function getEmailDomain(): string {
  return process.env.GOOGLE_HD || "uck.ac.in";
}

/** True if `email` belongs to the configured institution domain (case-insensitive). */
export function hasRequiredEmailDomain(email: string): boolean {
  const domain = getEmailDomain().toLowerCase();
  return email.trim().toLowerCase().endsWith(`@${domain}`);
}

/**
 * Generated email format: [firstname][lastname][unique suffix]@[domain]
 * Spaces and dots are stripped from the name, and the result is lowercased.
 */
export function buildPrimaryEmail(first_name: string, last_name: string, uniqueSuffix: string): string {
  const domain = getEmailDomain();
  const clean = (value: string) => value.toLowerCase().replace(/[\s.]+/g, "");
  const first = clean(first_name);
  const last = clean(last_name);
  return `${first}${last}${uniqueSuffix.toLowerCase()}@${domain}`;
}

/** Org unit for a newly provisioned Workspace account — students are nested by year/department, everyone else is flat. */
function orgUnitPathFor(role: string, adm_year?: number, department?: string): string {
  if (role === "student" && adm_year && department) return `/Students/${adm_year}/${department}`;
  if (role === "parent") return "/Parents";
  return "/Faculty";
}

export function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

/**
 * Creates multiple Google Workspace users in a SINGLE batch HTTP request.
 * Returns a map keyed by the target primary email -> { primaryEmail, error? }
 */
export async function bulkCreateWorkspaceUsers(
  users: WorkspaceUserInput[]
): Promise<Map<string, WorkspaceUserResult>> {
  const results = new Map<string, WorkspaceUserResult>();

  if (users.length === 0) return results;

  const rawKey = process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY;
  const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL;

  if (!rawKey || !adminEmail) {
    throw new Error(
      "Missing GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY or GOOGLE_WORKSPACE_ADMIN_EMAIL env vars"
    );
  }

  let credentials: any;
  try {
    credentials = JSON.parse(rawKey);
  } catch {
    throw new Error("GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/admin.directory.user"],
    subject: adminEmail, // domain-wide delegation – impersonate admin
  });

  const admin = google.admin({ version: "directory_v1", auth });

  // Fire all insert requests concurrently — effectively the same as a batch
  const insertPromises = users.map(async (user) => {
    const primaryEmail = user.email || buildPrimaryEmail(user.first_name, user.last_name, user.unique_suffix);
    try {
      await admin.users.insert({
        requestBody: {
          primaryEmail,
          name: {
            givenName: user.first_name,
            familyName: user.last_name,
          },
          orgUnitPath: orgUnitPathFor(user.role, user.adm_year, user.department),
          ...(user.candidate_code
            ? { externalIds: [{ type: "organization", value: user.candidate_code }] }
            : {}),
          password: user.password,
          changePasswordAtNextLogin: true,
        },
      });
      results.set(primaryEmail, { primaryEmail });
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.message ||
        "Unknown error";
      results.set(primaryEmail, { primaryEmail: "", error: errMsg });
    }
  });

  await Promise.all(insertPromises);

  return results;
}
