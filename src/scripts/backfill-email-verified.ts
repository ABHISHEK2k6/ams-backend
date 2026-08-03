/**
 * Backfill `emailVerified: true` for admin-provisioned users.
 *
 * Why:
 *   Better-Auth >= 1.6.19 refuses to implicitly link a Google (OAuth) identity to an
 *   existing local user whose `emailVerified` is false — it returns `account_not_linked`,
 *   even when the provider is in `accountLinking.trustedProviders`. See
 *   `accountLinking.requireLocalEmailVerified` (defaults true, and the gate becomes
 *   unconditional in a future minor).
 *
 *   AMS accounts are never self-registered: they are provisioned by an admin against
 *   institution-owned Google Workspace mailboxes, so the address is verified by
 *   provisioning. The account-takeover scenario the flag guards against (an attacker
 *   pre-registering an unverified account at a victim's email) cannot occur here
 *   because self-signup is disabled.
 *
 *   New users get `emailVerified: true` at creation time (see routes/user/service.ts).
 *   This script fixes users created before that change.
 *
 * Usage:
 *   bun src/scripts/backfill-email-verified.ts           # dry run — reports only
 *   bun src/scripts/backfill-email-verified.ts --apply   # performs the update
 *
 * Safe to re-run — only touches docs where emailVerified is not already true.
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const APPLY = process.argv.includes("--apply");

if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI is not set. Refusing to run.");
  console.error("    Set it in your environment (or .env) before running this script.");
  process.exit(1);
}

/** Strips credentials from a connection string so it is safe to log. */
const redactUri = (uri: string): string => uri.replace(/\/\/[^@]*@/, "//<redacted>@");

async function run() {
  await mongoose.connect(MONGODB_URI!);
  console.log("✅  Connected to MongoDB:", redactUri(MONGODB_URI!));

  const userCol = mongoose.connection.db!.collection("user");

  const filter = { emailVerified: { $ne: true } };
  const affected = await userCol.countDocuments(filter);
  const total = await userCol.countDocuments({});

  console.log(`\n📊  ${affected} of ${total} users have emailVerified !== true.`);

  if (affected === 0) {
    console.log("✅  Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  const sample = await userCol
    .find(filter)
    .project({ email: 1, role: 1, emailVerified: 1 })
    .limit(10)
    .toArray();
  console.log("\n   Sample of affected users:");
  for (const u of sample) {
    console.log(`   - ${u.email}  (role: ${u.role}, emailVerified: ${u.emailVerified})`);
  }
  if (affected > sample.length) {
    console.log(`   … and ${affected - sample.length} more.`);
  }

  if (!APPLY) {
    console.log("\n⚠️   DRY RUN — no changes written.");
    console.log("    Re-run with --apply to perform the update.\n");
    await mongoose.disconnect();
    return;
  }

  const result = await userCol.updateMany(filter, {
    $set: { emailVerified: true, updatedAt: new Date() },
  });
  console.log(`\n✅  Updated ${result.modifiedCount} users.\n`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("❌  Backfill failed:", err);
  process.exit(1);
});
