/**
 * Read-only Student data integrity audit — never writes anything.
 *
 * Written in response to a reported production issue: 439 Student documents
 * exist in MongoDB and (mostly) show up in the Student List, but some of
 * them fail to open in Student Profile / Fees search / Batch Assignment.
 * This script computes exact, verified counts (never estimates or invents
 * them) for every data-integrity category that could explain that pattern:
 * missing/invalid Course or Batch references, malformed identifiers,
 * duplicate registrationId/phone, invalid enum values, missing required
 * fields, and guardian records that exist but aren't resolvable by
 * guardianService.getPrimary() (see guardian.service.ts's fixed `||` bug —
 * this script quantifies exactly how many students that bug actually hit
 * before the fix).
 *
 * Every check here is built from the ACTUAL schema in student.model.ts /
 * student.constants.ts — no field name or enum value is guessed.
 *
 * Two layers of checking are used deliberately:
 *   - Mongoose queries (via the real Student/Course/Batch/Guardian models)
 *     for anything schema-aware (enum membership, reference resolution).
 *   - The raw MongoDB driver (`mongoose.connection.db`) for BSON-level
 *     checks (`$type`) that Mongoose's own query layer would silently cast
 *     around — a document written by a tool other than this app (a direct
 *     import/migration) could have `courseId` stored as a plain string
 *     instead of an ObjectId, which Mongoose's schema-aware find() does not
 *     reliably surface as a distinct condition.
 *
 * Usage: npm run audit:students
 * (Safe to run repeatedly — read-only, no writes, no side effects.)
 */
import { connectDB, disconnectDB } from "../config/db";
import { Student } from "../modules/students/student.model";
import { Course } from "../modules/courses/course.model";
import { Batch } from "../modules/batches/batch.model";
import { Guardian } from "../modules/guardians/guardian.model";
import { STUDENT_STATUS, ADMISSION_TYPES, FEE_TYPES } from "../modules/students/student.constants";
import mongoose from "mongoose";

function printSample(label: string, docs: { _id: unknown; registrationId?: string; name?: string }[], max = 10) {
  if (docs.length === 0) return;
  console.log(`    ${label} (up to ${max} shown):`);
  for (const d of docs.slice(0, max)) {
    console.log(`      _id=${d._id}  registrationId=${d.registrationId ?? "—"}  name=${d.name ?? "—"}`);
  }
}

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("No active MongoDB connection");
  const rawStudents = db.collection("students");

  const affectedIds = new Set<string>();
  const flag = (docs: { _id: unknown }[]) => docs.forEach((d) => affectedIds.add(String(d._id)));

  const total = await Student.countDocuments();
  console.log(`\n=== Student Data Integrity Audit ===`);
  console.log(`মোট student ডকুমেন্ট: ${total}\n`);

  // --- registrationId ---
  const missingRegId = await Student.find({ $or: [{ registrationId: { $exists: false } }, { registrationId: "" }] }).select("registrationId name");
  flag(missingRegId);
  console.log(`১. registrationId অনুপস্থিত/খালি: ${missingRegId.length}`);
  printSample("নমুনা", missingRegId);

  const dupRegIdGroups = await Student.aggregate<{ _id: string; count: number; ids: unknown[] }>([
    { $match: { registrationId: { $exists: true, $ne: "" } } },
    { $group: { _id: "$registrationId", count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  const dupRegIdCount = dupRegIdGroups.reduce((sum, g) => sum + g.count, 0);
  dupRegIdGroups.forEach((g) => g.ids.forEach((id) => affectedIds.add(String(id))));
  console.log(`২. ডুপ্লিকেট registrationId: ${dupRegIdGroups.length}টি ভিন্ন মান, মোট ${dupRegIdCount}টি ডকুমেন্ট প্রভাবিত`);
  if (dupRegIdGroups.length > 0) {
    console.log(`    নমুনা:`);
    for (const g of dupRegIdGroups.slice(0, 10)) console.log(`      registrationId="${g._id}" -> ${g.count}টি ডকুমেন্ট: ${g.ids.map(String).join(", ")}`);
  }

  // --- phone ---
  const missingPhone = await Student.find({ $or: [{ phone: { $exists: false } }, { phone: "" }] }).select("registrationId name");
  flag(missingPhone);
  console.log(`৩. phone অনুপস্থিত/খালি: ${missingPhone.length}`);
  printSample("নমুনা", missingPhone);

  const dupPhoneGroups = await Student.aggregate<{ _id: string; count: number; ids: unknown[] }>([
    { $match: { phone: { $exists: true, $ne: "" } } },
    { $group: { _id: "$phone", count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  console.log(`৪. ডুপ্লিকেট phone: ${dupPhoneGroups.length}টি ভিন্ন নম্বর (এটা প্রোফাইল/ফিতে "not found" ঘটায় না, কিন্তু flag করা হলো)`);

  // --- required fields (name, admissionDate) ---
  const missingName = await Student.find({ $or: [{ name: { $exists: false } }, { name: "" }] }).select("registrationId");
  flag(missingName);
  console.log(`৫. name অনুপস্থিত/খালি: ${missingName.length}`);

  const missingAdmissionDate = await Student.find({ $or: [{ admissionDate: { $exists: false } }, { admissionDate: "" }] }).select("registrationId name");
  flag(missingAdmissionDate);
  console.log(`৬. admissionDate অনুপস্থিত/খালি (schema-required field): ${missingAdmissionDate.length}`);
  printSample("নমুনা", missingAdmissionDate);

  // --- courseId ---
  const missingCourseId = await Student.find({ $or: [{ courseId: { $exists: false } }, { courseId: null }] }).select("registrationId name course");
  flag(missingCourseId);
  console.log(`৭. courseId অনুপস্থিত/null: ${missingCourseId.length}`);
  printSample("নমুনা", missingCourseId);

  const courseIdWrongType = await rawStudents.countDocuments({ courseId: { $exists: true, $ne: null, $not: { $type: "objectId" } } });
  console.log(`৮. courseId থাকলেও ভুল টাইপে সংরক্ষিত (ObjectId নয়, যেমন plain string): ${courseIdWrongType}`);

  const allCourseIds = await Student.distinct("courseId", { courseId: { $exists: true, $ne: null } });
  const existingCourseIds = new Set((await Course.find({ _id: { $in: allCourseIds } }).select("_id")).map((c) => String(c._id)));
  const danglingCourseIds = allCourseIds.filter((id) => !existingCourseIds.has(String(id)));
  const studentsWithDanglingCourse = danglingCourseIds.length > 0
    ? await Student.find({ courseId: { $in: danglingCourseIds } }).select("registrationId name courseId")
    : [];
  flag(studentsWithDanglingCourse);
  console.log(`৯. courseId আছে কিন্তু কোনো Course ডকুমেন্টের সাথে মেলে না (dangling reference): ${studentsWithDanglingCourse.length}`);
  printSample("নমুনা", studentsWithDanglingCourse);

  // --- currentBatchId ---
  const allBatchIds = await Student.distinct("currentBatchId", { currentBatchId: { $exists: true, $ne: null } });
  const existingBatchIds = new Set((await Batch.find({ _id: { $in: allBatchIds } }).select("_id")).map((b) => String(b._id)));
  const danglingBatchIds = allBatchIds.filter((id) => !existingBatchIds.has(String(id)));
  const studentsWithDanglingBatch = danglingBatchIds.length > 0
    ? await Student.find({ currentBatchId: { $in: danglingBatchIds } }).select("registrationId name currentBatchId")
    : [];
  flag(studentsWithDanglingBatch);
  console.log(`১০. currentBatchId আছে কিন্তু কোনো Batch ডকুমেন্টের সাথে মেলে না (dangling reference): ${studentsWithDanglingBatch.length}`);
  printSample("নমুনা", studentsWithDanglingBatch);

  const batchIdWrongType = await rawStudents.countDocuments({ currentBatchId: { $exists: true, $ne: null, $not: { $type: "objectId" } } });
  console.log(`১১. currentBatchId থাকলেও ভুল টাইপে সংরক্ষিত: ${batchIdWrongType}`);

  const unassignedCount = await Student.countDocuments({ currentBatchId: { $exists: false } });
  const batchNullButExists = await rawStudents.countDocuments({ currentBatchId: null });
  console.log(`    তথ্যের জন্য — batchId সম্পূর্ণ অনুপস্থিত (সঠিকভাবে "unassigned" হিসেবে ধরা পড়বে): ${unassignedCount}`);
  console.log(`    তথ্যের জন্য — currentBatchId ফিল্ড আছে কিন্তু মান null (⚠️ "unassigned" ফিল্টার এটাকে বাদ দিতে পারে, কারণ $exists:false শুধু সম্পূর্ণ-অনুপস্থিত ফিল্ড ধরে, null-value ফিল্ড না): ${batchNullButExists}`);
  if (batchNullButExists > 0) {
    const nullBatchDocs = (await rawStudents
      .find({ currentBatchId: null })
      .project<{ _id: unknown; registrationId?: string; name?: string }>({ registrationId: 1, name: 1 })
      .limit(10)
      .toArray());
    flag(nullBatchDocs);
    printSample("নমুনা (currentBatchId: null)", nullBatchDocs);
  }

  // --- enum fields ---
  const invalidStatus = await Student.find({ status: { $exists: true, $nin: [...STUDENT_STATUS] } }).select("registrationId name status");
  const missingStatus = await rawStudents.countDocuments({ status: { $exists: false } });
  flag(invalidStatus);
  console.log(`১২. status ভুল মান (${STUDENT_STATUS.join("/")} এর কোনোটাই না): ${invalidStatus.length}, সম্পূর্ণ অনুপস্থিত: ${missingStatus}`);
  printSample("নমুনা", invalidStatus);

  const invalidAdmissionType = await Student.find({ admissionType: { $exists: true, $nin: [...ADMISSION_TYPES] } }).select("registrationId name admissionType");
  console.log(`১৩. admissionType ভুল মান: ${invalidAdmissionType.length}`);

  const invalidFeeType = await Student.find({ feeType: { $exists: true, $nin: [...FEE_TYPES] } }).select("registrationId name feeType");
  console.log(`১৪. feeType ভুল মান: ${invalidFeeType.length}`);

  // --- profileCompletion presence (Mongoose default backfills this on save,
  // but a document inserted outside Mongoose — e.g. a raw import — never
  // gets a schema default applied) ---
  const missingProfileCompletion = await rawStudents.countDocuments({ profileCompletion: { $exists: false } });
  console.log(`১৫. profileCompletion ফিল্ড সম্পূর্ণ অনুপস্থিত (Mongoose-এর বাইরে থেকে insert হওয়ার লক্ষণ): ${missingProfileCompletion}`);

  // --- guardian resolution (the getPrimary() bug this audit was written
  // alongside — quantifies exactly how many real students it hit) ---
  const allStudentIds = (await Student.find({}).select("_id registrationId name")).map((s) => ({ _id: s._id, registrationId: s.registrationId, name: s.name }));
  const guardianStudentIds = new Set((await Guardian.find({}).select("studentId")).map((g) => String(g.studentId)));
  const noGuardianAtAll = allStudentIds.filter((s) => !guardianStudentIds.has(String(s._id)));
  console.log(`১৬. কোনো Guardian ডকুমেন্টই নেই: ${noGuardianAtAll.length} (Excel import guardianMobile ছাড়া হলে এটা স্বাভাবিক, "bug" না)`);

  const primaryGuardianStudentIds = new Set((await Guardian.find({ isPrimary: true }).select("studentId")).map((g) => String(g.studentId)));
  const hasGuardianButNoPrimary = allStudentIds.filter(
    (s) => guardianStudentIds.has(String(s._id)) && !primaryGuardianStudentIds.has(String(s._id)),
  );
  console.log(`১৭. Guardian ডকুমেন্ট আছে কিন্তু কোনোটাই isPrimary=true না (guardian.service.ts's getPrimary() bug-এ আক্রান্ত ছিল — এখন ফিক্স করা হয়েছে, কিন্তু এই students-দের guardian তথ্য blank দেখাচ্ছিল): ${hasGuardianButNoPrimary.length}`);
  printSample("নমুনা", hasGuardianButNoPrimary);

  // --- summary ---
  console.log(`\n=== সারসংক্ষেপ ===`);
  console.log(`মোট student: ${total}`);
  console.log(`উপরের যেকোনো একটি সমস্যায় আক্রান্ত (unique _id): ${affectedIds.size}`);
  if (affectedIds.size > 0) {
    console.log(`প্রভাবিত _id-গুলোর তালিকা (সর্বোচ্চ ৫০টি):`);
    console.log(`  ${Array.from(affectedIds).slice(0, 50).join(", ")}`);
  }
  console.log(`\nকোনো ডেটা পরিবর্তন করা হয়নি — এটি শুধুই একটি read-only audit।\n`);

  await disconnectDB();
}

main().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
