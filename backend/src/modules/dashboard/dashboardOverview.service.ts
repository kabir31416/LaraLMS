import { Request } from "express";
import { Types } from "mongoose";
import { Student } from "../students/student.model";
import { Batch } from "../batches/batch.model";
import { Course } from "../courses/course.model";
import { Payment } from "../payments/payment.model";
import { AttendanceEntry } from "../attendance/attendance.model";
import { OfflineExam } from "../exams/exam.model";
import { OfflineResult } from "../exams/result.model";
import { AuditLog } from "../../audit/auditLog.model";
import { User } from "../users/user.model";
import { Staff } from "../staff/staff.model";
import { AcademicSession } from "../academicSessions/academicSession.model";
import { PERMISSIONS } from "../rbac/permissions";
import { ApiError } from "../../common/utils/ApiError";
import { addDays, daysBetweenInclusive, isIsoDate, localToday, monthKeysEnding } from "../../common/utils/localDate";

/**
 * Admin "command center" overview (Main Dashboard). Everything is a
 * server-side aggregate over the real collections — nothing is loaded into
 * the browser in bulk and nothing is estimated:
 *
 *  - Students: the Student collection (pending/rejected public-entry
 *    applications are excluded from every student figure and reported
 *    separately as an admin task)
 *  - Money: Payment transactions (cancelled payments excluded — the same
 *    rule as payment.service.ts's list/stats). Mess money lives in its own
 *    collection and is never part of these figures.
 *  - Attendance: AttendanceEntry rows
 *  - Exams/results: OfflineExam / OfflineResult
 *  - Activity: the AuditLog itself (no synthetic events)
 *
 * Each section is returned only if the caller holds the permission that
 * section's own module requires, so a restricted Admin (deniedPermissions)
 * gets `null` for what they can't see rather than data they'd otherwise be
 * refused on that module's own pages.
 */

function can(req: Request, permission: string): boolean {
  const perms = req.user?.permissions ?? [];
  return perms.includes("*") || perms.includes(permission);
}

function oid(v: unknown): Types.ObjectId | undefined {
  return typeof v === "string" && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : undefined;
}

const MAX_RANGE_DAYS = 366;
const DAILY_SERIES_MAX_DAYS = 92;

export interface OverviewQuery {
  from?: string;
  to?: string;
  courseId?: string;
  batchId?: string;
}

function resolveRange(q: OverviewQuery) {
  const today = localToday();
  const to = isIsoDate(q.to) && q.to <= today ? q.to : today;
  const from = isIsoDate(q.from) && q.from <= to ? q.from : `${to.slice(0, 7)}-01`;
  const days = daysBetweenInclusive(from, to);
  if (days > MAX_RANGE_DAYS) throw ApiError.badRequest("তারিখের পরিসর সর্বোচ্চ ১ বছর হতে পারে");
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { today, from, to, days, prevFrom, prevTo };
}

const sum = (rows: { total?: number }[] | undefined) => rows?.[0]?.total ?? 0;
const count = (rows: { count?: number }[] | undefined) => rows?.[0]?.count ?? 0;

export async function getAdminOverview(req: Request, q: OverviewQuery) {
  const r = resolveRange(q);
  const courseId = oid(q.courseId);
  const batchId = oid(q.batchId);
  const thisMonthStart = `${r.today.slice(0, 7)}-01`;
  // Same day-span of last month (1st → same day number), so "this month vs last month" compares like with like.
  const lastMonthKey = monthKeysEnding(r.today.slice(0, 7), 2)[0];
  const lastMonthStart = `${lastMonthKey}-01`;
  const lastMonthSameDay = (() => {
    const [y, m] = lastMonthKey.split("-").map(Number);
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${lastMonthKey}-${String(Math.min(dim, Number(r.today.slice(8, 10)))).padStart(2, "0")}`;
  })();
  const monthKeys12 = monthKeysEnding(r.today.slice(0, 7), 12);

  const [header, students, finance, attendance, academic, activity] = await Promise.all([
    headerInfo(r.today),
    can(req, PERMISSIONS.STUDENTS_READ) ? studentSection(r, courseId, batchId, monthKeys12) : null,
    can(req, PERMISSIONS.PAYMENTS_READ) ? financeSection(r, courseId, batchId, monthKeys12, thisMonthStart, lastMonthStart, lastMonthSameDay) : null,
    can(req, PERMISSIONS.ATTENDANCE_READ) || can(req, PERMISSIONS.ATTENDANCE_MARK) ? attendanceSection(r, courseId, batchId) : null,
    can(req, PERMISSIONS.EXAMS_MANAGE) || can(req, PERMISSIONS.RESULTS_READ) ? academicSection(r, batchId) : null,
    can(req, PERMISSIONS.AUDIT_READ) ? activitySection() : null,
  ]);

  return {
    range: { from: r.from, to: r.to, days: r.days, prevFrom: r.prevFrom, prevTo: r.prevTo, today: r.today },
    header,
    students,
    finance,
    attendance,
    academic,
    activity,
  };
}

async function headerInfo(today: string) {
  const { getSettings } = await import("../settings/settings.service");
  const { getInstitutionSettings } = await import("../settings/institution.service");
  const [settings, institution] = await Promise.all([getSettings(), getInstitutionSettings()]);
  const session = settings.defaultSessionId ? await AcademicSession.findById(settings.defaultSessionId).select("name").lean() : null;
  return { today, sessionName: session?.name ?? null, institutionName: institution.name ?? null };
}

// -------------------- Students --------------------

async function studentSection(r: ReturnType<typeof resolveRange>, courseId?: Types.ObjectId, batchId?: Types.ObjectId, monthKeys12: string[] = []) {
  const match: Record<string, unknown> = { admissionStatus: { $nin: ["pending", "rejected"] } };
  if (courseId) match.courseId = courseId;
  if (batchId) match.currentBatchId = batchId;
  const [facet] = await Student.aggregate<{
    byStatus: { _id: string; count: number }[];
    newInRange: { count: number }[];
    newPrevRange: { count: number }[];
    money: { _id: null; due: number; paid: number; discount: number; dueStudents: number }[];
    byCourse: { _id: Types.ObjectId | null; count: number }[];
    byBatch: { _id: Types.ObjectId | null; count: number }[];
    monthly: { _id: string; count: number }[];
  }>([
    { $match: match },
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        newInRange: [{ $match: { admissionDate: { $gte: r.from, $lte: r.to } } }, { $count: "count" }],
        newPrevRange: [{ $match: { admissionDate: { $gte: r.prevFrom, $lte: r.prevTo } } }, { $count: "count" }],
        money: [{ $group: { _id: null, due: { $sum: "$due" }, paid: { $sum: "$paid" }, discount: { $sum: "$discount" }, dueStudents: { $sum: { $cond: [{ $gt: ["$due", 0] }, 1, 0] } } } }],
        byCourse: [{ $group: { _id: "$courseId", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }],
        byBatch: [{ $match: { currentBatchId: { $ne: null } } }, { $group: { _id: "$currentBatchId", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }],
        monthly: [{ $match: { admissionDate: { $gte: `${monthKeys12[0]}-01` } } }, { $group: { _id: { $substrCP: ["$admissionDate", 0, 7] }, count: { $sum: 1 } } }],
      },
    },
  ]);

  const [courses, batches, pendingApplications, recent] = await Promise.all([
    Course.find({ _id: { $in: facet.byCourse.map((c) => c._id).filter(Boolean) } }).select("name").lean(),
    Batch.find({ _id: { $in: facet.byBatch.map((b) => b._id).filter(Boolean) } }).select("name").lean(),
    Student.countDocuments({ admissionStatus: "pending" }),
    Student.find(match).sort({ admissionDate: -1, createdAt: -1 }).limit(6).select("name registrationId course admissionDate currentBatchId photoUrl").populate("currentBatchId", "name").lean(),
  ]);
  const courseName = new Map(courses.map((c) => [String(c._id), c.name]));
  const batchName = new Map(batches.map((b) => [String(b._id), b.name]));
  const monthly = new Map(facet.monthly.map((m) => [m._id, m.count]));
  const active = facet.byStatus.find((s) => s._id === "সক্রিয়")?.count ?? 0;
  const inactive = facet.byStatus.find((s) => s._id === "নিষ্ক্রিয়")?.count ?? 0;
  const money = facet.money[0];
  return {
    total: active + inactive,
    active,
    inactive,
    newInRange: count(facet.newInRange),
    newPrevRange: count(facet.newPrevRange),
    pendingApplications,
    due: money?.due ?? 0,
    paid: money?.paid ?? 0,
    discount: money?.discount ?? 0,
    dueStudents: money?.dueStudents ?? 0,
    byCourse: facet.byCourse.map((c) => ({ id: c._id ? String(c._id) : null, name: c._id ? courseName.get(String(c._id)) ?? "—" : "কোর্স নির্ধারিত নয়", count: c.count })),
    byBatch: facet.byBatch.map((b) => ({ id: String(b._id), name: batchName.get(String(b._id)) ?? "—", count: b.count })),
    monthlyAdmissions: monthKeys12.map((k) => ({ month: k, count: monthly.get(k) ?? 0 })),
    recentAdmissions: recent.map((s) => ({
      id: String(s._id),
      name: s.name,
      registrationId: s.registrationId,
      course: s.course,
      batchName: (s.currentBatchId as unknown as { name?: string } | null)?.name,
      admissionDate: s.admissionDate,
      photoUrl: s.photoUrl,
    })),
  };
}

// -------------------- Finance --------------------

async function financeSection(
  r: ReturnType<typeof resolveRange>,
  courseId: Types.ObjectId | undefined,
  batchId: Types.ObjectId | undefined,
  monthKeys12: string[],
  thisMonthStart: string,
  lastMonthStart: string,
  lastMonthSameDay: string,
) {
  const base: Record<string, unknown> = { status: { $ne: "cancelled" } };
  if (courseId) base.courseId = courseId;
  if (batchId) base.batchId = batchId;
  const inRange = { date: { $gte: r.from, $lte: r.to } };
  const total = { $group: { _id: null, total: { $sum: "$paidAmount" }, count: { $sum: 1 } } };
  const [facet] = await Payment.aggregate<{
    today: { total: number; count: number }[];
    thisMonth: { total: number }[];
    lastMonthToDate: { total: number }[];
    range: { total: number; count: number; discount: number }[];
    prevRange: { total: number }[];
    daily: { _id: string; total: number }[];
    monthly: { _id: string; total: number }[];
    byCourse: { _id: Types.ObjectId | null; total: number }[];
    byMethod: { _id: string; total: number; count: number }[];
    bySource: { _id: string; total: number }[];
  }>([
    { $match: { ...base, date: { $gte: `${monthKeys12[0]}-01` < r.prevFrom ? `${monthKeys12[0]}-01` : r.prevFrom } } },
    {
      $facet: {
        today: [{ $match: { date: r.today } }, total],
        thisMonth: [{ $match: { date: { $gte: thisMonthStart, $lte: r.today } } }, total],
        lastMonthToDate: [{ $match: { date: { $gte: lastMonthStart, $lte: lastMonthSameDay } } }, total],
        range: [{ $match: inRange }, { $group: { _id: null, total: { $sum: "$paidAmount" }, count: { $sum: 1 }, discount: { $sum: "$discount" } } }],
        prevRange: [{ $match: { date: { $gte: r.prevFrom, $lte: r.prevTo } } }, total],
        daily: [{ $match: inRange }, { $group: { _id: "$date", total: { $sum: "$paidAmount" } } }],
        monthly: [{ $match: { date: { $gte: `${monthKeys12[0]}-01` } } }, { $group: { _id: { $substrCP: ["$date", 0, 7] }, total: { $sum: "$paidAmount" } } }],
        byCourse: [{ $match: inRange }, { $group: { _id: "$courseId", total: { $sum: "$paidAmount" } } }, { $sort: { total: -1 } }, { $limit: 8 }],
        byMethod: [{ $match: inRange }, { $group: { _id: "$method", total: { $sum: "$paidAmount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }],
        bySource: [{ $match: inRange }, { $group: { _id: "$source", total: { $sum: "$paidAmount" } } }],
      },
    },
  ]);

  const [courses, recent, dueAgg] = await Promise.all([
    Course.find({ _id: { $in: facet.byCourse.map((c) => c._id).filter(Boolean) } }).select("name").lean(),
    Payment.find({ ...base }).sort({ date: -1, createdAt: -1 }).limit(6).select("receiptNo date paidAmount method studentId feeType source").populate("studentId", "name registrationId").lean(),
    // Due vs Paid uses the students' own running totals (the same figures Fee Management shows), scoped like the rest.
    Student.aggregate<{ _id: null; due: number; paid: number; totalFee: number }>([
      { $match: { admissionStatus: { $nin: ["pending", "rejected"] }, ...(courseId ? { courseId } : {}), ...(batchId ? { currentBatchId: batchId } : {}) } },
      { $group: { _id: null, due: { $sum: "$due" }, paid: { $sum: "$paid" }, totalFee: { $sum: "$totalFee" } } },
    ]),
  ]);
  const courseName = new Map(courses.map((c) => [String(c._id), c.name]));
  const dailyMap = new Map(facet.daily.map((d) => [d._id, d.total]));
  const monthlyMap = new Map(facet.monthly.map((m) => [m._id, m.total]));
  const daily: { date: string; total: number }[] = [];
  if (r.days <= DAILY_SERIES_MAX_DAYS) {
    for (let d = r.from; d <= r.to; d = addDays(d, 1)) daily.push({ date: d, total: dailyMap.get(d) ?? 0 });
  }
  return {
    today: sum(facet.today),
    todayCount: facet.today[0]?.count ?? 0,
    thisMonth: sum(facet.thisMonth),
    lastMonthToDate: sum(facet.lastMonthToDate),
    range: facet.range[0]?.total ?? 0,
    rangeCount: facet.range[0]?.count ?? 0,
    rangeDiscount: facet.range[0]?.discount ?? 0,
    prevRange: sum(facet.prevRange),
    /** Daily series only for ranges up to ~3 months — longer ranges use the monthly trend instead. */
    daily,
    monthly: monthKeys12.map((k) => ({ month: k, total: monthlyMap.get(k) ?? 0 })),
    byCourse: facet.byCourse.map((c) => ({ name: c._id ? courseName.get(String(c._id)) ?? "—" : "কোর্স নির্ধারিত নয়", total: c.total })),
    byMethod: facet.byMethod.map((m) => ({ method: m._id || "—", total: m.total, count: m.count })),
    bySource: facet.bySource.map((s) => ({ source: s._id || "regular", total: s.total })),
    dueVsPaid: { due: dueAgg[0]?.due ?? 0, paid: dueAgg[0]?.paid ?? 0, totalFee: dueAgg[0]?.totalFee ?? 0 },
    recentPayments: recent.map((p) => ({
      id: String(p._id),
      receiptNo: p.receiptNo,
      date: p.date,
      amount: p.paidAmount,
      method: p.method,
      source: p.source,
      studentName: (p.studentId as unknown as { name?: string } | null)?.name,
      studentRegId: (p.studentId as unknown as { registrationId?: string } | null)?.registrationId,
    })),
  };
}

// -------------------- Attendance --------------------

async function attendanceSection(r: ReturnType<typeof resolveRange>, courseId?: Types.ObjectId, batchId?: Types.ObjectId) {
  const match: Record<string, unknown> = {};
  if (batchId) match.batchId = batchId;
  else if (courseId) match.batchId = { $in: await Batch.find({ courseId }).distinct("_id") };
  // Trend: the last ≤31 days of the selected range, so the chart stays readable.
  const trendFrom = r.days > 31 ? addDays(r.to, -30) : r.from;
  const present = { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } };
  const [facet] = await AttendanceEntry.aggregate<{
    today: { _id: string; count: number }[];
    range: { _id: null; total: number; present: number }[];
    trend: { _id: string; total: number; present: number }[];
    byBatch: { _id: Types.ObjectId; total: number; present: number }[];
    lowStudents: { count: number }[];
  }>([
    { $match: { ...match, date: { $gte: r.from < r.today ? r.from : r.today, $lte: r.to > r.today ? r.to : r.today } } },
    {
      $facet: {
        today: [{ $match: { date: r.today } }, { $group: { _id: "$status", count: { $sum: 1 } } }],
        range: [{ $match: { date: { $gte: r.from, $lte: r.to } } }, { $group: { _id: null, total: { $sum: 1 }, present } }],
        trend: [{ $match: { date: { $gte: trendFrom, $lte: r.to } } }, { $group: { _id: "$date", total: { $sum: 1 }, present } }],
        byBatch: [{ $match: { date: { $gte: r.from, $lte: r.to } } }, { $group: { _id: "$batchId", total: { $sum: 1 }, present } }],
        lowStudents: [
          { $match: { date: { $gte: r.from, $lte: r.to } } },
          { $group: { _id: "$studentId", total: { $sum: 1 }, present } },
          { $match: { $expr: { $lt: [{ $divide: ["$present", "$total"] }, 0.6] } } },
          { $count: "count" },
        ],
      },
    },
  ]);
  const batches = await Batch.find({ _id: { $in: facet.byBatch.map((b) => b._id) } }).select("name").lean();
  const batchName = new Map(batches.map((b) => [String(b._id), b.name]));
  const todayPresent = facet.today.find((t) => t._id === "Present")?.count ?? 0;
  const todayAbsent = facet.today.find((t) => t._id === "Absent")?.count ?? 0;
  const pct = (p: number, t: number) => (t ? Math.round((p / t) * 100) : null);
  const trendMap = new Map(facet.trend.map((t) => [t._id, t]));
  const trend: { date: string; pct: number | null; total: number }[] = [];
  for (let d = trendFrom; d <= r.to; d = addDays(d, 1)) {
    const row = trendMap.get(d);
    trend.push({ date: d, pct: row ? pct(row.present, row.total) : null, total: row?.total ?? 0 });
  }
  return {
    todayPresent,
    todayAbsent,
    todayPct: pct(todayPresent, todayPresent + todayAbsent),
    rangePct: facet.range[0] ? pct(facet.range[0].present, facet.range[0].total) : null,
    rangeEntries: facet.range[0]?.total ?? 0,
    lowAttendanceStudents: count(facet.lowStudents),
    trend,
    // Lowest first — the batches that most need attention.
    byBatch: facet.byBatch
      .map((b) => ({ id: String(b._id), name: batchName.get(String(b._id)) ?? "—", pct: pct(b.present, b.total) ?? 0, entries: b.total }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 8),
  };
}

// -------------------- Academic --------------------

async function academicSection(r: ReturnType<typeof resolveRange>, batchId?: Types.ObjectId) {
  const batchMatch = batchId ? { batchId } : {};
  const [activeCourses, totalBatches, upcomingCount, upcoming, recent] = await Promise.all([
    Course.countDocuments({ status: "সক্রিয়" }),
    Batch.countDocuments({}),
    OfflineExam.countDocuments({ ...batchMatch, date: { $gte: r.today } }),
    OfflineExam.find({ ...batchMatch, date: { $gte: r.today } }).sort({ date: 1 }).limit(5).select("title date fullMarks batchId subjectId").populate("batchId", "name").populate("subjectId", "name").lean(),
    OfflineExam.find({ ...batchMatch, date: { $lt: r.today } }).sort({ date: -1, createdAt: -1 }).limit(6).select("title date fullMarks batchId subjectId isPublished").populate("batchId", "name").populate("subjectId", "name").lean(),
  ]);
  const resultCounts = await OfflineResult.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { examId: { $in: recent.map((e) => e._id) } } },
    { $group: { _id: "$examId", count: { $sum: 1 } } },
  ]);
  const countByExam = new Map(resultCounts.map((c) => [String(c._id), c.count]));
  const shape = (e: (typeof recent)[number]) => ({
    id: String(e._id),
    title: e.title,
    date: e.date,
    fullMarks: e.fullMarks,
    batchName: (e.batchId as unknown as { name?: string } | null)?.name,
    subjectName: (e.subjectId as unknown as { name?: string } | null)?.name,
  });
  return {
    activeCourses,
    totalBatches,
    upcomingCount,
    upcoming: upcoming.map((e) => shape(e as never)),
    recent: recent.map((e) => ({ ...shape(e), isPublished: e.isPublished, resultCount: countByExam.get(String(e._id)) ?? 0 })),
  };
}

// -------------------- Activity (real AuditLog entries) --------------------

/** Operational events worth showing on the dashboard — configuration/settings noise is left to the Audit Log page. */
const ACTIVITY_ACTIONS = [
  "student.create", "student.quick-create", "student.approve-entry", "student-import.bulk-approve",
  "payment.create", "payment.cancel",
  "enrollment.create", "enrollment.transfer",
  "exam.create", "exam.save-results", "exam.send-result-sms",
  "material.distribute",
  "notice.create",
  "mess.membership.create", "mess.payment.create", "mess.expense.create", "mess.bill.generate", "mess.settlement.complete",
];

export async function activitySection() {
  const rows = await AuditLog.find({ action: { $in: ACTIVITY_ACTIONS } })
    .sort({ timestamp: -1 })
    .limit(12)
    .select({
      action: 1, module: 1, actorUserId: 1, actorRole: 1, timestamp: 1,
      "after.name": 1, "after.receiptNo": 1, "after.paidAmount": 1, "after.amount": 1, "after.membershipNo": 1,
      "after.title": 1, "after.expenseNo": 1, "after.category": 1, "after.period": 1, "after.created": 1,
    })
    .lean();
  const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter(Boolean).map(String))];
  const [users, staff] = await Promise.all([
    User.find({ _id: { $in: actorIds } }).select("identifier linkedStaffId").populate("linkedStaffId", "name").lean(),
    Staff.find({ _id: { $in: actorIds } }).select("name").lean(),
  ]);
  const actorName = new Map<string, string>();
  for (const u of users) actorName.set(String(u._id), (u.linkedStaffId as unknown as { name?: string } | null)?.name ?? u.identifier);
  for (const s of staff) actorName.set(String(s._id), s.name);
  return rows.map((r) => {
    const after = (r.after ?? {}) as Record<string, unknown>;
    return {
      id: String(r._id),
      action: r.action,
      module: r.module,
      timestamp: r.timestamp,
      actor: r.actorUserId ? actorName.get(String(r.actorUserId)) ?? r.actorRole ?? null : r.actorRole ?? null,
      detail: {
        name: typeof after.name === "string" ? after.name : undefined,
        receiptNo: typeof after.receiptNo === "string" ? after.receiptNo : undefined,
        amount: typeof after.paidAmount === "number" ? after.paidAmount : typeof after.amount === "number" ? after.amount : undefined,
        ref: [after.membershipNo, after.expenseNo, after.title, after.period].find((x) => typeof x === "string") as string | undefined,
        category: typeof after.category === "string" ? after.category : undefined,
        created: typeof after.created === "number" ? after.created : undefined,
      },
    };
  });
}
