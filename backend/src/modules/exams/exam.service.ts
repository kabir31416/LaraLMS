import { Request } from "express";
import { Types } from "mongoose";
import { OfflineExam, OfflineExamDoc } from "./exam.model";
import { OfflineResult } from "./result.model";
import { Batch } from "../batches/batch.model";
import { Student, StudentDoc } from "../students/student.model";
import { Subject, SubjectDoc } from "../subjects/subject.model";
import { Lecture, LectureDoc } from "../lectures/lecture.model";
import * as guardianService from "../guardians/guardian.service";
import { getSettings, updateSettings } from "../settings/settings.service";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../common/utils/pagination";
import { sendSms } from "../../common/utils/sms";
import { PERMISSIONS } from "../rbac/permissions";
import { RESULT_SMS_VARIABLES, ResultSmsVariable, renderTemplate, validateTemplatePlaceholders } from "./exam.smsTemplate";

/** Batch Directors may only manage exams/results for batches they direct, unless they also hold a broad permission. Exported for reuse by resultManagement.service.ts's mark-edit endpoint — same capability, same permission, just a different UI surface. */
export async function assertCanActOnBatch(req: Request, batchId: string): Promise<void> {
  const perms = req.user!.permissions;
  if (perms.includes("*") || perms.includes(PERMISSIONS.EXAMS_MANAGE)) return;
  if (!perms.includes(PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH)) throw ApiError.forbidden("Missing permission");
  const batch = await Batch.findById(batchId).select("directorId");
  if (!batch) throw ApiError.notFound("Batch not found");
  if (!req.user!.staffId || String(batch.directorId) !== req.user!.staffId) {
    throw ApiError.forbidden("You may only manage exams for batches you direct");
  }
}

/** Resolves the batchId scope a caller may see, or undefined for "no restriction." Throws if they may see nothing. Exported for reuse by resultManagement.service.ts. */
export async function readScope(req: Request): Promise<{ batchIds?: string[] } | null> {
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

/** yyyy-mm-dd (the format every date is stored in) -> dd-mm-yyyy (the format guardian SMS uses). */
function formatDateForSms(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return y && m && d ? `${d}-${m}-${y}` : dateStr;
}

/** Highest-first grade band whose minPercent the percentage clears — Settings.gradeScale (settings.model.ts), never a separate hard-coded scale. Exported for reuse by resultManagement.service.ts and anywhere else that needs the exact same grade calculation as SMS/marksheet. */
export function computeGrade(percentage: number, gradeScale: { minPercent: number; grade: string }[]): string {
  const sorted = [...gradeScale].sort((a, b) => b.minPercent - a.minPercent);
  return sorted.find((band) => percentage >= band.minPercent)?.grade ?? "";
}

/**
 * Every {{variable}} the Result SMS template system supports, resolved for
 * one student's one result — see exam.smsTemplate.ts's RESULT_SMS_VARIABLES
 * for the full list. Absent students get a textual "অনুপস্থিত" rather than
 * blank numbers, and percentage/grade/result are left blank for them (there
 * is nothing to grade).
 */
async function buildResultSmsVariables(input: {
  student: StudentDoc;
  subject: SubjectDoc;
  lecture: LectureDoc;
  exam: OfflineExamDoc;
  batchName: string;
  marks: number | null;
  attendance: "Present" | "Absent";
  guardianName?: string;
  date: string;
  highestMark: string;
}): Promise<Record<string, string>> {
  const settings = await getSettings();
  const isGraded = input.attendance === "Present" && input.marks !== null;

  let obtainedMarks = "অনুপস্থিত";
  let percentage = "";
  let grade = "";
  let result = "অনুপস্থিত";
  if (isGraded && input.marks !== null) {
    const pct = input.exam.fullMarks > 0 ? Math.round((input.marks / input.exam.fullMarks) * 100) : 0;
    obtainedMarks = String(input.marks);
    percentage = String(pct);
    grade = computeGrade(pct, settings.gradeScale);
    result = pct >= settings.passingPercentage ? "পাস" : "ফেল";
  }

  return {
    studentName: input.student.name,
    roll: input.student.currentRollNumber || "",
    registrationId: input.student.registrationId || "",
    courseName: input.student.course || "",
    batchName: input.batchName,
    examName: input.exam.title,
    subjectName: input.subject.name,
    fullMarks: String(input.exam.fullMarks),
    obtainedMarks,
    percentage,
    grade,
    result,
    guardianName: input.guardianName || "",
    date: formatDateForSms(input.date),
    highestMark: input.highestMark,
  };
}

/** The single highest mark actually saved so far for this exam (across every student, not just the ones in the current submission/resend) — used for the {{highestMark}} SMS variable. Empty string if nobody has a mark yet (e.g. a class marked entirely absent). */
async function computeHighestMark(examId: Types.ObjectId | string): Promise<string> {
  const top = await OfflineResult.findOne({ examId, marks: { $ne: null } }).sort({ marks: -1 }).select("marks");
  return top?.marks != null ? String(top.marks) : "";
}

/**
 * The single, system-wide Result SMS template (settings.model.ts's
 * SettingsDoc.resultSmsTemplate) — set only from the Admin dashboard and
 * used for every guardian SMS regardless of who triggers Send Result. A
 * Batch Director's own per-staff override (Staff.resultSmsTemplate) has
 * been retired: whatever the Admin sets here is the format every SMS goes
 * out in, never a hard-coded string.
 */
async function resolveResultSmsTemplate(): Promise<string> {
  const settings = await getSettings();
  return settings.resultSmsTemplate;
}

export interface SubmitResultItem {
  studentId: string;
  marks: number | null;
  attendance: "Present" | "Absent";
}

export interface FailedSmsStudent {
  studentId: string;
  name: string;
  roll?: string;
  /** Why this particular student's SMS didn't go out — lets the UI show a precise message instead of a generic failure. */
  reason: "guardianPhoneMissing" | "gatewayFailed";
}

export interface SubmitResultSummary {
  examId: string;
  resultsSaved: number;
  smsSent: number;
  smsFailed: number;
  failedStudents: FailedSmsStudent[];
}

interface PersistedResult {
  exam: OfflineExamDoc;
  subject: SubjectDoc;
  lecture: LectureDoc;
  batch: InstanceType<typeof Batch>;
  studentById: Map<string, StudentDoc>;
}

/**
 * The shared save step behind both "Save Result" (saveResult) and "Send
 * Result" (submitResult) — upserts the exam (never a duplicate for the same
 * batch+subject+lecture+date), saves marks and attendance together in the
 * same collections the rest of the app already reads (OfflineResult /
 * AttendanceEntry, source "Exam"). Never sends SMS — that's the caller's
 * job, only after this has actually committed.
 */
async function persistResult(
  req: Request,
  data: { batchId: string; subjectId: string; lectureId: string; date: string; fullMarks: number; items: SubmitResultItem[] },
): Promise<PersistedResult> {
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
    action: "exam.save-result",
    module: "exams",
    targetCollection: "offlineexams",
    targetId: String(exam._id),
    after: { batchId: data.batchId, subjectId: data.subjectId, lectureId: data.lectureId, date: data.date, count: data.items.length },
  });

  return { exam, subject, lecture, batch, studentById };
}

/**
 * "Save Result" — saves marks + attendance only. Never calls the SMS
 * gateway. Safe to click repeatedly: persistResult() always upserts the
 * same exam/result/attendance rows for this batch+subject+lecture+date
 * rather than creating new ones (Phase 5 §9, unchanged by this feature).
 */
export async function saveResult(
  req: Request,
  data: { batchId: string; subjectId: string; lectureId: string; date: string; fullMarks: number; items: SubmitResultItem[] },
): Promise<{ examId: string; resultsSaved: number }> {
  const { exam } = await persistResult(req, data);
  return { examId: String(exam._id), resultsSaved: data.items.length };
}

/**
 * "Send Result" — saves first (persistResult, identical to Save Result),
 * then — only once that save has actually committed — renders and sends
 * each present-or-absent student's guardian SMS using the caller's
 * resolved Result SMS template. SMS failures never undo the save; they're
 * only reported back (and recorded per-student on OfflineResult.smsStatus)
 * so the caller can offer a retry (resendSms below).
 *
 * A short-lived, self-expiring lock on the exam document (smsSendingLockedAt)
 * prevents two near-simultaneous Send Result requests for the same exam —
 * a double-click that slipped past the frontend's own disable, or a
 * network retry — from both sending SMS. There is no MongoDB replica set
 * in this deployment (same documented constraint as every other multi-write
 * flow in this codebase), so this atomic conditional update is the
 * concurrency guard, not a transaction.
 */
export async function submitResult(
  req: Request,
  data: { batchId: string; subjectId: string; lectureId: string; date: string; fullMarks: number; items: SubmitResultItem[] },
): Promise<SubmitResultSummary> {
  const { exam, subject, lecture, batch, studentById } = await persistResult(req, data);

  const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
  const claimed = await OfflineExam.findOneAndUpdate(
    { _id: exam._id, $or: [{ smsSendingLockedAt: { $exists: false } }, { smsSendingLockedAt: { $lt: staleBefore } }] },
    { $set: { smsSendingLockedAt: new Date() } },
    { new: false },
  );
  if (!claimed) {
    throw ApiError.conflict("এই রেজাল্টের SMS ইতিমধ্যে পাঠানো হচ্ছে — একটু পরে আবার চেষ্টা করুন।");
  }

  try {
    const template = await resolveResultSmsTemplate();
    const highestMark = await computeHighestMark(exam._id);
    let smsSent = 0;
    const failedStudents: FailedSmsStudent[] = [];

    for (const item of data.items) {
      const student = studentById.get(item.studentId);
      if (!student) continue;
      const guardian = await guardianService.getPrimary(item.studentId);
      if (!guardian?.phone) {
        failedStudents.push({ studentId: item.studentId, name: student.name, roll: student.currentRollNumber, reason: "guardianPhoneMissing" });
        await OfflineResult.updateOne({ examId: exam._id, studentId: item.studentId }, { $set: { smsStatus: "failed" } });
        continue;
      }
      const variables = await buildResultSmsVariables({
        student,
        subject,
        lecture,
        exam,
        batchName: batch.name,
        marks: item.marks,
        attendance: item.attendance,
        guardianName: guardian.name,
        date: data.date,
        highestMark,
      });
      const message = renderTemplate(template, variables);
      const res = await sendSms(guardian.phone, message);
      if (res.ok) {
        smsSent++;
        await OfflineResult.updateOne({ examId: exam._id, studentId: item.studentId }, { $set: { smsStatus: "sent", smsSentAt: new Date() } });
      } else {
        failedStudents.push({ studentId: item.studentId, name: student.name, roll: student.currentRollNumber, reason: "gatewayFailed" });
        await OfflineResult.updateOne({ examId: exam._id, studentId: item.studentId }, { $set: { smsStatus: "failed" } });
      }
    }

    await recordAudit({
      req,
      action: "exam.send-result-sms",
      module: "exams",
      targetCollection: "offlineexams",
      targetId: String(exam._id),
      after: { smsSent, smsFailed: failedStudents.length },
    });

    return { examId: String(exam._id), resultsSaved: data.items.length, smsSent, smsFailed: failedStudents.length, failedStudents };
  } finally {
    await OfflineExam.updateOne({ _id: exam._id }, { $set: { lastSmsSentAt: new Date() }, $unset: { smsSendingLockedAt: "" } });
  }
}

/** Retry guardian SMS for specific students of an already-submitted result, re-reading whatever marks/attendance were actually saved rather than trusting the caller to resend them (Phase 5 §12). Uses the same template system and per-student status tracking as submitResult. */
export async function resendSms(req: Request, examId: string, studentIds: string[]): Promise<Omit<SubmitResultSummary, "examId" | "resultsSaved">> {
  const exam = await getById(examId);
  await assertCanActOnBatch(req, String(exam.batchId));

  const [subject, lecture, batch] = await Promise.all([
    Subject.findById(exam.subjectId),
    Lecture.findById(exam.lectureId),
    Batch.findById(exam.batchId),
  ]);
  if (!subject || !lecture || !batch) throw ApiError.notFound("Subject, lecture, or batch not found");

  const { AttendanceEntry } = await import("../attendance/attendance.model");
  // Scoped to this exam's own batch — a crafted studentIds array must never
  // let a resend text a student outside the exam it's attached to (Result
  // SMS Template + Data Safety §3/§7).
  const [students, results, attendances] = await Promise.all([
    Student.find({ _id: { $in: studentIds }, currentBatchId: exam.batchId }),
    OfflineResult.find({ examId, studentId: { $in: studentIds } }),
    AttendanceEntry.find({ examId, studentId: { $in: studentIds } }),
  ]);
  const resultByStudent = new Map(results.map((r) => [String(r.studentId), r.marks]));
  const attendanceByStudent = new Map(attendances.map((a) => [String(a.studentId), a.status]));

  const template = await resolveResultSmsTemplate();
  const highestMark = await computeHighestMark(exam._id);
  let smsSent = 0;
  const failedStudents: FailedSmsStudent[] = [];
  for (const student of students) {
    const sid = String(student._id);
    const guardian = await guardianService.getPrimary(sid);
    if (!guardian?.phone) {
      failedStudents.push({ studentId: sid, name: student.name, roll: student.currentRollNumber, reason: "guardianPhoneMissing" });
      await OfflineResult.updateOne({ examId, studentId: sid }, { $set: { smsStatus: "failed" } });
      continue;
    }
    const variables = await buildResultSmsVariables({
      student,
      subject,
      lecture,
      exam,
      batchName: batch.name,
      marks: resultByStudent.get(sid) ?? null,
      attendance: (attendanceByStudent.get(sid) as "Present" | "Absent") || "Absent",
      guardianName: guardian.name,
      date: exam.date,
      highestMark,
    });
    const message = renderTemplate(template, variables);
    const res = await sendSms(guardian.phone, message);
    if (res.ok) {
      smsSent++;
      await OfflineResult.updateOne({ examId, studentId: sid }, { $set: { smsStatus: "sent", smsSentAt: new Date() } });
    } else {
      failedStudents.push({ studentId: sid, name: student.name, roll: student.currentRollNumber, reason: "gatewayFailed" });
      await OfflineResult.updateOne({ examId, studentId: sid }, { $set: { smsStatus: "failed" } });
    }
  }

  await recordAudit({
    req,
    action: "exam.send-result-sms",
    module: "exams",
    targetCollection: "offlineexams",
    targetId: String(exam._id),
    after: { smsSent, smsFailed: failedStudents.length, retry: true },
  });

  return { smsSent, smsFailed: failedStudents.length, failedStudents };
}

export interface ResultSmsTemplateConfig {
  scope: "admin-default";
  effectiveTemplate: string;
  customTemplate?: string;
  isDefault: boolean;
  variables: ResultSmsVariable[];
}

/**
 * The Result SMS template is a single, system-wide setting — editable only
 * from the Admin dashboard (route-level EXAMS_MANAGE gate) and used as-is
 * for every guardian SMS, whoever triggers Send Result. A Batch Director's
 * former ability to set their own personal override (Staff.resultSmsTemplate)
 * has been retired so there is exactly one format in effect at a time.
 */
export async function getResultSmsTemplateConfig(): Promise<ResultSmsTemplateConfig> {
  const settings = await getSettings();
  return {
    scope: "admin-default",
    effectiveTemplate: settings.resultSmsTemplate,
    customTemplate: settings.resultSmsTemplate,
    isDefault: true,
    variables: RESULT_SMS_VARIABLES,
  };
}

/** Rejects any placeholder that isn't one of RESULT_SMS_VARIABLES's known keys up front, rather than silently sending a broken SMS with a literal "{{typo}}" in it later. */
export async function updateResultSmsTemplate(req: Request, template: string): Promise<ResultSmsTemplateConfig> {
  const unknown = validateTemplatePlaceholders(template);
  if (unknown.length > 0) {
    throw ApiError.badRequest(`টেমপ্লেটে অসমর্থিত ভ্যারিয়েবল আছে: ${unknown.map((k) => `{{${k}}}`).join(", ")}`);
  }

  const perms = req.user!.permissions;
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.EXAMS_MANAGE)) throw ApiError.forbidden("Missing permission");
  await updateSettings(req, { resultSmsTemplate: template });
  await recordAudit({
    req,
    action: "result-sms-template.update",
    module: "exams",
    targetCollection: "settings",
    after: { resultSmsTemplate: template },
  });

  return getResultSmsTemplateConfig();
}
