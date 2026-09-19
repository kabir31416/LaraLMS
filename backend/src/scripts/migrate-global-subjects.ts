/**
 * Subject/Course Refactor — one-time migration from the old
 *   Course → Subject(courseId) → Lecture(subjectId)
 * shape to the new
 *   Course → CourseSubject → Subject(global) → Lecture(courseSubjectId)
 * shape.
 *
 * Before this migration, every Subject belonged to exactly one Course, so
 * "বাংলা" needed in 3 Courses meant 3 separate Subject documents with the
 * same name. This script:
 *   1. Groups existing Subject documents by exact-trimmed name.
 *   2. Keeps ONE canonical Subject per name (the oldest by _id), unsets its
 *      old `courseId` field — it's now global.
 *   3. Creates a CourseSubject row for every (courseId, canonical subject)
 *      pair that used to exist as a separate Subject document — so every
 *      Course keeps exactly the Subjects it had before, just via the new
 *      relationship.
 *   4. Repoints every Lecture from its old `subjectId` to the CourseSubject
 *      row that represents "this Lecture's original (course, subject)"
 *      combination — so Lectures under the same Subject name in different
 *      Courses stay completely independent, exactly as before.
 *   5. Repoints every OfflineExam's `subjectId` to the canonical Subject and
 *      sets its new `courseSubjectId`; repoints Material.subjectId (an
 *      optional reference) to the canonical Subject too.
 *   6. Deletes the now-redundant non-canonical Subject documents — only
 *      after every reference to them has been repointed.
 *
 * Matching is EXACT (trim only, case-sensitive) — never fuzzy — per the
 * "duplicate subject handling" requirement: a wrong automatic merge is far
 * more damaging than leaving two similarly-named Subjects unmerged for a
 * human to review. Case/whitespace-only near-duplicates that this script
 * deliberately does NOT merge are printed at the end for manual review.
 *
 * Safe to re-run: after a successful --apply run, every Subject name is
 * already unique (no groups larger than 1), so a second run finds nothing
 * left to do.
 *
 * Usage:
 *   npm run migrate:global-subjects            # dry run — reports only, writes nothing
 *   npm run migrate:global-subjects -- --apply # applies the migration
 */
import mongoose, { Types } from "mongoose";
import { connectDB, disconnectDB } from "../config/db";

const APPLY = process.argv.includes("--apply");

interface RawSubject {
  _id: Types.ObjectId;
  name: string;
  courseId?: Types.ObjectId;
  code?: string;
  status?: string;
  displayOrder?: number;
  createdAt?: Date;
}

function normalize(name: string): string {
  return name.trim();
}

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection");

  const subjectsCol = db.collection<RawSubject>("subjects");
  const courseSubjectsCol = db.collection("coursesubjects");
  const lecturesCol = db.collection("lectures");
  const examsCol = db.collection("offlineexams");
  const materialsCol = db.collection("materials");

  const allSubjects = await subjectsCol.find({}).toArray();
  console.log(`\nমোট Subject ডকুমেন্ট পাওয়া গেছে: ${allSubjects.length}`);

  // -------- Group by exact-trimmed name --------
  const groups = new Map<string, RawSubject[]>();
  for (const s of allSubjects) {
    const key = normalize(s.name);
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }

  const duplicateGroups = Array.from(groups.entries()).filter(([, docs]) => docs.length > 1);
  console.log(`একাধিক কোর্সে ডুপ্লিকেট থাকা Subject নাম: ${duplicateGroups.length}`);
  for (const [name, docs] of duplicateGroups) {
    console.log(`  - "${name}": ${docs.length}টি কোর্সে (${docs.map((d) => String(d.courseId)).join(", ")})`);
  }

  // -------- Near-duplicate report (never auto-merged) --------
  const byLoose = new Map<string, string[]>();
  for (const key of groups.keys()) {
    const loose = key.toLowerCase();
    const arr = byLoose.get(loose) ?? [];
    arr.push(key);
    byLoose.set(loose, arr);
  }
  const ambiguous = Array.from(byLoose.values()).filter((names) => new Set(names).size > 1);
  if (ambiguous.length > 0) {
    console.log(`\n⚠️  সম্ভাব্য কাছাকাছি (কিন্তু স্বয়ংক্রিয়ভাবে মার্জ করা হয়নি) নাম — ম্যানুয়ালি পর্যালোচনা করুন:`);
    for (const names of ambiguous) console.log(`  - ${names.map((n) => `"${n}"`).join(" vs ")}`);
  }

  // -------- Build canonical + id-mapping tables --------
  const canonicalIdByName = new Map<string, Types.ObjectId>();
  /** Every OLD subject _id (canonical or not) -> the canonical Subject _id it now represents. */
  const oldToCanonical = new Map<string, Types.ObjectId>();
  /** Every OLD subject _id -> the CourseSubject _id representing (that subject's original courseId, canonical subject). Only meaningful for subjects that actually had a courseId (all of them, pre-migration). */
  const oldToCourseSubject = new Map<string, Types.ObjectId>();
  /** Planned CourseSubject inserts, keyed by "courseId:subjectId" to dedupe. */
  const courseSubjectPlans = new Map<string, { courseId: Types.ObjectId; subjectId: Types.ObjectId; order: number; status: string }>();

  for (const [name, docs] of groups.entries()) {
    // Oldest _id (ObjectId is roughly creation-ordered) survives as canonical.
    const sorted = [...docs].sort((a, b) => a._id.toString().localeCompare(b._id.toString()));
    const canonical = sorted[0];
    canonicalIdByName.set(name, canonical._id);
    for (const doc of docs) {
      oldToCanonical.set(String(doc._id), canonical._id);
      if (doc.courseId) {
        const key = `${doc.courseId}:${canonical._id}`;
        if (!courseSubjectPlans.has(key)) {
          courseSubjectPlans.set(key, {
            courseId: doc.courseId,
            subjectId: canonical._id,
            order: doc.displayOrder ?? 0,
            status: doc.status ?? "সক্রিয়",
          });
        }
      }
    }
  }

  console.log(`\nমোট Global Subject থাকবে: ${canonicalIdByName.size}`);
  console.log(`মোট CourseSubject তৈরি হবে: ${courseSubjectPlans.size}`);

  if (!APPLY) {
    console.log("\n--- এটি একটি DRY RUN — কোনো পরিবর্তন লেখা হয়নি ---");
    console.log("প্রকৃতভাবে চালাতে: npm run migrate:global-subjects -- --apply");
    await disconnectDB();
    return;
  }

  // -------- 1. Insert CourseSubject rows (skip ones that already exist — idempotent) --------
  let createdCourseSubjects = 0;
  for (const plan of courseSubjectPlans.values()) {
    const existing = await courseSubjectsCol.findOne({ courseId: plan.courseId, subjectId: plan.subjectId });
    let courseSubjectId: Types.ObjectId;
    if (existing) {
      courseSubjectId = existing._id as Types.ObjectId;
    } else {
      const now = new Date();
      const inserted = await courseSubjectsCol.insertOne({
        courseId: plan.courseId,
        subjectId: plan.subjectId,
        order: plan.order,
        status: plan.status,
        createdAt: now,
        updatedAt: now,
      });
      courseSubjectId = inserted.insertedId;
      createdCourseSubjects++;
    }
    // Map every old subject id that shared this (courseId, canonical) pair to this CourseSubject.
    for (const doc of allSubjects) {
      if (doc.courseId && String(doc.courseId) === String(plan.courseId) && oldToCanonical.get(String(doc._id))?.equals(plan.subjectId)) {
        oldToCourseSubject.set(String(doc._id), courseSubjectId);
      }
    }
  }
  console.log(`✅ CourseSubject তৈরি হয়েছে: ${createdCourseSubjects} (ইতিমধ্যে ছিল: ${courseSubjectPlans.size - createdCourseSubjects})`);

  // -------- 2. Repoint Lectures --------
  const lectures = await lecturesCol.find({ subjectId: { $exists: true } }).toArray();
  let lecturesUpdated = 0;
  for (const lec of lectures) {
    const courseSubjectId = oldToCourseSubject.get(String(lec.subjectId));
    if (!courseSubjectId) {
      console.log(`  ⚠️  Lecture ${lec._id} এর subjectId (${lec.subjectId}) কোনো CourseSubject-এ ম্যাপ করা যায়নি — স্কিপ করা হলো।`);
      continue;
    }
    await lecturesCol.updateOne({ _id: lec._id }, { $set: { courseSubjectId }, $unset: { subjectId: "" } });
    lecturesUpdated++;
  }
  console.log(`✅ Lecture আপডেট হয়েছে: ${lecturesUpdated}/${lectures.length}`);

  // -------- 3. Repoint OfflineExams --------
  const exams = await examsCol.find({ subjectId: { $exists: true }, courseSubjectId: { $exists: false } }).toArray();
  let examsUpdated = 0;
  for (const exam of exams) {
    const canonical = oldToCanonical.get(String(exam.subjectId));
    const courseSubjectId = oldToCourseSubject.get(String(exam.subjectId));
    if (!canonical || !courseSubjectId) {
      console.log(`  ⚠️  Exam ${exam._id} এর subjectId (${exam.subjectId}) কোনো CourseSubject-এ ম্যাপ করা যায়নি — স্কিপ করা হলো।`);
      continue;
    }
    await examsCol.updateOne({ _id: exam._id }, { $set: { subjectId: canonical, courseSubjectId } });
    examsUpdated++;
  }
  console.log(`✅ OfflineExam আপডেট হয়েছে: ${examsUpdated}/${exams.length}`);

  // -------- 4. Repoint optional Material.subjectId references --------
  const materials = await materialsCol.find({ subjectId: { $exists: true } }).toArray();
  let materialsUpdated = 0;
  for (const mat of materials) {
    const canonical = oldToCanonical.get(String(mat.subjectId));
    if (!canonical || canonical.equals(mat.subjectId)) continue; // already canonical or unmapped
    await materialsCol.updateOne({ _id: mat._id }, { $set: { subjectId: canonical } });
    materialsUpdated++;
  }
  console.log(`✅ Material.subjectId আপডেট হয়েছে: ${materialsUpdated}/${materials.length}`);

  // -------- 5. Clean up canonical Subject docs, delete redundant duplicates --------
  let subjectsUnset = 0;
  let subjectsDeleted = 0;
  for (const [name, canonicalId] of canonicalIdByName.entries()) {
    await subjectsCol.updateOne({ _id: canonicalId }, { $unset: { courseId: "" } });
    subjectsUnset++;
    const docs = groups.get(name)!;
    for (const doc of docs) {
      if (!doc._id.equals(canonicalId)) {
        await subjectsCol.deleteOne({ _id: doc._id });
        subjectsDeleted++;
      }
    }
  }
  console.log(`✅ Canonical Subject থেকে courseId সরানো হয়েছে: ${subjectsUnset}`);
  console.log(`✅ ডুপ্লিকেট Subject মুছে ফেলা হয়েছে: ${subjectsDeleted}`);

  console.log("\n--- মাইগ্রেশন সম্পন্ন ---");
  await disconnectDB();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
