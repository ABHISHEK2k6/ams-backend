/**
 * Backfill `sem` (and `archived: false`) on existing AttendanceSession documents.
 *
 * Why:
 *   AttendanceSession now snapshots the batch's semester (`sem`) at creation time, and an
 *   `archived` flag gets set when the owning batch later advances past that semester (see
 *   `advanceSemHandler` in routes/academics/batch/service.ts). Sessions created before this
 *   change have neither field.
 *
 *   There's no way to reconstruct which semester a pre-existing session actually belonged to
 *   — Batch.sem has always been a single live-mutable value with no history log. This script
 *   snapshots each such session at its batch's *current* sem instead of guessing, and leaves
 *   it unarchived. Archival becomes fully accurate starting from the next semester advance —
 *   existing data is preserved, not dropped or approximated beyond "as of now."
 *
 * Usage:
 *   bun src/scripts/backfill-attendance-session-sem.ts           # dry run — reports only
 *   bun src/scripts/backfill-attendance-session-sem.ts --apply   # performs the update
 *
 * Safe to re-run — only touches sessions that don't yet have a `sem` field.
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

  const db = mongoose.connection.db!;
  const sessionCol = db.collection("attendance_session");
  const batchCol = db.collection("batch");

  const filter = { sem: { $exists: false } };
  const affected = await sessionCol.countDocuments(filter);
  const total = await sessionCol.countDocuments({});

  console.log(`\n📊  ${affected} of ${total} attendance sessions are missing \`sem\`.`);

  if (affected === 0) {
    console.log("✅  Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  // Preload every batch's current sem — one query, not one per session.
  const batches = await batchCol.find({}).project({ sem: 1 }).toArray();
  const semByBatchId = new Map(batches.map((b) => [b._id.toString(), b.sem as string]));

  const sessionsToFix = await sessionCol.find(filter).project({ batch: 1 }).toArray();
  const missingBatch: string[] = [];
  const updatesBySem = new Map<string, mongoose.mongo.BSON.ObjectId[]>();

  for (const session of sessionsToFix) {
    const sem = semByBatchId.get(session.batch?.toString());
    if (!sem) {
      missingBatch.push(session._id.toString());
      continue;
    }
    const bucket = updatesBySem.get(sem) ?? [];
    bucket.push(session._id);
    updatesBySem.set(sem, bucket);
  }

  console.log(`\n   Grouped into ${updatesBySem.size} distinct semester value(s).`);
  if (missingBatch.length > 0) {
    console.log(`   ⚠️   ${missingBatch.length} session(s) reference a batch that no longer exists — skipped.`);
    console.log(`        Sample ids: ${missingBatch.slice(0, 5).join(", ")}`);
  }

  if (!APPLY) {
    console.log("\n⚠️   DRY RUN — no changes written.");
    console.log("    Re-run with --apply to perform the update.\n");
    await mongoose.disconnect();
    return;
  }

  let modified = 0;
  for (const [sem, ids] of updatesBySem) {
    const result = await sessionCol.updateMany(
      { _id: { $in: ids } },
      { $set: { sem, archived: false } }
    );
    modified += result.modifiedCount;
  }
  console.log(`\n✅  Updated ${modified} sessions.\n`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("❌  Backfill failed:", err);
  process.exit(1);
});
