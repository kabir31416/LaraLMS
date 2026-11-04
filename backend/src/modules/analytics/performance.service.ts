import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../common/utils/ApiError";
import { PERMISSIONS } from "../rbac/permissions";
import { AcademicSession } from "../academicSessions/academicSession.model";
import { Course } from "../courses/course.model";
import { Batch } from "../batches/batch.model";
import { Subject } from "../subjects/subject.model";
import { Student } from "../students/student.model";
import { OfflineExam } from "../exams/exam.model";
import { OfflineResult } from "../exams/result.model";
import { AttendanceEntry } from "../attendance/attendance.model";
import { computeGrade } from "../exams/exam.service";
import { getSettings } from "../settings/settings.service";
import { cacheGet, cacheSet } from "./performance.cache";
import { evaluateStudent, isValidPoint, mergeRules, pctOf, round2, type ExamPoint, type StudentPerformance } from "./performance.rules";

/**
 * Student Performance Analytics — read-only aggregation over the existing
 * OfflineExam / OfflineResult / AttendanceEntry / Student / Batch data. No
 * new academic store, and nothing here writes to any of those collections.
 *
 * Access:
 *  - Admin (route requires RESULTS_READ): every batch.
 *  - Batch Director: ONLY batches whose directorIds contain their staffId —
 *    applied inside every query here, so a crafted batchId/studentId can't
 *    widen it (it is rejected with 403).
 *  - Student: never these endpoints; their own summary is getMyPerformance().
 */

const ACTIVE_STUDENT = "সক্রিয়";

interface Scope {
  director: boolean;
  /** null = unrestricted (Admin). */
  batchIds: Types.ObjectId[] | null;
  key: string;
}

const oid = (v: unknown): Types.ObjectId | undefined => (typeof v === "string" && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : undefined);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function scopeFor(req: Request): Promise<Scope> {
  const u = req.user!;
  if (u.role === "student" || u.studentId) throw ApiError.forbidden("শিক্ষার্থী এই অ্যানালিটিক্স দেখতে পারে না");
  if (u.role === "batch_director") {
    if (!u.staffId) throw ApiError.forbidden("No linked staff record");
    const ids = await Batch.find({ directorIds: new Types.ObjectId(u.staffId) }).distinct("_id");
    return { director: true, batchIds: ids as Types.ObjectId[], key: `d:${u.staffId}` };
  }
  const perms = u.permissions;
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.RESULTS_READ)) throw ApiError.forbidden("অনুমতি নেই");
  return { director: false, batchIds: null, key: "admin" };
}

export interface AnalyticsFilters {
  sessionId?: string;
  courseId?: string;
  batchId?: string;
  studentId?: string;
  q?: string; // registration no. / roll / name
  examId?: string;
  subjectId?: string;
  dateFrom?: string;
  dateTo?: string;
  attendanceMin?: number;
  attendanceMax?: number;
  status?: string;
}

interface BatchLite { _id: Types.ObjectId; name: string; courseId: Types.ObjectId }

/** Batches matching the filters, always intersected with the caller's scope. */
async function resolveBatches(scope: Scope, f: AnalyticsFilters): Promise<BatchLite[]> {
  const q: Record<string, unknown> = {};
  const idConds: Types.ObjectId[][] = [];
  if (scope.batchIds) idConds.push(scope.batchIds);
  if (f.batchId) {
    const b = oid(f.batchId);
    if (!b) throw ApiError.badRequest("Invalid batchId");
    if (scope.batchIds && !scope.batchIds.some((x) => x.equals(b))) throw ApiError.forbidden("এই ব্যাচের তথ্য দেখার অনুমতি নেই");
    idConds.push([b]);
  }
  if (idConds.length) {
    const [first, ...rest] = idConds;
    q._id = { $in: first.filter((id) => rest.every((r) => r.some((x) => x.equals(id)))) };
  }
  const courseIds: Types.ObjectId[][] = [];
  if (f.courseId) {
    const c = oid(f.courseId);
    if (!c) throw ApiError.badRequest("Invalid courseId");
    courseIds.push([c]);
  }
  if (f.sessionId) {
    const s = oid(f.sessionId);
    if (!s) throw ApiError.badRequest("Invalid sessionId");
    courseIds.push((await Course.find({ sessionId: s }).distinct("_id")) as Types.ObjectId[]);
  }
  if (courseIds.length) {
    const [first, ...rest] = courseIds;
    q.courseId = { $in: first.filter((id) => rest.every((r) => r.some((x) => x.equals(id)))) };
  }
  return Batch.find(q).select("name courseId").lean<BatchLite[]>();
}

interface StudentLite { _id: Types.ObjectId; name: string; registrationId: string; currentRollNumber?: string; currentBatchId?: Types.ObjectId; course?: string; photoUrl?: string }

export interface StudentRow {
  studentId: string;
  name: string;
  registrationId: string;
  rollNumber: string | null;
  batchId: string | null;
  batchName: string | null;
  courseName: string | null;
  photoUrl: string | null;
  percentage: number | null;
  grade: string | null;
  examsSat: number;
  examsAbsent: number;
  highest: number | null;
  lowest: number | null;
  band: StudentPerformance["band"];
  trend: StudentPerformance["trend"];
  trendChange: number | null;
  attendancePct: number | null;
  attendanceEntries: number;
  attendanceBand: StudentPerformance["attendance"]["band"];
  status: StudentPerformance["status"];
  riskReasons: StudentPerformance["riskReasons"];
}

interface Computed {
  generatedAt: string;
  rows: StudentRow[];
  summary: Record<string, number | null>;
  charts: {
    examTrend: { examId: string; title: string; date: string; batchName: string; percentage: number; students: number }[];
    subjects: { subjectId: string; name: string; percentage: number; results: number }[];
    attendanceMonthly: { month: string; pct: number; entries: number }[];
    batches: { batchId: string; name: string; students: number; percentage: number | null; attendancePct: number | null; atRisk: number }[];
    trendSplit: { improving: number; stable: number; declining: number; insufficient: number };
    bands: Record<string, number>;
  };
  rules: ReturnType<typeof mergeRules>;
  passingPercentage: number;
}

// Computed results are cached briefly (performance.cache.ts); paging/sorting run on top, so paging never recomputes.

const STATUS_FILTERS = ["excellent", "good", "average", "needs_improvement", "insufficient", "at_risk", "improving", "declining", "low_attendance"] as const;

function matchesStatus(r: StudentRow, status?: string): boolean {
  if (!status) return true;
  switch (status) {
    case "at_risk": return r.status === "at_risk";
    case "improving": case "declining": return r.trend === status;
    case "low_attendance": return r.attendanceBand === "low";
    default: return r.band === status;
  }
}

async function compute(scope: Scope, f: AnalyticsFilters): Promise<Computed> {
  const settings = await getSettings();
  const rules = mergeRules(settings.performanceRules);
  const passing = settings.passingPercentage;
  const gradeOf = (p: number | null) => (p === null ? null : computeGrade(p, settings.gradeScale) || null);

  const batches = await resolveBatches(scope, f);
  const batchIds = batches.map((b) => b._id);
  const batchById = new Map(batches.map((b) => [String(b._id), b]));
  const courses = await Course.find({ _id: { $in: [...new Set(batches.map((b) => String(b.courseId)))].map((id) => new Types.ObjectId(id)) } }).select("name").lean<{ _id: Types.ObjectId; name: string }[]>();
  const courseName = new Map(courses.map((c) => [String(c._id), c.name]));

  // Students currently in these batches.
  const sf: Record<string, unknown> = { currentBatchId: { $in: batchIds }, status: ACTIVE_STUDENT };
  if (f.studentId) {
    const s = oid(f.studentId);
    if (!s) throw ApiError.badRequest("Invalid studentId");
    sf._id = s;
  }
  if (f.q?.trim()) {
    const term = f.q.trim().slice(0, 60);
    sf.$or = [{ registrationId: term }, { currentRollNumber: term }, { name: { $regex: escapeRegex(term), $options: "i" } }];
  }
  const students = batchIds.length
    ? await Student.find(sf).select("name registrationId currentRollNumber currentBatchId course photoUrl").lean<StudentLite[]>()
    : [];
  const studentIds = students.map((s) => s._id);

  // Exams in scope.
  const ef: Record<string, unknown> = { batchId: { $in: batchIds } };
  if (f.subjectId) { const s = oid(f.subjectId); if (!s) throw ApiError.badRequest("Invalid subjectId"); ef.subjectId = s; }
  if (f.examId) { const e = oid(f.examId); if (!e) throw ApiError.badRequest("Invalid examId"); ef._id = e; }
  if (f.dateFrom || f.dateTo) ef.date = { ...(f.dateFrom ? { $gte: f.dateFrom } : {}), ...(f.dateTo ? { $lte: f.dateTo } : {}) };
  const exams = batchIds.length
    ? await OfflineExam.find(ef).select("title fullMarks date batchId subjectId").lean<{ _id: Types.ObjectId; title: string; fullMarks: number; date: string; batchId: Types.ObjectId; subjectId: Types.ObjectId }[]>()
    : [];
  const examById = new Map(exams.map((e) => [String(e._id), e]));

  // One grouped aggregation each for results and attendance — no per-student queries.
  const [resultGroups, attendanceGroups] = await Promise.all([
    exams.length && studentIds.length
      ? OfflineResult.aggregate<{ _id: Types.ObjectId; r: { e: Types.ObjectId; m: number | null }[] }>([
          { $match: { examId: { $in: exams.map((e) => e._id) }, studentId: { $in: studentIds } } },
          { $group: { _id: "$studentId", r: { $push: { e: "$examId", m: "$marks" } } } },
        ])
      : [],
    studentIds.length
      ? AttendanceEntry.aggregate<{ _id: { s: Types.ObjectId; m: string }; present: number; total: number }>([
          {
            $match: {
              studentId: { $in: studentIds },
              batchId: { $in: batchIds },
              ...(f.dateFrom || f.dateTo ? { date: { ...(f.dateFrom ? { $gte: f.dateFrom } : {}), ...(f.dateTo ? { $lte: f.dateTo } : {}) } } : {}),
            },
          },
          { $group: { _id: { s: "$studentId", m: { $substrBytes: ["$date", 0, 7] } }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } } } },
        ])
      : [],
  ]);

  const pointsByStudent = new Map<string, ExamPoint[]>();
  for (const g of resultGroups) {
    pointsByStudent.set(
      String(g._id),
      g.r.flatMap((x) => {
        const ex = examById.get(String(x.e));
        return ex ? [{ examId: String(x.e), date: ex.date, fullMarks: ex.fullMarks, marks: x.m }] : [];
      }),
    );
  }
  const attByStudent = new Map<string, { present: number; total: number }>();
  const attByMonth = new Map<string, { present: number; total: number }>();
  for (const a of attendanceGroups) {
    const k = String(a._id.s);
    const cur = attByStudent.get(k) ?? { present: 0, total: 0 };
    cur.present += a.present; cur.total += a.total;
    attByStudent.set(k, cur);
  }

  let rows: StudentRow[] = students.map((s) => {
    const perf = evaluateStudent(pointsByStudent.get(String(s._id)) ?? [], attByStudent.get(String(s._id)) ?? { present: 0, total: 0 }, passing, rules);
    const b = s.currentBatchId ? batchById.get(String(s.currentBatchId)) : undefined;
    return {
      studentId: String(s._id),
      name: s.name,
      registrationId: s.registrationId,
      rollNumber: s.currentRollNumber ?? null,
      batchId: b ? String(b._id) : null,
      batchName: b?.name ?? null,
      courseName: b ? courseName.get(String(b.courseId)) ?? s.course ?? null : s.course ?? null,
      photoUrl: s.photoUrl ?? null,
      percentage: perf.percentage,
      grade: gradeOf(perf.percentage),
      examsSat: perf.examsSat,
      examsAbsent: perf.examsAbsent,
      highest: perf.highest,
      lowest: perf.lowest,
      band: perf.band,
      trend: perf.trend,
      trendChange: perf.trendChange,
      attendancePct: perf.attendance.pct,
      attendanceEntries: perf.attendance.total,
      attendanceBand: perf.attendance.band,
      status: perf.status,
      riskReasons: perf.riskReasons,
    };
  });

  if (f.attendanceMin !== undefined || f.attendanceMax !== undefined) {
    rows = rows.filter((r) => r.attendancePct !== null && (f.attendanceMin === undefined || r.attendancePct >= f.attendanceMin) && (f.attendanceMax === undefined || r.attendancePct <= f.attendanceMax));
  }
  rows = rows.filter((r) => matchesStatus(r, f.status));

  // ---- summary + charts over the filtered set ----
  const included = new Set(rows.map((r) => r.studentId));
  let obt = 0, full = 0, pres = 0, tot = 0;
  const examAgg = new Map<string, { o: number; f: number; n: number }>();
  const subjAgg = new Map<string, { o: number; f: number; n: number }>();
  const batchAgg = new Map<string, { o: number; f: number; p: number; t: number; n: number; risk: number }>();
  for (const r of rows) {
    const bk = r.batchId ?? "-";
    const ba = batchAgg.get(bk) ?? { o: 0, f: 0, p: 0, t: 0, n: 0, risk: 0 };
    ba.n++; if (r.status === "at_risk") ba.risk++;
    for (const p of pointsByStudent.get(r.studentId) ?? []) {
      if (!isValidPoint(p) || p.marks === null) continue;
      obt += p.marks; full += p.fullMarks; ba.o += p.marks; ba.f += p.fullMarks;
      const ex = examById.get(p.examId)!;
      const ea = examAgg.get(p.examId) ?? { o: 0, f: 0, n: 0 };
      ea.o += p.marks; ea.f += p.fullMarks; ea.n++; examAgg.set(p.examId, ea);
      const sk = String(ex.subjectId);
      const sa = subjAgg.get(sk) ?? { o: 0, f: 0, n: 0 };
      sa.o += p.marks; sa.f += p.fullMarks; sa.n++; subjAgg.set(sk, sa);
    }
    const att = attByStudent.get(r.studentId);
    if (att) { pres += att.present; tot += att.total; ba.p += att.present; ba.t += att.total; }
    batchAgg.set(bk, ba);
  }
  for (const a of attendanceGroups) {
    if (!included.has(String(a._id.s))) continue;
    const m = attByMonth.get(a._id.m) ?? { present: 0, total: 0 };
    m.present += a.present; m.total += a.total; attByMonth.set(a._id.m, m);
  }
  const subjectNames = new Map(
    (await Subject.find({ _id: { $in: [...subjAgg.keys()].map((k) => new Types.ObjectId(k)) } }).select("name").lean<{ _id: Types.ObjectId; name: string }[]>()).map((s) => [String(s._id), s.name]),
  );

  const count = (pred: (r: StudentRow) => boolean) => rows.filter(pred).length;
  const bands: Record<string, number> = { excellent: 0, good: 0, average: 0, needs_improvement: 0, insufficient: 0 };
  rows.forEach((r) => { bands[r.band]++; });

  return {
    generatedAt: new Date().toISOString(),
    rows,
    rules,
    passingPercentage: passing,
    summary: {
      totalStudents: rows.length,
      withResults: count((r) => r.examsSat > 0),
      withAttendance: count((r) => r.attendancePct !== null),
      avgPercentage: full > 0 ? round2((obt / full) * 100) : null,
      avgAttendance: tot > 0 ? Math.round((pres / tot) * 100) : null,
      improving: count((r) => r.trend === "improving"),
      declining: count((r) => r.trend === "declining"),
      lowAttendance: count((r) => r.attendanceBand === "low"),
      atRisk: count((r) => r.status === "at_risk"),
      exams: exams.length,
    },
    charts: {
      examTrend: [...examAgg.entries()]
        .map(([id, a]) => { const ex = examById.get(id)!; return { examId: id, title: ex.title, date: ex.date, batchName: batchById.get(String(ex.batchId))?.name ?? "", percentage: round2((a.o / a.f) * 100), students: a.n }; })
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-20),
      subjects: [...subjAgg.entries()]
        .map(([id, a]) => ({ subjectId: id, name: subjectNames.get(id) ?? "—", percentage: round2((a.o / a.f) * 100), results: a.n }))
        .sort((a, b) => b.percentage - a.percentage),
      attendanceMonthly: [...attByMonth.entries()]
        .map(([month, a]) => ({ month, pct: Math.round((a.present / a.total) * 100), entries: a.total }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12),
      batches: [...batchAgg.entries()]
        .filter(([k]) => k !== "-")
        .map(([id, a]) => ({ batchId: id, name: batchById.get(id)?.name ?? "—", students: a.n, percentage: a.f ? round2((a.o / a.f) * 100) : null, attendancePct: a.t ? Math.round((a.p / a.t) * 100) : null, atRisk: a.risk }))
        .sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1)),
      trendSplit: { improving: count((r) => r.trend === "improving"), stable: count((r) => r.trend === "stable"), declining: count((r) => r.trend === "declining"), insufficient: count((r) => r.trend === "insufficient") },
      bands,
    },
  };
}

const SORTS: Record<string, (a: StudentRow, b: StudentRow) => number> = {
  risk: (a, b) => b.riskReasons.length - a.riskReasons.length || (a.percentage ?? 101) - (b.percentage ?? 101) || a.name.localeCompare(b.name),
  percentage_desc: (a, b) => (b.percentage ?? -1) - (a.percentage ?? -1) || a.name.localeCompare(b.name),
  percentage_asc: (a, b) => (a.percentage ?? 101) - (b.percentage ?? 101) || a.name.localeCompare(b.name),
  attendance_asc: (a, b) => (a.attendancePct ?? 101) - (b.attendancePct ?? 101) || a.name.localeCompare(b.name),
  attendance_desc: (a, b) => (b.attendancePct ?? -1) - (a.attendancePct ?? -1) || a.name.localeCompare(b.name),
  trend: (a, b) => (a.trendChange ?? 0) - (b.trendChange ?? 0),
  name: (a, b) => a.name.localeCompare(b.name, "bn"),
};

export async function getPerformance(
  req: Request,
  f: AnalyticsFilters,
  opts: { page: number; limit: number; sort?: string; fresh?: boolean; exportAll?: boolean },
) {
  const scope = await scopeFor(req);
  if (f.status && !(STATUS_FILTERS as readonly string[]).includes(f.status)) throw ApiError.badRequest("Invalid status");
  const key = JSON.stringify([scope.key, f]);
  let computed = opts.fresh ? null : cacheGet<Computed>(key);
  if (!computed) { computed = await compute(scope, f); cacheSet(key, computed); }

  const sorted = [...computed.rows].sort(SORTS[opts.sort ?? "risk"] ?? SORTS.risk);
  const limit = opts.exportAll ? Math.min(sorted.length, 5000) : opts.limit;
  const page = opts.exportAll ? 1 : opts.page;
  const items = sorted.slice((page - 1) * limit, page * limit);
  return {
    generatedAt: computed.generatedAt,
    scope: { director: scope.director },
    rules: computed.rules,
    passingPercentage: computed.passingPercentage,
    summary: computed.summary,
    charts: computed.charts,
    items,
    meta: { page, limit, total: sorted.length, totalPages: Math.max(1, Math.ceil(sorted.length / Math.max(1, limit))) },
  };
}

/** Filter options limited to the caller's scope; exams only once a course/batch narrows them. */
export async function getFilterOptions(req: Request, f: { courseId?: string; batchId?: string }) {
  const scope = await scopeFor(req);
  const batches = await Batch.find(scope.batchIds ? { _id: { $in: scope.batchIds } } : {}).select("name courseId").sort({ name: 1 }).lean<BatchLite[]>();
  const courseIds = [...new Set(batches.map((b) => String(b.courseId)))].map((id) => new Types.ObjectId(id));
  const courses = await Course.find(scope.batchIds ? { _id: { $in: courseIds } } : {}).select("name sessionId").sort({ name: 1 }).lean<{ _id: Types.ObjectId; name: string; sessionId: Types.ObjectId }[]>();
  const sessionIds = [...new Set(courses.map((c) => String(c.sessionId)))].map((id) => new Types.ObjectId(id));
  const sessions = await AcademicSession.find(scope.batchIds ? { _id: { $in: sessionIds } } : {}).select("name").sort({ name: -1 }).lean<{ _id: Types.ObjectId; name: string }[]>();
  const scopedBatchIds = batches.map((b) => b._id);
  const subjectIds = await OfflineExam.find({ batchId: { $in: scopedBatchIds } }).distinct("subjectId");
  const subjects = await Subject.find({ _id: { $in: subjectIds } }).select("name").sort({ name: 1 }).lean<{ _id: Types.ObjectId; name: string }[]>();

  let exams: { id: string; title: string; date: string; batchId: string; subjectId: string }[] = [];
  const narrowed = f.batchId
    ? scopedBatchIds.filter((id) => String(id) === f.batchId)
    : f.courseId ? batches.filter((b) => String(b.courseId) === f.courseId).map((b) => b._id) : [];
  if (narrowed.length) {
    const docs = await OfflineExam.find({ batchId: { $in: narrowed } }).select("title date batchId subjectId").sort({ date: -1 }).limit(300).lean<{ _id: Types.ObjectId; title: string; date: string; batchId: Types.ObjectId; subjectId: Types.ObjectId }[]>();
    exams = docs.map((e) => ({ id: String(e._id), title: e.title, date: e.date, batchId: String(e.batchId), subjectId: String(e.subjectId) }));
  }
  return {
    director: scope.director,
    sessions: sessions.map((s) => ({ id: String(s._id), name: s.name })),
    courses: courses.map((c) => ({ id: String(c._id), name: c.name, sessionId: String(c.sessionId) })),
    batches: batches.map((b) => ({ id: String(b._id), name: b.name, courseId: String(b.courseId) })),
    subjects: subjects.map((s) => ({ id: String(s._id), name: s.name })),
    exams,
  };
}

/** Builds one student's full analytics profile from ALL of their own results/attendance (optionally date/subject limited). */
async function buildStudentProfile(studentId: Types.ObjectId, f: { dateFrom?: string; dateTo?: string; subjectId?: string }, includeRisk: boolean) {
  const student = await Student.findById(studentId).select("name registrationId currentRollNumber currentBatchId course photoUrl status").lean<StudentLite & { status: string }>();
  if (!student) throw ApiError.notFound("Student not found");
  const settings = await getSettings();
  const rules = mergeRules(settings.performanceRules);
  const passing = settings.passingPercentage;

  const examMatch: Record<string, unknown> = {};
  if (f.dateFrom || f.dateTo) examMatch["exam.date"] = { ...(f.dateFrom ? { $gte: f.dateFrom } : {}), ...(f.dateTo ? { $lte: f.dateTo } : {}) };
  const sid = oid(f.subjectId ?? "");
  if (sid) examMatch["exam.subjectId"] = sid;

  const [rows, attendanceMonthly, batch] = await Promise.all([
    OfflineResult.aggregate<{ examId: Types.ObjectId; marks: number | null; title: string; date: string; fullMarks: number; subjectId: Types.ObjectId; subjectName: string; batchName: string }>([
      { $match: { studentId } },
      { $lookup: { from: "offlineexams", localField: "examId", foreignField: "_id", as: "exam" } },
      { $unwind: "$exam" },
      ...(Object.keys(examMatch).length ? [{ $match: examMatch }] : []),
      { $lookup: { from: "subjects", localField: "exam.subjectId", foreignField: "_id", as: "subject" } },
      { $lookup: { from: "batches", localField: "exam.batchId", foreignField: "_id", as: "batch" } },
      {
        $project: {
          _id: 0, examId: 1, marks: 1,
          title: "$exam.title", date: "$exam.date", fullMarks: "$exam.fullMarks", subjectId: "$exam.subjectId",
          subjectName: { $ifNull: [{ $arrayElemAt: ["$subject.name", 0] }, "—"] },
          batchName: { $ifNull: [{ $arrayElemAt: ["$batch.name", 0] }, ""] },
        },
      },
      { $sort: { date: 1 } },
    ]),
    AttendanceEntry.aggregate<{ _id: string; present: number; total: number }>([
      { $match: { studentId, ...(f.dateFrom || f.dateTo ? { date: { ...(f.dateFrom ? { $gte: f.dateFrom } : {}), ...(f.dateTo ? { $lte: f.dateTo } : {}) } } : {}) } },
      { $group: { _id: { $substrBytes: ["$date", 0, 7] }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]),
    student.currentBatchId ? Batch.findById(student.currentBatchId).select("name courseId").lean<BatchLite>() : null,
  ]);

  const points: ExamPoint[] = rows.map((r) => ({ examId: String(r.examId), date: r.date, fullMarks: r.fullMarks, marks: r.marks }));
  const att = attendanceMonthly.reduce((a, m) => ({ present: a.present + m.present, total: a.total + m.total }), { present: 0, total: 0 });
  const perf = evaluateStudent(points, att, passing, rules);
  const grade = (p: number | null) => (p === null ? null : computeGrade(p, settings.gradeScale) || null);

  const valid = rows.filter((r) => isValidPoint({ examId: "", date: r.date, fullMarks: r.fullMarks, marks: r.marks }));
  const exams = valid.map((r) => {
    const pct = pctOf({ examId: "", date: r.date, fullMarks: r.fullMarks, marks: r.marks });
    return {
      examId: String(r.examId), title: r.title, date: r.date, subject: r.subjectName, subjectId: String(r.subjectId), batch: r.batchName,
      fullMarks: r.fullMarks, marks: r.marks, percentage: pct, grade: grade(pct),
      status: r.marks === null ? "অনুপস্থিত" : (pct as number) >= passing ? "উত্তীর্ণ" : "অনুত্তীর্ণ",
    };
  });
  const bySubject = new Map<string, { name: string; o: number; f: number; n: number; absent: number }>();
  for (const e of exams) {
    const s = bySubject.get(e.subjectId) ?? { name: e.subject, o: 0, f: 0, n: 0, absent: 0 };
    if (e.marks === null) s.absent++; else { s.o += e.marks; s.f += e.fullMarks; s.n++; }
    bySubject.set(e.subjectId, s);
  }
  const subjects = [...bySubject.entries()].map(([id, s]) => {
    const pct = s.f ? round2((s.o / s.f) * 100) : null;
    return { subjectId: id, name: s.name, exams: s.n, absent: s.absent, obtained: s.o, fullMarks: s.f, percentage: pct, grade: grade(pct) };
  }).sort((a, b) => a.name.localeCompare(b.name, "bn"));

  const courseName = batch ? (await Course.findById(batch.courseId).select("name").lean<{ name: string }>())?.name ?? student.course ?? null : student.course ?? null;
  return {
    student: {
      id: String(student._id), name: student.name, registrationId: student.registrationId, rollNumber: student.currentRollNumber ?? null,
      course: courseName, batch: batch?.name ?? null, batchId: batch ? String(batch._id) : null, photoUrl: student.photoUrl ?? null,
    },
    passingPercentage: passing,
    overall: {
      percentage: perf.percentage, grade: grade(perf.percentage), obtained: perf.obtained, fullMarks: perf.fullMarks,
      examsSat: perf.examsSat, examsAbsent: perf.examsAbsent, highest: perf.highest, lowest: perf.lowest,
      result: perf.percentage === null ? null : perf.percentage >= passing ? "উত্তীর্ণ" : "অনুত্তীর্ণ",
    },
    trend: { direction: perf.trend, change: perf.trendChange, window: rules.trendWindow },
    attendance: {
      present: perf.attendance.present, absent: perf.attendance.total - perf.attendance.present, total: perf.attendance.total, pct: perf.attendance.pct,
      monthly: attendanceMonthly.map((m) => ({ month: m._id, present: m.present, total: m.total, pct: Math.round((m.present / m.total) * 100) })),
      ...(includeRisk ? { band: perf.attendance.band } : {}),
    },
    exams: exams.slice().reverse(), // newest first
    subjects,
    ...(includeRisk ? { band: perf.band, status: perf.status, riskReasons: perf.riskReasons, rules } : {}),
  };
}

export async function getStudentPerformance(req: Request, id: string, f: { dateFrom?: string; dateTo?: string; subjectId?: string }) {
  const scope = await scopeFor(req);
  const sid = oid(id);
  if (!sid) throw ApiError.badRequest("Invalid student id");
  if (scope.batchIds) {
    const s = await Student.findById(sid).select("currentBatchId").lean<{ currentBatchId?: Types.ObjectId }>();
    if (!s) throw ApiError.notFound("Student not found");
    if (!s.currentBatchId || !scope.batchIds.some((b) => b.equals(s.currentBatchId!))) throw ApiError.forbidden("এই শিক্ষার্থীর তথ্য দেখার অনুমতি নেই");
  }
  return buildStudentProfile(sid, f, true);
}

/** A student's own analytics — identity always from the session, never a URL/query id; no at-risk labels. */
export async function getMyPerformance(req: Request, f: { dateFrom?: string; dateTo?: string; subjectId?: string }) {
  const own = req.user?.studentId;
  if (!own || !Types.ObjectId.isValid(own)) throw ApiError.forbidden("No linked student record");
  return buildStudentProfile(new Types.ObjectId(own), f, false);
}
