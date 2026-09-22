/**
 * Multi Batch Director migration — Batch.directorId (single ObjectId ref)
 * became Batch.directorIds (ObjectId[]) so a batch can have more than one
 * Batch Director. Any batch document written before this change still has
 * its old `directorId` field sitting in MongoDB — Mongoose's schema no
 * longer declares it, so it's simply ignored on read, which means an
 * existing single-director assignment would otherwise silently disappear
 * (directorIds defaults to `[]`) the first time nothing touches that batch.
 *
 * This script copies every batch's old `directorId` into a one-element
 * `directorIds` array and only then unsets the legacy field, so a batch
 * that already has `directorIds` set (created after this change) is left
 * untouched, and nothing is ever deleted without first being carried
 * forward.
 *
 * Safe to re-run: once migrated, a batch has no `directorId` left to find,
 * so a second run reports zero candidates.
 *
 * Usage:
 *   npm run migrate:batch-multi-director            # dry run — reports only, writes nothing
 *   npm run migrate:batch-multi-director -- --apply # applies the migration
 */
import mongoose, { Types } from "mongoose";
import { connectDB, disconnectDB } from "../config/db";

const APPLY = process.argv.includes("--apply");

interface RawBatch {
  _id: Types.ObjectId;
  name?: string;
  directorId?: Types.ObjectId;
  directorIds?: Types.ObjectId[];
}

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection");

  const batchesCol = db.collection<RawBatch>("batches");

  const candidates = await batchesCol.find({ directorId: { $exists: true } }).toArray();
  console.log(`\nপুরনো একক directorId থাকা মোট ব্যাচ: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log("মাইগ্রেট করার মতো কিছু নেই।");
    await disconnectDB();
    return;
  }

  for (const b of candidates) {
    const already = (b.directorIds ?? []).some((id) => String(id) === String(b.directorId));
    console.log(`  - ${b.name ?? b._id}: directorId=${b.directorId}${already ? " (ইতিমধ্যে directorIds-এ আছে)" : ""}`);
  }

  if (!APPLY) {
    console.log("\n--- এটি একটি DRY RUN — কোনো পরিবর্তন লেখা হয়নি ---");
    console.log("প্রকৃতভাবে চালাতে: npm run migrate:batch-multi-director -- --apply");
    await disconnectDB();
    return;
  }

  let updated = 0;
  for (const b of candidates) {
    if (!b.directorId) continue;
    const existing = b.directorIds ?? [];
    const merged = existing.some((id) => String(id) === String(b.directorId)) ? existing : [...existing, b.directorId];
    await batchesCol.updateOne({ _id: b._id }, { $set: { directorIds: merged }, $unset: { directorId: "" } });
    updated++;
  }
  console.log(`\n✅ আপডেট করা হয়েছে: ${updated} ব্যাচ রেকর্ড`);
  console.log("--- মাইগ্রেশন সম্পন্ন ---");
  await disconnectDB();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
