import { Types } from "mongoose";
import { Student } from "../students/student.model";
import { OfflineResult } from "../exams/result.model";
import { Batch } from "../batches/batch.model";
import { getSettings } from "../settings/settings.service";
import { ApiError } from "../../common/utils/ApiError";
import { toAsciiDigits } from "../../common/utils/digits";
import { logger } from "../../logger/logger";

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
  student: { name: string; rollNumber: string; course: string | null; batch: string | null };
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

  const matches = await Student.find({ currentRollNumber: roll }).select("_id name currentRollNumber course currentBatchId");
  if (matches.length === 0) throw ApiError.notFound("প্রদত্ত রোল নম্বরের কোনো ফলাফল পাওয়া যায়নি।");
  if (matches.length > 1) {
    logger.warn({ roll, count: matches.length }, "Ambiguous public roll-number lookup — multiple students share this roll");
    throw ApiError.conflict("এই রোল নম্বরে একাধিক শিক্ষার্থী পাওয়া গেছে — সঠিকভাবে সনাক্ত করা সম্ভব হচ্ছে না। আপনার প্রতিষ্ঠানে যোগাযোগ করুন।");
  }
  return matches[0];
}

export async function getIndividualResult(rawRoll: string, startDate: string, endDate: string): Promise<IndividualResultView> {
  if (startDate > endDate) throw ApiError.badRequest("শুরু তারিখ শেষ তারিখের পরে হতে পারবে না।");

  const student = await findOneStudentByRoll(rawRoll);

  let currentBatchName: string | null = null;
  if (student.currentBatchId) {
    const batch = await Batch.findById(student.currentBatchId).select("name");
    currentBatchName = batch?.name ?? null;
  }

  // One aggregation, not "one query per exam" — joins each result straight
  // to its own exam/subject/batch and filters to the requested window and
  // to published exams only, all in the database (Phase 6 §18).
  const rows = await OfflineResult.aggregate<ResultRow>([
    { $match: { studentId: new Types.ObjectId(String(student._id)) } },
    { $lookup: { from: "offlineexams", localField: "examId", foreignField: "_id", as: "exam" } },
    { $unwind: "$exam" },
    { $match: { "exam.isPublished": true, "exam.date": { $gte: startDate, $lte: endDate } } },
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

  return {
    student: {
      name: student.name,
      rollNumber: student.currentRollNumber ?? toAsciiDigits(rawRoll).trim(),
      course: student.course ?? null,
      batch: currentBatchName,
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

/**
 * Backend foundation for Part 2's Batch Master Sheet — only the batches
 * that actually have at least one published result are worth listing, and
 * only a name (never an internal id — Phase 6 §17) is exposed, since
 * Batch.name is already unique and is exactly what a public visitor would
 * recognize, unlike a Mongo ObjectId.
 */
export async function listPublicBatches(courseId?: string): Promise<{ name: string; courseName: string }[]> {
  const { OfflineExam } = await import("../exams/exam.model");
  const batchIds = await OfflineExam.find({ isPublished: true }).distinct("batchId");
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
