import { Types } from "mongoose";
import { Student } from "../students/student.model";
import { OfflineResult } from "../exams/result.model";
import { Batch } from "../batches/batch.model";
import { getSettings, getPublicResultsSettings } from "../settings/settings.service";
import type { PublicResultsSettingsDoc } from "../settings/settings.model";
import { ApiError } from "../../common/utils/ApiError";
import { toAsciiDigits } from "../../common/utils/digits";
import { logger } from "../../logger/logger";

/** Bengali "feature turned off" messages — never a raw 403/500 (Settings §16). */
async function assertMarksheetEnabled(kind: "individual" | "batch"): Promise<PublicResultsSettingsDoc> {
  const settings = await getPublicResultsSettings();
  if (!settings.enabled) throw ApiError.forbidden("এই মুহূর্তে পাবলিক ফলাফল সুবিধা বন্ধ আছে।");
  if (kind === "individual" && !settings.individualEnabled) throw ApiError.forbidden("ব্যক্তিগত ফলাফল এই মুহূর্তে বন্ধ আছে।");
  if (kind === "batch" && !settings.batchEnabled) throw ApiError.forbidden("ব্যাচ ভিত্তিক ফলাফল এই মুহূর্তে বন্ধ আছে।");
  return settings;
}

/**
 * Public Marksheet (Phase 6). Every function here is read-only and returns
 * hand-built DTOs — never a raw Mongoose document — so a MongoDB ObjectId,
 * phone number, guardian info, payment data, or any other admin-only field
 * can never leak onto the public /marksheet page (Phase 6 §4).
 */

interface ResultRow {
  marks: number | null;
  fullMarks: number;
  date: string;
  subjectName: string;
  examTitle: string;
  batchName: string;
}

interface SubjectSummary {
  subject: string;
  fullMarks: number;
  obtained: number;
  percentage: number;
  grade: string;
}

interface DetailRow {
  date: string;
  subject: string;
  examTitle: string;
  batch: string;
  fullMarks: number;
  obtained: number | null;
  percentage: number | null;
  status: "উত্তীর্ণ" | "অনুত্তীর্ণ" | "অনুপস্থিত";
}

interface IndividualResultView {
  student: { name: string; rollNumber: string; course: string | null; batch: string | null; registrationId?: string; photo?: string | null };
  dateRange: { start: string; end: string };
  subjects: SubjectSummary[];
  overall: { fullMarks: number; obtained: number; percentage: number; grade: string; status: "উত্তীর্ণ" | "অনুত্তীর্ণ" };
  details: DetailRow[];
}

/** Highest grade band whose minPercent the given percentage clears — reuses Settings.gradeScale, the one place this app already models grading (Phase 6 §4/§16, "reuse if already supported"). */
function gradeFor(percent: number, gradeScale: { minPercent: number; grade: string }[]): string {
  const sorted = [...gradeScale].sort((a, b) => b.minPercent - a.minPercent);
  return sorted.find((b) => percent >= b.minPercent)?.grade ?? "-";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * A Roll Number is only guaranteed unique within its configured scope
 * (Settings.rollNumberScope — commonly "batch"), so on its own it can
 * legitimately match more than one student. The public marksheet has no
 * batch-selection step to disambiguate with, so an ambiguous roll is
 * rejected outright rather than risking showing the wrong student's
 * result — a correctness/privacy issue, not just an inconvenience.
 */
async function findOneStudentByRoll(rawRoll: string) {
  const roll = toAsciiDigits(rawRoll).trim();
  if (!roll) throw ApiError.badRequest("সঠিক রোল নম্বর প্রদান করুন।");

  const matches = await Student.find({ currentRollNumber: roll }).select("_id name currentRollNumber course currentBatchId registrationId photoUrl");
  if (matches.length === 0) throw ApiError.notFound("প্রদত্ত রোল নম্বরের কোনো ফলাফল পাওয়া যায়নি।");
  if (matches.length > 1) {
    logger.warn({ roll, count: matches.length }, "Ambiguous public roll-number lookup — multiple students share this roll");
    throw ApiError.conflict("এই রোল নম্বরে একাধিক শিক্ষার্থী পাওয়া গেছে — সঠিকভাবে সনাক্ত করা সম্ভব হচ্ছে না। আপনার প্রতিষ্ঠানে যোগাযোগ করুন।");
  }
  return matches[0];
}

export async function getIndividualResult(rawRoll: string, startDate: string, endDate: string): Promise<IndividualResultView> {
  const resultsSettings = await assertMarksheetEnabled("individual");
  if (startDate > endDate) throw ApiError.badRequest("শুরু তারিখ শেষ তারিখের পরে হতে পারবে না।");

  const student = await findOneStudentByRoll(rawRoll);

  let currentBatchName: string | null = null;
  if (student.currentBatchId) {
    const batch = await Batch.findById(student.currentBatchId).select("name");
    currentBatchName = batch?.name ?? null;
  }

  const examMatch: Record<string, unknown> = { "exam.date": { $gte: startDate, $lte: endDate } };
  if (resultsSettings.requirePublished) examMatch["exam.isPublished"] = true;

  // One aggregation, not "one query per exam" — joins each result straight
  // to its own exam/subject/batch and filters to the requested window and
  // (when required by Settings) to published exams only, all in the
  // database (Phase 6 §18).
  const rows = await OfflineResult.aggregate<ResultRow>([
    { $match: { studentId: new Types.ObjectId(String(student._id)) } },
    { $lookup: { from: "offlineexams", localField: "examId", foreignField: "_id", as: "exam" } },
    { $unwind: "$exam" },
    { $match: examMatch },
    { $lookup: { from: "subjects", localField: "exam.subjectId", foreignField: "_id", as: "subject" } },
    { $unwind: "$subject" },
    { $lookup: { from: "batches", localField: "exam.batchId", foreignField: "_id", as: "batch" } },
    { $unwind: "$batch" },
    {
      $project: {
        _id: 0,
        marks: 1,
        fullMarks: "$exam.fullMarks",
        date: "$exam.date",
        subjectName: "$subject.name",
        examTitle: "$exam.title",
        batchName: "$batch.name",
      },
    },
    { $sort: { date: -1 } },
  ]);

  if (rows.length === 0) throw ApiError.notFound("এই সময়সীমার মধ্যে কোনো ফলাফল পাওয়া যায়নি।");

  const settings = await getSettings();
  const passingPercentage = settings.passingPercentage;
  const gradeScale = settings.gradeScale;

  // "Invalid" rows (Phase 6 §15) — a stray marks value outside 0..fullMarks
  // from before this exam's own validation existed (the older
  // POST /exams/:id/results endpoint never enforced this). Excluded from
  // both the detail list and every calculation rather than surfaced or
  // silently clamped.
  const validRows = rows.filter((r) => r.marks === null || (r.marks >= 0 && r.marks <= r.fullMarks));

  const details: DetailRow[] = validRows.map((r) => {
    const percentage = r.marks === null ? null : round2((r.marks / r.fullMarks) * 100);
    const status: DetailRow["status"] = r.marks === null ? "অনুপস্থিত" : percentage! >= passingPercentage ? "উত্তীর্ণ" : "অনুত্তীর্ণ";
    return { date: r.date, subject: r.subjectName, examTitle: r.examTitle, batch: r.batchName, fullMarks: r.fullMarks, obtained: r.marks, percentage, status };
  });

  // Subject/overall totals only ever count exams the student actually sat
  // for (Phase 6 §12/§16) — an absence isn't folded in as a silent zero,
  // consistent with this codebase's existing rule that a missed exam is an
  // attendance fact, not a marks fact (see exam.service.ts's submitResult).
  const sat = validRows.filter((r): r is ResultRow & { marks: number } => r.marks !== null);

  const bySubject = new Map<string, { fullMarks: number; obtained: number }>();
  for (const r of sat) {
    const acc = bySubject.get(r.subjectName) ?? { fullMarks: 0, obtained: 0 };
    acc.fullMarks += r.fullMarks;
    acc.obtained += r.marks;
    bySubject.set(r.subjectName, acc);
  }

  const subjects: SubjectSummary[] = Array.from(bySubject.entries())
    .map(([subject, { fullMarks, obtained }]) => {
      const percentage = fullMarks > 0 ? round2((obtained / fullMarks) * 100) : 0;
      return { subject, fullMarks, obtained, percentage, grade: gradeFor(percentage, gradeScale) };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject, "bn"));

  const overallFullMarks = sat.reduce((sum, r) => sum + r.fullMarks, 0);
  const overallObtained = sat.reduce((sum, r) => sum + r.marks, 0);
  // Sum ÷ sum, never an average of per-subject percentages — subjects can
  // (and usually do) carry different full-marks weights (Phase 6 §13/§16).
  const overallPercentage = overallFullMarks > 0 ? round2((overallObtained / overallFullMarks) * 100) : 0;
  const overallStatus: "উত্তীর্ণ" | "অনুত্তীর্ণ" = overallPercentage >= passingPercentage ? "উত্তীর্ণ" : "অনুত্তীর্ণ";

  const visible = resultsSettings.visibleFields;
  return {
    student: {
      name: student.name,
      rollNumber: student.currentRollNumber ?? toAsciiDigits(rawRoll).trim(),
      course: visible.includes("course") ? (student.course ?? null) : null,
      batch: visible.includes("batch") ? currentBatchName : null,
      ...(visible.includes("registrationId") ? { registrationId: student.registrationId } : {}),
      ...(visible.includes("photo") ? { photo: student.photoUrl ?? null } : {}),
    },
    dateRange: { start: startDate, end: endDate },
    subjects,
    overall: {
      fullMarks: overallFullMarks,
      obtained: overallObtained,
      percentage: overallPercentage,
      grade: gradeFor(overallPercentage, gradeScale),
      status: overallStatus,
    },
    details,
  };
}

interface MasterSheetColumn {
  date: string;
  subject: string;
  examTitle: string;
  fullMarks: number;
}

interface MasterSheetCell {
  value: number | null;
  /** "na" = student had no result row for this exam at all (wasn't on that exam's roster — e.g. joined the batch later); "absent" = sat the roster but marked absent (marks null); "present" = has marks. Kept distinct per Part 2's spec. */
  status: "present" | "absent" | "na";
}

interface MasterSheetRow {
  rollNumber: string;
  name: string;
  cells: MasterSheetCell[];
  totalObtained: number;
  totalFullMarks: number;
  percentage: number;
  grade: string;
  rank: number | null;
}

interface BatchMasterSheetView {
  batch: { name: string; courseName: string | null };
  dateRange: { start: string | null; end: string | null };
  columns: MasterSheetColumn[];
  rows: MasterSheetRow[];
  generatedAt: string;
}

/** Roll numbers are usually numeric strings but not guaranteed to be — numeric compare when possible, Bengali-locale string compare otherwise. */
function compareRoll(a: string, b: string): number {
  const an = toAsciiDigits(a).trim();
  const bn = toAsciiDigits(b).trim();
  const aNum = /^\d+$/.test(an) ? Number(an) : null;
  const bNum = /^\d+$/.test(bn) ? Number(bn) : null;
  if (aNum !== null && bNum !== null) return aNum - bNum;
  // A missing/non-numeric roll (e.g. "-") always sorts after every real
  // numeric roll, regardless of string value — same rule as every other
  // student roster in the app.
  if (aNum !== null) return -1;
  if (bNum !== null) return 1;
  return an.localeCompare(bn, "bn");
}

/**
 * Batch-wise Result Master Sheet (Part 2). Reuses the exact same models,
 * `isPublished` gate, and DTO discipline as `getIndividualResult` above —
 * no separate result system. Historical integrity works the same way: a
 * student appears here because they have an `OfflineResult` row against
 * one of this batch's own exams (`OfflineExam.batchId`, fixed at creation
 * time and never changed), not because of their *current* batch — so a
 * student who has since moved to another batch still shows up correctly
 * against this batch's own history, and one who joined this batch only
 * partway through correctly shows "না" (not applicable) rather than an
 * absence for exams held before they were on its roster.
 */
export async function getBatchMasterSheet(
  rawBatchName: string,
  startDate?: string,
  endDate?: string,
): Promise<BatchMasterSheetView> {
  const resultsSettings = await assertMarksheetEnabled("batch");
  if (startDate && endDate && startDate > endDate) {
    throw ApiError.badRequest("শুরু তারিখ শেষ তারিখের পরে হতে পারবে না।");
  }

  const batchName = rawBatchName.trim();
  const batch = await Batch.findOne({ name: batchName }).select("name courseId");
  if (!batch) throw ApiError.notFound("প্রদত্ত নামের কোনো ব্যাচ পাওয়া যায়নি।");

  const { OfflineExam } = await import("../exams/exam.model");
  const examFilter: Record<string, unknown> = { batchId: batch._id };
  if (resultsSettings.requirePublished) examFilter.isPublished = true;
  if (startDate || endDate) {
    const dateFilter: Record<string, string> = {};
    if (startDate) dateFilter.$gte = startDate;
    if (endDate) dateFilter.$lte = endDate;
    examFilter.date = dateFilter;
  }

  // Dynamic columns — one per published exam this batch ever held, in
  // chronological order (Phase 2 spec: columns are derived at runtime, not
  // hardcoded).
  const exams = await OfflineExam.find(examFilter)
    .select("subjectId title fullMarks date")
    .populate<{ subjectId: { name: string } | null }>("subjectId", "name")
    .sort({ date: 1 })
    .lean();
  if (exams.length === 0) throw ApiError.notFound("এই ব্যাচের জন্য কোনো প্রকাশিত ফলাফল পাওয়া যায়নি।");

  const examIds = exams.map((e) => e._id);

  // One query for every result row across every exam/student in this batch
  // — not one query per student or per exam (N+1-safe, Phase 2 spec §requirement).
  const results = await OfflineResult.find({ examId: { $in: examIds } })
    .select("examId studentId marks")
    .lean();
  if (results.length === 0) throw ApiError.notFound("এই ব্যাচের জন্য কোনো শিক্ষার্থীর ফলাফল পাওয়া যায়নি।");

  const studentIds = Array.from(new Set(results.map((r) => String(r.studentId))));
  const students = await Student.find({ _id: { $in: studentIds } }).select("name currentRollNumber").lean();
  const studentMap = new Map(students.map((s) => [String(s._id), s]));

  const columnIndexByExamId = new Map(exams.map((e, i) => [String(e._id), i]));
  const columns: MasterSheetColumn[] = exams.map((e) => ({
    date: e.date,
    subject: e.subjectId?.name ?? "-",
    examTitle: e.title,
    fullMarks: e.fullMarks,
  }));

  const cellsByStudent = new Map<string, MasterSheetCell[]>();
  for (const sid of studentMap.keys()) {
    cellsByStudent.set(sid, columns.map(() => ({ value: null, status: "na" as const })));
  }
  for (const r of results) {
    const sid = String(r.studentId);
    const cells = cellsByStudent.get(sid);
    if (!cells) continue; // student record no longer exists — skip rather than crash
    const colIndex = columnIndexByExamId.get(String(r.examId));
    if (colIndex === undefined) continue;
    const fullMarks = columns[colIndex].fullMarks;
    // Same legacy-data guard as the individual view: a stray out-of-range
    // marks value is excluded rather than surfaced or clamped.
    if (r.marks !== null && (r.marks < 0 || r.marks > fullMarks)) continue;
    cells[colIndex] = r.marks === null ? { value: null, status: "absent" } : { value: r.marks, status: "present" };
  }

  const settings = await getSettings();
  const gradeScale = settings.gradeScale;

  const rows: MasterSheetRow[] = Array.from(studentMap.entries()).map(([sid, student]) => {
    const cells = cellsByStudent.get(sid)!;
    let totalObtained = 0;
    let totalFullMarks = 0;
    cells.forEach((cell, i) => {
      if (cell.status === "present") {
        totalObtained += cell.value as number;
        totalFullMarks += columns[i].fullMarks;
      }
    });
    // sum ÷ sum, never an average of per-exam percentages — same rule as
    // the individual view (Phase 6 §13/§16, repeated for Part 2).
    const percentage = totalFullMarks > 0 ? round2((totalObtained / totalFullMarks) * 100) : 0;
    return {
      rollNumber: student.currentRollNumber ?? "-",
      name: student.name,
      cells,
      totalObtained,
      totalFullMarks,
      percentage,
      grade: totalFullMarks > 0 ? gradeFor(percentage, gradeScale) : "-",
      rank: null as number | null,
    };
  });

  // Top 3 — ranked by overall percentage (ties broken by total obtained,
  // then name). A student who was absent for everything (totalFullMarks=0)
  // can't be ranked. Skipped entirely when Settings has hidden rank.
  if (resultsSettings.visibleFields.includes("rank")) {
    const ranked = [...rows]
      .filter((r) => r.totalFullMarks > 0)
      .sort((a, b) => b.percentage - a.percentage || b.totalObtained - a.totalObtained || a.name.localeCompare(b.name, "bn"));
    ranked.slice(0, 3).forEach((r, i) => {
      r.rank = i + 1;
    });
  }

  // Display order is roll-number order (how a master sheet is actually
  // read), independent of the rank badges computed above.
  rows.sort((a, b) => compareRoll(a.rollNumber, b.rollNumber));

  let courseName: string | null = null;
  if (resultsSettings.visibleFields.includes("course") && batch.courseId) {
    const { Course } = await import("../courses/course.model");
    const course = await Course.findById(batch.courseId).select("name");
    courseName = course?.name ?? null;
  }

  return {
    batch: { name: batch.name, courseName },
    dateRange: { start: startDate ?? null, end: endDate ?? null },
    columns,
    rows,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Backend foundation for Part 2's Batch Master Sheet — only the batches
 * that actually have at least one published result are worth listing, and
 * only a name (never an internal id — Phase 6 §17) is exposed, since
 * Batch.name is already unique and is exactly what a public visitor would
 * recognize, unlike a Mongo ObjectId.
 */
export async function listPublicBatches(courseId?: string): Promise<{ name: string; courseName: string }[]> {
  const resultsSettings = await getPublicResultsSettings();
  if (!resultsSettings.enabled || !resultsSettings.batchEnabled) return [];

  const { OfflineExam } = await import("../exams/exam.model");
  const examFilter = resultsSettings.requirePublished ? { isPublished: true } : {};
  const batchIds = await OfflineExam.find(examFilter).distinct("batchId");
  if (batchIds.length === 0) return [];

  const filter: Record<string, unknown> = { _id: { $in: batchIds } };
  if (courseId) filter.courseId = courseId;

  const batches = await Batch.aggregate<{ name: string; courseName: string }>([
    { $match: filter },
    { $lookup: { from: "courses", localField: "courseId", foreignField: "_id", as: "course" } },
    { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, name: 1, courseName: { $ifNull: ["$course.name", null] } } },
    { $sort: { name: 1 } },
  ]);
  return batches;
}
