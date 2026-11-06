import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../common/utils/ApiError";
import { buildMeta } from "../../common/utils/pagination";
import { localToday } from "../../common/utils/localDate";
import { generateSequenceCode } from "../../common/utils/idGenerators";
import { recordAudit } from "../../audit/auditLog.service";
import { Student } from "../students/student.model";
import { Course } from "../courses/course.model";
import { Batch } from "../batches/batch.model";
import { Subject } from "../subjects/subject.model";
import { CourseSubject } from "../courseSubjects/courseSubject.model";
import { AcademicSession } from "../academicSessions/academicSession.model";
import { PERMISSIONS } from "../rbac/permissions";
import { ExamAssignment, ExamAssignmentDoc, ExamSchedule, ExamScheduleDoc, ExamStatus } from "./examSchedule.model";
import {
  CardScope, ELIGIBLE_STUDENT_FILTER, MAX_BULK, buildStudentViews, cardInstitution, cardSettingsView, escapeRegex, getCardSettings,
  inScope, oid, randomCode, scopeFor, sortViews, studentSearchFilter, STUDENT_CARD_FIELDS,
} from "./cardCommon";

const scope = (req: Request) => scopeFor(req, PERMISSIONS.ADMIT_CARDS_MANAGE, PERMISSIONS.ADMIT_CARDS_READ_OWN_BATCH);

async function manageScope(req: Request): Promise<void> {
  const sc = await scope(req);
  if (!sc.all) throw ApiError.forbidden("পরীক্ষা ও অ্যাডমিট কার্ড পরিচালনার অনুমতি নেই");
}

/** Fields printed on the admit card — changing any of them makes generated admit cards "outdated". */
const PRINTED_FIELDS = ["name", "examType", "date", "startTime", "endTime", "durationMinutes", "venue", "instructions", "subjectId", "sessionId"] as const;

/** Allowed status changes. Completed/cancelled exams are read-only until moved back. */
const TRANSITIONS: Record<ExamStatus, ExamStatus[]> = {
  draft: ["published", "cancelled"],
  published: ["draft", "completed", "cancelled"],
  completed: ["published"],
  cancelled: ["draft"],
};

export interface ExamInput {
  name: string;
  examType: ExamScheduleDoc["examType"];
  courseId: string;
  batchId?: string | null;
  allowCrossBatch?: boolean;
  sessionId?: string | null;
  subjectId?: string | null;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  venue?: string | null;
  instructions?: string | null;
  status?: "draft" | "published";
}

const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Start + end time → duration (server-computed so the two can never disagree). */
function resolveDuration(start?: string | null, end?: string | null, explicit?: number | null): number | undefined {
  if (start && end) {
    const d = minutesOf(end) - minutesOf(start);
    if (d <= 0) throw ApiError.badRequest("শেষের সময় শুরুর সময়ের পরে হতে হবে", { endTime: ["শেষের সময় শুরুর সময়ের পরে হতে হবে"] });
    return d;
  }
  return explicit ?? undefined;
}

/** Validates the course / batch / subject / session references and returns the course's default session. */
async function checkRefs(input: { courseId: string; batchId?: string | null; subjectId?: string | null; sessionId?: string | null }) {
  const course = await Course.findById(input.courseId).select("name sessionId").lean();
  if (!course) throw ApiError.badRequest("কোর্স পাওয়া যায়নি", { courseId: ["কোর্স পাওয়া যায়নি"] });
  if (input.batchId) {
    const batch = await Batch.findById(input.batchId).select("courseId").lean();
    if (!batch) throw ApiError.badRequest("ব্যাচ পাওয়া যায়নি", { batchId: ["ব্যাচ পাওয়া যায়নি"] });
    if (String(batch.courseId) !== String(input.courseId)) throw ApiError.badRequest("ব্যাচটি নির্বাচিত কোর্সের নয়", { batchId: ["ব্যাচটি নির্বাচিত কোর্সের নয়"] });
  }
  if (input.subjectId) {
    const linked = await CourseSubject.exists({ courseId: oid(input.courseId), subjectId: oid(input.subjectId) });
    if (!linked) throw ApiError.badRequest("বিষয়টি এই কোর্সে নেই", { subjectId: ["বিষয়টি এই কোর্সে নেই"] });
  }
  if (input.sessionId && !(await AcademicSession.exists({ _id: oid(input.sessionId) }))) {
    throw ApiError.badRequest("সেশন পাওয়া যায়নি", { sessionId: ["সেশন পাওয়া যায়নি"] });
  }
  return course;
}

type LeanExam = ExamScheduleDoc & { _id: Types.ObjectId };

/** Course / batch / session / subject names for many exams, one query each. */
async function examViews(exams: LeanExam[]) {
  const ids = (k: "courseId" | "batchId" | "sessionId" | "subjectId") => [...new Set(exams.map((e) => e[k]).filter(Boolean).map(String))];
  const [courses, batches, sessions, subjects] = await Promise.all([
    ids("courseId").length ? Course.find({ _id: { $in: ids("courseId") } }).select("name").lean() : [],
    ids("batchId").length ? Batch.find({ _id: { $in: ids("batchId") } }).select("name").lean() : [],
    ids("sessionId").length ? AcademicSession.find({ _id: { $in: ids("sessionId") } }).select("name").lean() : [],
    ids("subjectId").length ? Subject.find({ _id: { $in: ids("subjectId") } }).select("name").lean() : [],
  ]);
  const name = (list: { _id: unknown; name: string }[]) => new Map(list.map((x) => [String(x._id), x.name]));
  const [c, b, se, su] = [name(courses), name(batches), name(sessions), name(subjects)];
  const ref = (m: Map<string, string>, id?: Types.ObjectId) => (id ? { id: String(id), name: m.get(String(id)) ?? "—" } : null);
  return exams.map((e) => ({
    id: String(e._id),
    code: e.code,
    name: e.name,
    examType: e.examType,
    course: ref(c, e.courseId),
    batch: ref(b, e.batchId),
    allowCrossBatch: !!e.allowCrossBatch,
    session: ref(se, e.sessionId),
    subject: ref(su, e.subjectId),
    date: e.date,
    startTime: e.startTime ?? null,
    endTime: e.endTime ?? null,
    durationMinutes: e.durationMinutes ?? null,
    venue: e.venue ?? null,
    instructions: e.instructions ?? null,
    status: e.status,
    version: e.version,
    publishedAt: e.publishedAt ?? null,
    completedAt: e.completedAt ?? null,
    cancelledAt: e.cancelledAt ?? null,
    cancelReason: e.cancelReason ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));
}
export type ExamView = Awaited<ReturnType<typeof examViews>>[number];

/** Exams a scoped (director) caller may see: their batch is the exam's batch, or a student of their batch is assigned. */
async function scopedExamFilter(sc: CardScope): Promise<Record<string, unknown>> {
  if (sc.all) return {};
  const viaAssignments = await ExamAssignment.find({ batchId: { $in: sc.batchIds }, status: "active" }).distinct("examId");
  return { $or: [{ batchId: { $in: sc.batchIds } }, { _id: { $in: viaAssignments } }] };
}

async function loadExam(id: string, sc?: CardScope): Promise<LeanExam> {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("পরীক্ষা পাওয়া যায়নি");
  const exam = (await ExamSchedule.findOne({ _id: oid(id), ...(sc ? await scopedExamFilter(sc) : {}) }).lean()) as unknown as LeanExam | null;
  if (!exam) throw ApiError.notFound("পরীক্ষা পাওয়া যায়নি");
  return exam;
}

/** Per-exam assigned / generated / outdated counts (scoped to the caller's batches for a director). */
async function countsFor(exams: LeanExam[], sc: CardScope) {
  const rows = exams.length
    ? await ExamAssignment.find({ examId: { $in: exams.map((e) => e._id) }, status: "active", ...(sc.all ? {} : { batchId: { $in: sc.batchIds } }) }).select("examId admit.examVersion").lean()
    : [];
  const version = new Map(exams.map((e) => [String(e._id), e.version]));
  const out = new Map<string, { assigned: number; generated: number; outdated: number }>();
  for (const e of exams) out.set(String(e._id), { assigned: 0, generated: 0, outdated: 0 });
  for (const r of rows) {
    const c = out.get(String(r.examId))!;
    c.assigned++;
    if (r.admit) {
      c.generated++;
      if (r.admit.examVersion < (version.get(String(r.examId)) ?? 1)) c.outdated++;
    }
  }
  return out;
}

// ---------------------------------------------------------------- exams

export async function create(req: Request, input: ExamInput) {
  await manageScope(req);
  const course = await checkRefs(input);
  const durationMinutes = resolveDuration(input.startTime, input.endTime, input.durationMinutes);
  const status = input.status ?? "draft";
  const exam = await ExamSchedule.create({
    code: await generateSequenceCode("exam_schedule", "EXM", 4, true),
    name: input.name,
    examType: input.examType,
    courseId: oid(input.courseId),
    batchId: input.batchId ? oid(input.batchId) : undefined,
    allowCrossBatch: !!input.allowCrossBatch,
    sessionId: input.sessionId ? oid(input.sessionId) : course.sessionId,
    subjectId: input.subjectId ? oid(input.subjectId) : undefined,
    date: input.date,
    startTime: input.startTime || undefined,
    endTime: input.endTime || undefined,
    durationMinutes,
    venue: input.venue || undefined,
    instructions: input.instructions || undefined,
    status,
    publishedAt: status === "published" ? new Date() : undefined,
    createdBy: req.user?.id,
    updatedBy: req.user?.id,
  });
  await recordAudit({ req, action: "exam-schedule.create", module: "admit-cards", targetCollection: "examschedules", targetId: String(exam._id), after: exam.toObject() });
  return (await examViews([exam.toObject() as unknown as LeanExam]))[0];
}

export async function update(req: Request, id: string, patch: Partial<ExamInput>) {
  await manageScope(req);
  const exam = await ExamSchedule.findById(id);
  if (!exam) throw ApiError.notFound("পরীক্ষা পাওয়া যায়নি");
  if (exam.status === "completed" || exam.status === "cancelled") throw ApiError.conflict("সম্পন্ন বা বাতিল পরীক্ষা সম্পাদনা করা যায় না — আগে স্ট্যাটাস পরিবর্তন করুন");
  const before = exam.toObject();

  const next = {
    courseId: patch.courseId ?? String(exam.courseId),
    batchId: patch.batchId === undefined ? (exam.batchId ? String(exam.batchId) : null) : patch.batchId,
    subjectId: patch.subjectId === undefined ? (exam.subjectId ? String(exam.subjectId) : null) : patch.subjectId,
    sessionId: patch.sessionId === undefined ? (exam.sessionId ? String(exam.sessionId) : null) : patch.sessionId,
    allowCrossBatch: patch.allowCrossBatch ?? exam.allowCrossBatch,
  };
  // Who may sit the exam can't change underneath existing assignments.
  const active = await ExamAssignment.find({ examId: exam._id, status: "active" }).select("batchId").lean();
  if (active.length) {
    if (next.courseId !== String(exam.courseId)) throw ApiError.conflict(`${active.length} জন শিক্ষার্থী নির্ধারিত আছে — কোর্স পরিবর্তন করা যাবে না`);
    if (next.batchId && !next.allowCrossBatch) {
      const outside = active.filter((a) => String(a.batchId) !== next.batchId).length;
      if (outside) throw ApiError.conflict(`${outside} জন শিক্ষার্থী অন্য ব্যাচের — আগে তাদের সরান বা "অন্য ব্যাচ অনুমোদিত" চালু রাখুন`);
    }
  }
  await checkRefs(next);

  if (patch.name !== undefined) exam.name = patch.name;
  if (patch.examType !== undefined) exam.examType = patch.examType;
  if (patch.date !== undefined) exam.date = patch.date;
  if (patch.venue !== undefined) exam.venue = patch.venue || undefined;
  if (patch.instructions !== undefined) exam.instructions = patch.instructions || undefined;
  if (patch.startTime !== undefined) exam.startTime = patch.startTime || undefined;
  if (patch.endTime !== undefined) exam.endTime = patch.endTime || undefined;
  exam.courseId = oid(next.courseId);
  exam.batchId = next.batchId ? oid(next.batchId) : undefined;
  exam.subjectId = next.subjectId ? oid(next.subjectId) : undefined;
  exam.sessionId = next.sessionId ? oid(next.sessionId) : undefined;
  exam.allowCrossBatch = next.allowCrossBatch;
  exam.durationMinutes = resolveDuration(exam.startTime, exam.endTime, patch.durationMinutes === undefined ? exam.durationMinutes : patch.durationMinutes);

  const printedChanged = PRINTED_FIELDS.some((k) => String(before[k] ?? "") !== String(exam.get(k) ?? ""));
  if (printedChanged) exam.version = (exam.version ?? 1) + 1;
  exam.updatedBy = req.user?.id;
  await exam.save();
  await recordAudit({ req, action: "exam-schedule.update", module: "admit-cards", targetCollection: "examschedules", targetId: String(exam._id), before, after: exam.toObject() });
  return { ...(await examViews([exam.toObject() as unknown as LeanExam]))[0], printedChanged };
}

export async function setStatus(req: Request, id: string, status: ExamStatus, reason?: string) {
  await manageScope(req);
  const exam = await ExamSchedule.findById(id);
  if (!exam) throw ApiError.notFound("পরীক্ষা পাওয়া যায়নি");
  if (exam.status === status) return (await examViews([exam.toObject() as unknown as LeanExam]))[0];
  if (!TRANSITIONS[exam.status].includes(status)) throw ApiError.conflict("এই স্ট্যাটাস পরিবর্তন অনুমোদিত নয়");
  if (status === "cancelled" && !reason?.trim()) throw ApiError.badRequest("বাতিলের কারণ লিখুন", { reason: ["বাতিলের কারণ লিখুন"] });
  const before = exam.status;
  exam.status = status;
  if (status === "published") exam.publishedAt = new Date();
  if (status === "completed") exam.completedAt = new Date();
  if (status === "cancelled") { exam.cancelledAt = new Date(); exam.cancelReason = reason!.trim(); }
  if (status === "draft" && before === "cancelled") { exam.cancelledAt = undefined; exam.cancelReason = undefined; }
  exam.updatedBy = req.user?.id;
  await exam.save();
  await recordAudit({ req, action: `exam-schedule.${status}`, module: "admit-cards", targetCollection: "examschedules", targetId: String(exam._id), before: { status: before }, after: { status, reason } });
  return (await examViews([exam.toObject() as unknown as LeanExam]))[0];
}

/** Deleting is only for mistakes: never once an admit card exists or the exam is completed — cancel instead. */
export async function remove(req: Request, id: string) {
  await manageScope(req);
  const exam = await ExamSchedule.findById(id);
  if (!exam) throw ApiError.notFound("পরীক্ষা পাওয়া যায়নি");
  if (exam.status === "completed") throw ApiError.conflict("সম্পন্ন পরীক্ষা মোছা যায় না");
  if (await ExamAssignment.exists({ examId: exam._id, admit: { $exists: true } })) {
    throw ApiError.conflict("এই পরীক্ষার অ্যাডমিট কার্ড তৈরি হয়েছে — মোছা যাবে না, বাতিল করুন");
  }
  const assignments = await ExamAssignment.countDocuments({ examId: exam._id });
  await ExamAssignment.deleteMany({ examId: exam._id });
  await ExamSchedule.deleteOne({ _id: exam._id });
  await recordAudit({ req, action: "exam-schedule.delete", module: "admit-cards", targetCollection: "examschedules", targetId: String(exam._id), before: { ...exam.toObject(), assignments } });
  return { deleted: true, assignments };
}

export async function list(req: Request) {
  const sc = await scope(req);
  const q = req.query as Record<string, string | undefined>;
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  const filter: Record<string, unknown> = { ...(await scopedExamFilter(sc)) };
  const and: Record<string, unknown>[] = [];
  if (q.search?.trim()) {
    const r = new RegExp(escapeRegex(q.search.trim()), "i");
    and.push({ $or: [{ name: r }, { code: r }, { venue: r }] });
  }
  if (q.courseId) filter.courseId = oid(q.courseId);
  if (q.batchId) filter.batchId = oid(q.batchId);
  if (q.examType) filter.examType = q.examType;
  if (q.status) filter.status = q.status;
  const today = localToday();
  if (q.when === "upcoming") { and.push({ date: { $gte: today } }); if (!q.status) filter.status = { $in: ["draft", "published"] }; }
  if (q.when === "past") and.push({ date: { $lt: today } });
  if (q.dateFrom || q.dateTo) and.push({ date: { ...(q.dateFrom ? { $gte: q.dateFrom } : {}), ...(q.dateTo ? { $lte: q.dateTo } : {}) } });
  if (and.length) filter.$and = and;
  const order = q.when === "upcoming" ? 1 : -1;
  const [exams, total] = await Promise.all([
    ExamSchedule.find(filter).sort({ date: order, startTime: order, _id: -1 }).skip((page - 1) * limit).limit(limit).lean() as unknown as Promise<LeanExam[]>,
    ExamSchedule.countDocuments(filter),
  ]);
  const [views, counts] = await Promise.all([examViews(exams), countsFor(exams, sc)]);
  return { items: views.map((v) => ({ ...v, counts: counts.get(v.id)! })), meta: buildMeta(page, limit, total) };
}

export async function getOne(req: Request, id: string) {
  const sc = await scope(req);
  const exam = await loadExam(id, sc);
  const [[view], counts] = await Promise.all([examViews([exam]), countsFor([exam], sc)]);
  // Batch breakdown of active assignments (batch at assignment time).
  const rows = await ExamAssignment.find({ examId: exam._id, status: "active", ...(sc.all ? {} : { batchId: { $in: sc.batchIds } }) }).select("batchId admit.examVersion").lean();
  const batchIds = [...new Set(rows.map((r) => r.batchId).filter(Boolean).map(String))];
  const names = new Map((batchIds.length ? await Batch.find({ _id: { $in: batchIds } }).select("name").lean() : []).map((b) => [String(b._id), b.name]));
  const byBatch = new Map<string, { batchId: string | null; batch: string; assigned: number; generated: number }>();
  for (const r of rows) {
    const k = r.batchId ? String(r.batchId) : "";
    const cur = byBatch.get(k) ?? { batchId: k || null, batch: k ? names.get(k) ?? "—" : "ব্যাচ নেই", assigned: 0, generated: 0 };
    cur.assigned++;
    if (r.admit) cur.generated++;
    byBatch.set(k, cur);
  }
  return { ...view, counts: counts.get(view.id)!, batches: [...byBatch.values()], canManage: sc.all };
}

export async function overview(req: Request) {
  const sc = await scope(req);
  const base = await scopedExamFilter(sc);
  const today = localToday();
  const exams = (await ExamSchedule.find(base).select("status date version name code startTime").lean()) as unknown as LeanExam[];
  const live = exams.filter((e) => e.status !== "cancelled");
  const counts = await countsFor(live, sc);
  let assigned = 0, generated = 0, pending = 0, outdated = 0;
  for (const e of live) {
    const c = counts.get(String(e._id))!;
    assigned += c.assigned;
    generated += c.generated;
    outdated += c.outdated;
    if (e.status === "published") pending += c.assigned - c.generated;
  }
  const upcoming = live.filter((e) => e.date >= today && (e.status === "published" || e.status === "draft")).sort((a, b) => a.date.localeCompare(b.date) || String(a.startTime ?? "").localeCompare(String(b.startTime ?? "")));
  return {
    totalExams: exams.length,
    upcoming: upcoming.length,
    published: exams.filter((e) => e.status === "published").length,
    drafts: exams.filter((e) => e.status === "draft").length,
    cancelled: exams.filter((e) => e.status === "cancelled").length,
    totalAssigned: assigned,
    generatedAdmitCards: generated,
    pendingAdmitCards: pending,
    outdatedAdmitCards: outdated,
    nextExams: upcoming.slice(0, 5).map((e) => ({ id: String(e._id), code: e.code, name: e.name, date: e.date, startTime: e.startTime ?? null, status: e.status, ...counts.get(String(e._id))! })),
  };
}

// ---------------------------------------------------------------- assignment

const assignable = (e: LeanExam) => e.status === "draft" || e.status === "published";

/** Which batch(es) a student must be in to sit this exam. */
function batchRule(exam: LeanExam): Record<string, unknown> {
  return exam.batchId && !exam.allowCrossBatch ? { currentBatchId: exam.batchId } : {};
}

/** Students who may be assigned (active, admitted, in the exam's course and allowed batch) with their current assignment status. */
export async function eligible(req: Request, id: string) {
  await manageScope(req);
  const exam = await loadExam(id);
  const q = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = { ...ELIGIBLE_STUDENT_FILTER, courseId: exam.courseId, ...batchRule(exam), ...studentSearchFilter(q.search) };
  if (q.batchId) {
    if (exam.batchId && !exam.allowCrossBatch && q.batchId !== String(exam.batchId)) throw ApiError.badRequest("এই পরীক্ষায় শুধু নির্ধারিত ব্যাচের শিক্ষার্থী যোগ করা যায়");
    filter.currentBatchId = oid(q.batchId);
  }
  const limit = q.search ? 50 : MAX_BULK;
  const docs = await Student.find(filter).select(STUDENT_CARD_FIELDS).limit(limit).lean();
  const views = sortViews(await buildStudentViews(docs as never));
  const existing = await ExamAssignment.find({ examId: exam._id, studentId: { $in: views.map((v) => oid(v.id)) } }).select("studentId status").lean();
  const statusOf = new Map(existing.map((a) => [String(a.studentId), a.status]));
  const items = views.map((v) => ({ id: v.id, name: v.name, studentId: v.studentId, registrationNumber: v.registrationNumber, phone: v.phone, photo: v.photo, batchId: v.batchId, batch: v.batch, assignment: statusOf.get(v.id) ?? null }));
  return { items, total: items.length, alreadyAssigned: items.filter((i) => i.assignment === "active").length, truncated: docs.length === limit };
}

/**
 * Assigns students explicitly (never "everyone"). Each student is checked
 * against the exam's course/batch rule on the server; already-active
 * assignments are reported as duplicates (the unique (exam, student) index
 * also stops a racing double-submit); previously removed ones are reactivated.
 */
export async function assign(req: Request, id: string, studentIds: string[], method: "batch" | "student") {
  await manageScope(req);
  const exam = await loadExam(id);
  if (!assignable(exam)) throw ApiError.conflict("সম্পন্ন বা বাতিল পরীক্ষায় শিক্ষার্থী যোগ করা যায় না");
  const unique = [...new Set(studentIds)];
  const docs = await Student.find({ _id: { $in: unique.map(oid) } }).select("name courseId currentBatchId status admissionStatus").lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const ineligible: { studentId: string; name: string | null; reason: string }[] = [];
  const ok: typeof docs = [];
  for (const sid of unique) {
    const d = byId.get(sid);
    let reason: string | null = null;
    if (!d) reason = "শিক্ষার্থী পাওয়া যায়নি";
    else if (d.status !== "সক্রিয়" || d.admissionStatus === "pending" || d.admissionStatus === "rejected") reason = "সক্রিয়/অনুমোদিত শিক্ষার্থী নয়";
    else if (String(d.courseId) !== String(exam.courseId)) reason = "অন্য কোর্সের শিক্ষার্থী";
    else if (exam.batchId && !exam.allowCrossBatch && String(d.currentBatchId) !== String(exam.batchId)) reason = "অন্য ব্যাচের শিক্ষার্থী (এই পরীক্ষায় অনুমোদিত নয়)";
    if (reason) ineligible.push({ studentId: sid, name: d?.name ?? null, reason });
    else ok.push(d!);
  }
  const existing = await ExamAssignment.find({ examId: exam._id, studentId: { $in: ok.map((d) => d._id) } }).select("studentId status").lean();
  const existingBy = new Map(existing.map((a) => [String(a.studentId), a]));
  const now = new Date();
  const by = req.user?.id;
  const fresh = ok.filter((d) => !existingBy.has(String(d._id)));
  const revive = ok.filter((d) => existingBy.get(String(d._id))?.status === "removed");
  let duplicates = ok.filter((d) => existingBy.get(String(d._id))?.status === "active").length;

  let assigned = 0;
  if (fresh.length) {
    try {
      assigned = (await ExamAssignment.insertMany(fresh.map((d) => ({ examId: exam._id, studentId: d._id, batchId: d.currentBatchId, method, status: "active", assignedAt: now, assignedBy: by })), { ordered: false })).length;
    } catch (err) {
      const e = err as { code?: number; insertedDocs?: unknown[]; writeErrors?: unknown[] };
      if (e.code !== 11000 && !e.writeErrors) throw err;
      assigned = e.insertedDocs?.length ?? 0;
      duplicates += fresh.length - assigned;
    }
  }
  let reactivated = 0;
  if (revive.length) {
    const res = await ExamAssignment.bulkWrite(revive.map((d) => ({
      updateOne: {
        filter: { examId: exam._id, studentId: d._id, status: "removed" },
        update: { $set: { status: "active", batchId: d.currentBatchId, method, assignedAt: now, assignedBy: by }, $unset: { removedAt: 1, removedBy: 1, removeReason: 1 } },
      },
    })), { ordered: false });
    reactivated = res.modifiedCount ?? 0;
  }
  await recordAudit({ req, action: "exam-schedule.assign", module: "admit-cards", targetCollection: "examassignments", targetId: String(exam._id), after: { method, requested: unique.length, assigned, reactivated, duplicates, ineligible: ineligible.length } });
  return { requested: unique.length, assigned, reactivated, duplicates, ineligible };
}

export async function unassign(req: Request, id: string, studentIds: string[], reason?: string) {
  await manageScope(req);
  const exam = await loadExam(id);
  if (!assignable(exam)) throw ApiError.conflict("সম্পন্ন বা বাতিল পরীক্ষা থেকে শিক্ষার্থী সরানো যায় না");
  const res = await ExamAssignment.updateMany(
    { examId: exam._id, studentId: { $in: [...new Set(studentIds)].map(oid) }, status: "active" },
    { $set: { status: "removed", removedAt: new Date(), removedBy: req.user?.id, removeReason: reason?.trim() || undefined } },
  );
  await recordAudit({ req, action: "exam-schedule.unassign", module: "admit-cards", targetCollection: "examassignments", targetId: String(exam._id), after: { studentIds, reason, removed: res.modifiedCount } });
  return { removed: res.modifiedCount ?? 0 };
}

type LeanAssignment = ExamAssignmentDoc & { _id: Types.ObjectId };

const admitView = (a: LeanAssignment, exam: LeanExam) =>
  a.admit ? { cardNo: a.admit.cardNo, verifyCode: a.admit.verifyCode, generatedAt: a.admit.generatedAt, count: a.admit.count, examVersion: a.admit.examVersion, outdated: a.admit.examVersion < exam.version } : null;

export async function assignments(req: Request, id: string) {
  const sc = await scope(req);
  const exam = await loadExam(id, sc);
  const q = req.query as Record<string, string | undefined>;
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 25));
  const filter: Record<string, unknown> = { examId: exam._id, status: q.status === "removed" ? "removed" : "active" };
  if (q.batchId) {
    if (!inScope(sc, q.batchId)) throw ApiError.forbidden("এই ব্যাচটি আপনার নয়");
    filter.batchId = oid(q.batchId);
  } else if (!sc.all) filter.batchId = { $in: sc.batchIds };
  if (q.admit === "generated") filter.admit = { $exists: true };
  if (q.admit === "pending") filter.admit = { $exists: false };
  if (q.admit === "outdated") filter["admit.examVersion"] = { $lt: exam.version };
  if (q.search?.trim()) filter.studentId = { $in: await Student.find(studentSearchFilter(q.search)).distinct("_id") };

  const all = (await ExamAssignment.find(filter).lean()) as unknown as LeanAssignment[];
  const docs = await Student.find({ _id: { $in: all.map((a) => a.studentId) } }).select(STUDENT_CARD_FIELDS).lean();
  const views = new Map((await buildStudentViews(docs as never)).map((v) => [v.id, v]));
  const batchNames = new Map((await Batch.find({ _id: { $in: [...new Set(all.map((a) => a.batchId).filter(Boolean).map(String))] } }).select("name").lean()).map((b) => [String(b._id), b.name]));
  const rows = sortViews(all.map((a) => {
    const v = views.get(String(a.studentId));
    return {
      assignmentId: String(a._id),
      studentId: String(a.studentId),
      name: v?.name ?? "—",
      code: v?.studentId ?? "",
      registrationNumber: v?.registrationNumber ?? null,
      photo: v?.photo ?? null,
      phone: v?.phone ?? null,
      batchId: a.batchId ? String(a.batchId) : null,
      batch: a.batchId ? batchNames.get(String(a.batchId)) ?? "—" : null,
      method: a.method,
      status: a.status,
      assignedAt: a.assignedAt,
      removedAt: a.removedAt ?? null,
      removeReason: a.removeReason ?? null,
      admit: admitView(a, exam),
    };
  }));
  return { items: rows.slice((page - 1) * limit, page * limit), meta: buildMeta(page, limit, rows.length) };
}

// ---------------------------------------------------------------- admit cards

export interface AdmitSelector {
  scope: "all" | "batch" | "students";
  batchId?: string;
  studentIds?: string[];
}

function selectorFilter(exam: LeanExam, sel: AdmitSelector, sc: CardScope): Record<string, unknown> {
  const f: Record<string, unknown> = { examId: exam._id, status: "active" };
  if (sel.scope === "batch") {
    if (!sel.batchId) throw ApiError.badRequest("ব্যাচ নির্বাচন করুন");
    if (!inScope(sc, sel.batchId)) throw ApiError.forbidden("এই ব্যাচটি আপনার নয়");
    f.batchId = oid(sel.batchId);
  } else {
    if (sel.scope === "students") {
      if (!sel.studentIds?.length) throw ApiError.badRequest("শিক্ষার্থী নির্বাচন করুন");
      f.studentId = { $in: sel.studentIds.map(oid) };
    }
    if (!sc.all) f.batchId = { $in: sc.batchIds };
  }
  return f;
}

export type AdmitMode = "missing" | "changed" | "all";

/**
 * Generates admit cards for a published exam. New cards get the next number
 * from the exam's own counter (a block is reserved with one atomic $inc) and
 * are written only where no admit exists yet, so a double click or a parallel
 * request can never give a student two cards. Regenerating keeps the card
 * number and QR code and records the new exam version.
 */
export async function generateAdmits(req: Request, id: string, sel: AdmitSelector, mode: AdmitMode) {
  await manageScope(req);
  const exam = await loadExam(id);
  if (exam.status !== "published") throw ApiError.conflict("শুধু প্রকাশিত পরীক্ষার অ্যাডমিট কার্ড তৈরি করা যায় — আগে পরীক্ষাটি প্রকাশ করুন");
  const rows = (await ExamAssignment.find(selectorFilter(exam, sel, { all: true })).select("studentId admit").limit(MAX_BULK * 2).lean()) as unknown as LeanAssignment[];
  if (!rows.length) throw ApiError.badRequest("নির্বাচনে কোনো নির্ধারিত শিক্ষার্থী নেই");
  const now = new Date();
  const by = req.user?.id;
  const fresh = rows.filter((r) => !r.admit);
  const redo = rows.filter((r) => r.admit && (mode === "all" || (mode === "changed" && r.admit.examVersion < exam.version)));
  const skipped0 = rows.length - fresh.length - redo.length;

  let generated = 0;
  if (fresh.length) {
    const updated = await ExamSchedule.findOneAndUpdate({ _id: exam._id }, { $inc: { admitSeq: fresh.length } }, { new: true }).lean();
    const first = (updated?.admitSeq ?? fresh.length) - fresh.length + 1;
    const res = await ExamAssignment.bulkWrite(fresh.map((r, i) => ({
      updateOne: {
        filter: { _id: r._id, admit: { $exists: false } },
        update: { $set: { admit: { cardNo: `${exam.code}-${String(first + i).padStart(4, "0")}`, verifyCode: randomCode(), examVersion: exam.version, generatedAt: now, generatedBy: by, count: 1 } } },
      },
    })), { ordered: false });
    generated = res.modifiedCount ?? 0;
  }
  let regenerated = 0;
  if (redo.length) {
    const res = await ExamAssignment.bulkWrite(redo.map((r) => ({
      updateOne: {
        filter: { _id: r._id, "admit.cardNo": r.admit!.cardNo },
        update: { $set: { "admit.examVersion": exam.version, "admit.generatedAt": now, "admit.generatedBy": by }, $inc: { "admit.count": 1 } },
      },
    })), { ordered: false });
    regenerated = res.modifiedCount ?? 0;
  }
  const skipped = skipped0 + (fresh.length - generated) + (redo.length - regenerated);
  await recordAudit({ req, action: "admit-card.generate", module: "admit-cards", targetCollection: "examassignments", targetId: String(exam._id), after: { mode, scope: sel.scope, batchId: sel.batchId, students: sel.studentIds?.length, generated, regenerated, skipped } });
  return { total: rows.length, generated, regenerated, skipped };
}

/** Print/preview payload. `includePending` (staff preview only) also returns assigned students without a generated card. */
export async function admitData(req: Request, id: string, sel: AdmitSelector, includePending: boolean) {
  const sc = await scope(req);
  const exam = await loadExam(id, sc);
  const filter = selectorFilter(exam, sel, sc);
  if (!includePending) filter.admit = { $exists: true };
  const rows = (await ExamAssignment.find(filter).limit(MAX_BULK).lean()) as unknown as LeanAssignment[];
  return buildAdmitPayload(exam, rows);
}

async function buildAdmitPayload(exam: LeanExam, rows: LeanAssignment[]) {
  const docs = await Student.find({ _id: { $in: rows.map((r) => r.studentId) } }).select(STUDENT_CARD_FIELDS).lean();
  const views = new Map((await buildStudentViews(docs as never)).map((v) => [v.id, v]));
  const [[examView], institution, settings] = await Promise.all([examViews([exam]), cardInstitution(), getCardSettings()]);
  const cards = sortViews(
    rows.filter((r) => views.has(String(r.studentId))).map((r) => {
      const student = views.get(String(r.studentId))!;
      return { name: student.name, batch: student.batch, registrationNumber: student.registrationNumber, student, assignmentId: String(r._id), admit: admitView(r, exam) };
    }),
  ).map(({ student, assignmentId, admit }) => ({ student, assignmentId, admit }));
  return { institution, settings: cardSettingsView(settings), exam: examView, cards };
}

// ---------------------------------------------------------------- student portal

const STUDENT_VISIBLE: ExamStatus[] = ["published", "completed", "cancelled"];

function ownStudentId(req: Request): Types.ObjectId {
  const sid = req.user?.studentId;
  if (!sid || !Types.ObjectId.isValid(sid)) throw ApiError.forbidden();
  return oid(sid);
}

/** The student's own active assignments in published/completed (and, for information, cancelled) exams. Drafts never appear. */
export async function myExams(req: Request) {
  const sid = ownStudentId(req);
  const rows = (await ExamAssignment.find({ studentId: sid, status: "active" }).lean()) as unknown as LeanAssignment[];
  const exams = (await ExamSchedule.find({ _id: { $in: rows.map((r) => r.examId) }, status: { $in: STUDENT_VISIBLE } }).sort({ date: -1 }).lean()) as unknown as LeanExam[];
  const byExam = new Map(rows.map((r) => [String(r.examId), r]));
  const views = await examViews(exams);
  return views.map((v) => {
    const r = byExam.get(v.id)!;
    const valid = v.status !== "cancelled" && !!r.admit;
    return { exam: v, admit: valid ? { cardNo: r.admit!.cardNo, generatedAt: r.admit!.generatedAt } : null, canView: valid };
  });
}

export async function myAdmitCard(req: Request, examId: string) {
  const sid = ownStudentId(req);
  if (!Types.ObjectId.isValid(examId)) throw ApiError.notFound("অ্যাডমিট কার্ড পাওয়া যায়নি");
  const exam = (await ExamSchedule.findOne({ _id: oid(examId), status: { $in: ["published", "completed"] } }).lean()) as unknown as LeanExam | null;
  const row = exam ? ((await ExamAssignment.findOne({ examId: exam._id, studentId: sid, status: "active", admit: { $exists: true } }).lean()) as unknown as LeanAssignment | null) : null;
  if (!exam || !row) throw ApiError.notFound("অ্যাডমিট কার্ড পাওয়া যায়নি");
  return buildAdmitPayload(exam, [row]);
}

// ---------------------------------------------------------------- public verification

export async function verifyAdmit(code: string) {
  const institution = await cardInstitution();
  const inst = { name: institution.name, logoUrl: institution.logoUrl };
  const row = (await ExamAssignment.findOne({ "admit.verifyCode": code }).lean()) as unknown as LeanAssignment | null;
  const exam = row ? ((await ExamSchedule.findById(row.examId).lean()) as unknown as LeanExam | null) : null;
  if (!row || !exam) return { kind: "admit-card", status: "not_found", institution: inst };
  const student = await Student.findById(row.studentId).select("name registrationId photoUrl").lean();
  const status = row.status === "removed" ? "removed"
    : exam.status === "cancelled" ? "cancelled"
    : exam.status === "draft" ? "not_published"
    : exam.status === "completed" ? "completed"
    : "valid";
  if (status === "removed" || status === "not_published") return { kind: "admit-card", status, institution: inst };
  return {
    kind: "admit-card",
    status,
    institution: inst,
    cardNo: row.admit!.cardNo,
    exam: { name: exam.name, examType: exam.examType, date: exam.date, startTime: exam.startTime ?? null, endTime: exam.endTime ?? null, venue: exam.venue ?? null },
    student: student ? { name: student.name, studentId: student.registrationId, photo: student.photoUrl ?? null } : null,
  };
}
