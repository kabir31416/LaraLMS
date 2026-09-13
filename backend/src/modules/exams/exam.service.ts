import { Request } from "express";
import { Types } from "mongoose";
import { OfflineExam, OfflineExamDoc } from "./exam.model";
import { OfflineResult } from "./result.model";
import { Batch } from "../batches/batch.model";
import { Student } from "../students/student.model";
import { Subject } from "../subjects/subject.model";
import { Lecture } from "../lectures/lecture.model";
import * as guardianService from "../guardians/guardian.service";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../common/utils/pagination";
import { sendSms } from "../../common/utils/sms";
import { env } from "../../config/env";
import { PERMISSIONS } from "../rbac/permissions";

/** Batch Directors may only manage exams/results for batches they direct, unless they also hold a broad permission. */
async function assertCanActOnBatch(req: Request, batchId: string): Promise<void> {
  const perms = req.user!.permissions;
  if (perms.includes("*") || perms.includes(PERMISSIONS.EXAMS_MANAGE)) return;
  if (!perms.includes(PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH)) throw ApiError.forbidden("Missing permission");
  const batch = await Batch.findById(batchId).select("directorId");
  if (!batch) throw ApiError.notFound("Batch not found");
  if (!req.user!.staffId || String(batch.directorId) !== req.user!.staffId) {
    throw ApiError.forbidden("You may only manage exams for batches you direct");
  }
}

/** Resolves the batchId scope a caller may see, or undefined for "no restriction." Throws if they may see nothing. */
async function readScope(req: Request): Promise<{ batchIds?: string[] } | null> {
  const perms = req.user!.permissions;
  if (perms.includes("*") || perms.includes(PERMISSIONS.EXAMS_MANAGE) || perms.includes(PERMISSIONS.RESULTS_READ)) {
    return null; // unrestricted
  }
  if (perms.includes(PERMISSIONS.EXAMS_READ_OWN_BATCH) || perms.includes(PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH)) {
    if (!req.user!.staffId) throw ApiError.forbidden("No linked staff record");
    const batchIds = await Batch.find({ directorId: req.user!.staffId }).distinct("_id");
    return { batchIds: batchIds.map(String) };
  }
  if (perms.includes(PERMISSIONS.RESULTS_READ_OWN)) {
    if (!req.user!.studentId) throw ApiError.forbidden("No linked student record");
    const student = await Student.findById(req.user!.studentId).select("currentBatchId");
    return { batchIds: student?.currentBatchId ? [String(student.currentBatchId)] : [] };
  }
  throw ApiError.forbidden("Missing permission");
}

/**
 * A result entry is conceptually unique per batch+subject+lecture+date
 * (Phase 5 §9) — findOneAndUpdate(upsert) here means resubmitting the exact
 * same combination (e.g. the Result Entry page re-saved, or two directors
 * accidentally double-clicking) updates the same OfflineExam instead of
 * spawning a duplicate session with its own separate set of results.
 */
export async function create(
  req: Request,
  data: { batchId: string; subjectId: string; lectureId: string; title: string; fullMarks: number; date: string },
): Promise<OfflineExamDoc> {
  await assertCanActOnBatch(req, data.batchId);
  const doc = await OfflineExam.findOneAndUpdate(
    { batchId: data.batchId, subjectId: data.subjectId, lectureId: data.lectureId, date: data.date },
    { $set: { title: data.title, fullMarks: data.fullMarks } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await recordAudit({ req, action: "exam.create", module: "exams", targetCollection: "offlineexams", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function list(req: Request) {
  const scope = await readScope(req);
  const { page, limit, skip, sort } = parsePagination(req, { date: -1 });
  const filter: Record<string, unknown> = {};
  if (req.query.batchId) filter.batchId = req.query.batchId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;
  if (req.query.lectureId) filter.lectureId = req.query.lectureId;
  if (req.query.date) filter.date = req.query.date;
  if (scope) filter.batchId = filter.batchId ? filter.batchId : { $in: scope.batchIds };

  const [items, total] = await Promise.all([
    OfflineExam.find(filter).sort(sort).skip(skip).limit(limit),
    OfflineExam.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string): Promise<OfflineExamDoc> {
  const doc = await OfflineExam.findById(id);
  if (!doc) throw ApiError.notFound("Exam not found");
  return doc;
}

export async function saveResults(req: Request, examId: string, items: { studentId: string; marks: number | null }[]): Promise<void> {
  const exam = await getById(examId);
  await assertCanActOnBatch(req, String(exam.batchId));

  const ops = items.map((item) => ({
    updateOne: {
      filter: { examId, studentId: item.studentId },
      update: { $set: { marks: item.marks } },
      upsert: true,
    },
  }));
  await OfflineResult.bulkWrite(ops);

  await recordAudit({
    req,
    action: "exam.save-results",
    module: "exams",
    targetCollection: "offlineresults",
    targetId: examId,
    after: { examId, count: items.length },
  });
}

export async function listResults(req: Request) {
  const perms = req.user!.permissions;
  const hasBroad = perms.includes("*") || perms.includes(PERMISSIONS.RESULTS_READ) || perms.includes(PERMISSIONS.EXAMS_MANAGE);

  const filter: Record<string, unknown> = {};
  if (req.query.examId) filter.examId = req.query.examId;
  else if (typeof req.query.examIds === "string") filter.examId = { $in: req.query.examIds.split(",").filter(Boolean) };

  if (!hasBroad) {
    if (perms.includes(PERMISSIONS.RESULTS_READ_OWN)) {
      if (!req.user!.studentId) throw ApiError.forbidden("No linked student record");
      filter.studentId = req.user!.studentId;
    } else if (perms.includes(PERMISSIONS.EXAMS_READ_OWN_BATCH) || perms.includes(PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH)) {
      if (!req.user!.staffId) throw ApiError.forbidden("No linked staff record");
      const batchIds = await Batch.find({ directorId: req.user!.staffId }).distinct("_id");
      const examIds = await OfflineExam.find({ batchId: { $in: batchIds } }).distinct("_id");
      filter.examId = filter.examId ? filter.examId : { $in: examIds };
    } else {
      throw ApiError.forbidden("Missing permission");
    }
  } else if (req.query.studentId) {
    filter.studentId = req.query.studentId;
  }

  const { page, limit, skip, sort } = parsePagination(req, { createdAt: -1 });
  const [items, total] = await Promise.all([
    OfflineResult.find(filter).sort(sort).skip(skip).limit(limit),
    OfflineResult.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

/** yyyy-mm-dd (the format every date is stored in) -> dd-mm-yyyy (the format the guardian SMS uses). */
function formatDateForSms(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return y && m && d ? `${d}-${m}-${y}` : dateStr;
}

/**
 * The one guardian-SMS template for a Result Entry submission (Phase 5
 * §14). There's no existing Settings-driven template system to hook into
 * (checked: Settings only covers exams/grading/roll-number-scope), so this
 * is a single well-formed message rather than a configurable set — the
 * closing line is still adjustable per-deployment via SMS_SIGNATURE so it
 * isn't hard-coded to any one coaching centre's name.
 */
function buildResultSms(input: {
  studentName: string;
  roll?: string;
  subjectName: string;
  lectureTitle: string;
  marks: number | null;
  fullMarks: number;
  attendance: "Present" | "Absent";
  date: string;
}): string {
  const rollPart = input.roll ? ` (Roll: ${input.roll})` : "";
  const dateBn = formatDateForSms(input.date);
  const signature = env.SMS_SIGNATURE;
  if (input.attendance === "Absent") {
    return `প্রিয় অভিভাবক,\nআপনার সন্তান ${input.studentName}${rollPart} ${dateBn} তারিখের ${input.subjectName} ক্লাসের ${input.lectureTitle} পরীক্ষায় অনুপস্থিত ছিল।\n${signature}.`;
  }
  return `প্রিয় অভিভাবক,\nআপনার সন্তান ${input.studentName}${rollPart} ${dateBn} তারিখের ${input.subjectName} ক্লাসের ${input.lectureTitle} পরীক্ষায় ${input.marks}/${input.fullMarks} পেয়েছে।\nউপস্থিতি: উপস্থিত।\n${signature}.`;
}

export interface SubmitResultItem {
  studentId: string;
  marks: number | null;
  attendance: "Present" | "Absent";
}

export interface SubmitResultSummary {
  examId: string;
  resultsSaved: number;
  smsSent: number;
  smsFailed: number;
  failedStudents: { studentId: string; name: string; roll?: string }[];
}

/**
 * The Result Entry page's single "Send Result" action (Phase 5 §5-§14):
 * upserts the exam (never a duplicate for the same batch+subject+lecture+
 * date — see create()'s comment), saves marks and attendance together in
 * the same collections the rest of the app already reads (OfflineResult /
 * AttendanceEntry, source "Exam"), then best-effort texts each present-or-
 * absent student's guardian. SMS failures never undo the save — they're
 * only reported back so the caller can offer a retry (resendSms below).
 */
export async function submitResult(
  req: Request,
  data: { batchId: string; subjectId: string; lectureId: string; date: string; fullMarks: number; items: SubmitResultItem[] },
): Promise<SubmitResultSummary> {
  await assertCanActOnBatch(req, data.batchId);

  const [subject, lecture, batch] = await Promise.all([
    Subject.findById(data.subjectId),
    Lecture.findById(data.lectureId),
    Batch.findById(data.batchId),
  ]);
  if (!subject) throw ApiError.badRequest("Invalid subject");
  if (!lecture) throw ApiError.badRequest("Invalid lecture");
  if (!batch) throw ApiError.notFound("Batch not found");
  if (String(lecture.subjectId) !== String(subject._id)) throw ApiError.badRequest("This lecture does not belong to the selected subject");
  // The frontend only ever offers subjects belonging to the batch's own course, but a caller
  // could still craft a request bypassing that — never trust the client's filtering alone.
  if (String(subject.courseId) !== String(batch.courseId)) throw ApiError.badRequest("This subject does not belong to the batch's course");

  // Every student in the submission must actually belong to this batch —
  // the frontend's own student list is already scoped this way, but a
  // crafted request must never be able to write a result/attendance/SMS
  // for a student outside the director's batch.
  const students = await Student.find({ _id: { $in: data.items.map((i) => i.studentId) } });
  const studentById = new Map(students.map((s) => [String(s._id), s]));
  for (const item of data.items) {
    const student = studentById.get(item.studentId);
    if (!student || String(student.currentBatchId ?? "") !== String(batch._id)) {
      throw ApiError.badRequest("One or more students do not belong to this batch");
    }
  }

  const title = `${subject.name} - ${lecture.title}`;
  const exam = await OfflineExam.findOneAndUpdate(
    { batchId: data.batchId, subjectId: data.subjectId, lectureId: data.lectureId, date: data.date },
    { $set: { title, fullMarks: data.fullMarks } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const resultOps = data.items.map((item) => ({
    updateOne: {
      filter: { examId: exam._id, studentId: item.studentId },
      update: { $set: { marks: item.marks } },
      upsert: true,
    },
  }));
  await OfflineResult.bulkWrite(resultOps);

  const { AttendanceEntry } = await import("../attendance/attendance.model");
  const batchObjectId = new Types.ObjectId(data.batchId);
  const attendanceOps = data.items.map((item) => ({
    updateOne: {
      filter: { studentId: new Types.ObjectId(item.studentId), source: "Exam" as const, examId: exam._id },
      update: { $set: { batchId: batchObjectId, date: data.date, status: item.attendance, examId: exam._id } },
      upsert: true,
    },
  }));
  await AttendanceEntry.bulkWrite(attendanceOps);

  await recordAudit({
    req,
    action: "exam.submit-result",
    module: "exams",
    targetCollection: "offlineexams",
    targetId: String(exam._id),
    after: { batchId: data.batchId, subjectId: data.subjectId, lectureId: data.lectureId, date: data.date, count: data.items.length },
  });

  let smsSent = 0;
  const failedStudents: { studentId: string; name: string; roll?: string }[] = [];
  for (const item of data.items) {
    const student = studentById.get(item.studentId);
    if (!student) continue;
    const guardian = await guardianService.getPrimary(item.studentId);
    if (!guardian?.phone) {
      failedStudents.push({ studentId: item.studentId, name: student.name, roll: student.currentRollNumber });
      continue;
    }
    const message = buildResultSms({
      studentName: student.name,
      roll: student.currentRollNumber,
      subjectName: subject.name,
      lectureTitle: lecture.title,
      marks: item.marks,
      fullMarks: data.fullMarks,
      attendance: item.attendance,
      date: data.date,
    });
    const res = await sendSms(guardian.phone, message);
    if (res.ok) smsSent++;
    else failedStudents.push({ studentId: item.studentId, name: student.name, roll: student.currentRollNumber });
  }

  return { examId: String(exam._id), resultsSaved: data.items.length, smsSent, smsFailed: failedStudents.length, failedStudents };
}

/** Retry guardian SMS for specific students of an already-submitted result, re-reading whatever marks/attendance were actually saved rather than trusting the caller to resend them (Phase 5 §12). */
export async function resendSms(req: Request, examId: string, studentIds: string[]): Promise<Omit<SubmitResultSummary, "examId" | "resultsSaved">> {
  const exam = await getById(examId);
  await assertCanActOnBatch(req, String(exam.batchId));

  const [subject, lecture] = await Promise.all([Subject.findById(exam.subjectId), Lecture.findById(exam.lectureId)]);
  if (!subject || !lecture) throw ApiError.notFound("Subject or lecture not found");

  const { AttendanceEntry } = await import("../attendance/attendance.model");
  const [students, results, attendances] = await Promise.all([
    Student.find({ _id: { $in: studentIds } }),
    OfflineResult.find({ examId, studentId: { $in: studentIds } }),
    AttendanceEntry.find({ examId, studentId: { $in: studentIds } }),
  ]);
  const resultByStudent = new Map(results.map((r) => [String(r.studentId), r.marks]));
  const attendanceByStudent = new Map(attendances.map((a) => [String(a.studentId), a.status]));

  let smsSent = 0;
  const failedStudents: { studentId: string; name: string; roll?: string }[] = [];
  for (const student of students) {
    const sid = String(student._id);
    const guardian = await guardianService.getPrimary(sid);
    if (!guardian?.phone) {
      failedStudents.push({ studentId: sid, name: student.name, roll: student.currentRollNumber });
      continue;
    }
    const message = buildResultSms({
      studentName: student.name,
      roll: student.currentRollNumber,
      subjectName: subject.name,
      lectureTitle: lecture.title,
      marks: resultByStudent.get(sid) ?? null,
      fullMarks: exam.fullMarks,
      attendance: (attendanceByStudent.get(sid) as "Present" | "Absent") || "Absent",
      date: exam.date,
    });
    const res = await sendSms(guardian.phone, message);
    if (res.ok) smsSent++;
    else failedStudents.push({ studentId: sid, name: student.name, roll: student.currentRollNumber });
  }

  return { smsSent, smsFailed: failedStudents.length, failedStudents };
}
