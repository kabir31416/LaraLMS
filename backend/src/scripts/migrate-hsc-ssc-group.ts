/**
 * HSC/SSC "বিভাগ" (renamed from "গ্রুপ") canonicalization — HSC-Institution-
 * Autocomplete/বিভাগ audit §5/§8/§13.
 *
 * `hscGroup`/`sscGroup` on the Student model were free-text strings with no
 * enum anywhere (backend or frontend) before this task, so existing records
 * can carry any spelling a staff member ever typed — English names
 * ("Science", "Commerce"), old Bengali synonyms ("বাণিজ্য" for ব্যবসায়), mixed
 * case, or stray whitespace. The new canonical list (student.constants.ts's
 * HSC_SSC_GROUPS) is only three values: বিজ্ঞান / মানবিক / ব্যবসায়.
 *
 * This script normalizes every *confidently mappable* old value to its
 * canonical equivalent. It NEVER deletes or blanks a value it doesn't
 * recognize — an unmapped value is left exactly as-is and printed in the
 * report for manual review, per the "never silently delete data" rule
 * (Data Safety audit §13). Values already equal to a canonical option are
 * left untouched.
 *
 * Safe to re-run: after an --apply run, every mapped value already equals
 * its canonical form, so a second run finds nothing left to change for
 * those records (only the still-unmapped ones keep showing up, which is
 * intentional — they need a human decision, not a guess).
 *
 * Usage:
 *   npm run migrate:hsc-ssc-group            # dry run — reports only, writes nothing
 *   npm run migrate:hsc-ssc-group -- --apply # applies the migration
 */
import mongoose, { Types } from "mongoose";
import { connectDB, disconnectDB } from "../config/db";
import { HSC_SSC_GROUPS } from "../modules/students/student.constants";

const APPLY = process.argv.includes("--apply");

type Canonical = (typeof HSC_SSC_GROUPS)[number];

/**
 * Known old spellings -> canonical বিভাগ. Matching is case-insensitive and
 * whitespace-trimmed but otherwise EXACT (no fuzzy/substring matching) — a
 * wrong automatic merge here would silently change a student's actual HSC/
 * SSC background, which is far worse than leaving an unrecognized value for
 * manual review.
 */
const KNOWN_MAPPINGS: Record<string, Canonical> = {
  "science": "বিজ্ঞান",
  "বিজ্ঞান": "বিজ্ঞান",

  "arts": "মানবিক",
  "humanities": "মানবিক",
  "মানবিক": "মানবিক",

  "commerce": "ব্যবসায়",
  "business": "ব্যবসায়",
  "business studies": "ব্যবসায়",
  "বাণিজ্য": "ব্যবসায়",
  "ব্যবসা": "ব্যবসায়",
  "ব্যবসায়": "ব্যবসায়",
};

function resolveCanonical(raw: string): Canonical | null {
  const key = raw.trim().toLowerCase();
  return KNOWN_MAPPINGS[key] ?? null;
}

interface RawStudent {
  _id: Types.ObjectId;
  name?: string;
  hscGroup?: string;
  sscGroup?: string;
}

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection");

  const studentsCol = db.collection<RawStudent>("students");

  const candidates = await studentsCol
    .find({ $or: [{ hscGroup: { $exists: true, $ne: "" } }, { sscGroup: { $exists: true, $ne: "" } }] })
    .toArray();

  console.log(`\nHSC/SSC বিভাগ থাকা মোট শিক্ষার্থী: ${candidates.length}`);

  let hscMapped = 0;
  let sscMapped = 0;
  const unmapped = new Map<string, number>();
  const updates: { _id: Types.ObjectId; $set: Record<string, string> }[] = [];

  for (const s of candidates) {
    const set: Record<string, string> = {};

    if (s.hscGroup && !(HSC_SSC_GROUPS as readonly string[]).includes(s.hscGroup)) {
      const canonical = resolveCanonical(s.hscGroup);
      if (canonical) {
        set.hscGroup = canonical;
        hscMapped++;
      } else {
        unmapped.set(s.hscGroup, (unmapped.get(s.hscGroup) ?? 0) + 1);
      }
    }

    if (s.sscGroup && !(HSC_SSC_GROUPS as readonly string[]).includes(s.sscGroup)) {
      const canonical = resolveCanonical(s.sscGroup);
      if (canonical) {
        set.sscGroup = canonical;
        sscMapped++;
      } else {
        unmapped.set(s.sscGroup, (unmapped.get(s.sscGroup) ?? 0) + 1);
      }
    }

    if (Object.keys(set).length > 0) updates.push({ _id: s._id, $set: set });
  }

  console.log(`ম্যাপযোগ্য HSC বিভাগ মান: ${hscMapped}`);
  console.log(`ম্যাপযোগ্য SSC বিভাগ মান: ${sscMapped}`);

  if (unmapped.size > 0) {
    console.log(`\n⚠️  স্বয়ংক্রিয়ভাবে ম্যাপ করা যায়নি এমন মান (ম্যানুয়ালি পর্যালোচনা প্রয়োজন, কোনো পরিবর্তন করা হয়নি):`);
    for (const [value, count] of unmapped.entries()) {
      console.log(`  - "${value}": ${count}টি শিক্ষার্থী`);
    }
  } else {
    console.log("\nসব বিদ্যমান মান হয় ইতিমধ্যে ক্যানোনিক্যাল অথবা সফলভাবে ম্যাপযোগ্য।");
  }

  if (!APPLY) {
    console.log("\n--- এটি একটি DRY RUN — কোনো পরিবর্তন লেখা হয়নি ---");
    console.log("প্রকৃতভাবে চালাতে: npm run migrate:hsc-ssc-group -- --apply");
    await disconnectDB();
    return;
  }

  let updated = 0;
  for (const u of updates) {
    await studentsCol.updateOne({ _id: u._id }, { $set: u.$set });
    updated++;
  }
  console.log(`\n✅ আপডেট করা হয়েছে: ${updated} শিক্ষার্থী রেকর্ড`);
  console.log("--- মাইগ্রেশন সম্পন্ন ---");
  await disconnectDB();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
