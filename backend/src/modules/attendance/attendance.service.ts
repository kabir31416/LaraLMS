import { Request } from "express";
import { Types } from "mongoose";
import { ATTENDANCE_SOURCE, ATTENDANCE_STATUS, AttendanceEntry } from "./attendance.model";
import { Batch } from "../batches/batch.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../common/utils/pagination";
import { PERMISSIONS } from "../rbac/permissions";

/** Batch Directors may only mark/view via their own batches unless they also hold the broad permission. */
export async function assertCanActOnBatch(req: Request, batchId: string, broadPermission: string): Promise<void> {
  const perms = req.user!.permissions;
  if (perms.includes("*") || perms.includes(broadPermission)) return;
  const batch = await Batch.findById(batchId).select("directorId");
  if (!batch) throw ApiError.notFound("Batch not found");
  if (!req.user!.staffId || String(batch.directorId) !== req.user!.staffId) {
    throw ApiError.forbidden("You may only act on batches you direct");
  }
}

export async function save(
  req: Request,
  data: {
    batchId: string;
    date: string;
    items: { studentId: string; status: (typeof ATTENDANCE_STATUS)[number] }[];
    source: (typeof ATTENDANCE_SOURCE)[number];
    examId?: string;
  },
): Promise<void> {
  await assertCanActOnBatch(req, data.batchId, PERMISSIONS.ATTENDANCE_MARK);

  const batchId = new Types.ObjectId(data.batchId);
  const examId = data.examId ? new Types.ObjectId(data.examId) : undefined;
  const filterExtra = data.source === "Exam" ? { examId } : { date: data.date };
  const ops = data.items.map((item) => ({
    updateOne: {
      filter: { studentId: new Types.ObjectId(item.studentId), source: data.source, ...filterExtra },
      update: { $set: { batchId, date: data.date, status: item.status, examId } },
      upsert: true,
    },
  }));
  await AttendanceEntry.bulkWrite(ops);

  await recordAudit({
    req,
    action: "attendance.save",
    module: "attendance",
    targetCollection: "attendanceentries",
    targetId: data.batchId,
    after: { batchId: data.batchId, date: data.date, source: data.source, count: data.items.length },
  });
}

function hasBroadReadAccess(req: Request): boolean {
  const perms = req.user!.permissions;
  return perms.includes("*") || perms.includes(PERMISSIONS.ATTENDANCE_READ);
}

export async function list(req: Request) {
  if (!hasBroadReadAccess(req)) {
    if (!req.user!.studentId) throw ApiError.forbidden("No linked student record");
    req.query.studentId = req.user!.studentId;
  }

  const { page, limit, skip, sort } = parsePagination(req, { date: -1 });
  const filter: Record<string, unknown> = {};
  if (req.query.batchId) filter.batchId = req.query.batchId;
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.source) filter.source = req.query.source;
  if (req.query.date) filter.date = req.query.date;
  else if (req.query.dateFrom || req.query.dateTo) {
    filter.date = {
      ...(req.query.dateFrom ? { $gte: req.query.dateFrom } : {}),
      ...(req.query.dateTo ? { $lte: req.query.dateTo } : {}),
    };
  }

  const [items, total] = await Promise.all([
    AttendanceEntry.find(filter).sort(sort).skip(skip).limit(limit),
    AttendanceEntry.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

/**
 * Per-student attendance percentage, computed in one aggregation rather
 * than the frontend looping a per-student network call over every row in a
 * batch/report — Phase 1 §9's N+1 finding.
 */
export async function percentages(
  req: Request,
  params: { studentIds?: string[]; batchId?: string; batchIds?: string[]; dateFrom?: string; dateTo?: string },
): Promise<Record<string, number>> {
  if (!hasBroadReadAccess(req)) {
    if (!req.user!.studentId) throw ApiError.forbidden("No linked student record");
    params = { ...params, studentIds: [req.user!.studentId] };
  }

  const filter: Record<string, unknown> = {};
  if (params.studentIds?.length) filter.studentId = { $in: params.studentIds };
  if (params.batchId) filter.batchId = params.batchId;
  else if (params.batchIds?.length) filter.batchId = { $in: params.batchIds };
  if (params.dateFrom || params.dateTo) {
    filter.date = {
      ...(params.dateFrom ? { $gte: params.dateFrom } : {}),
      ...(params.dateTo ? { $lte: params.dateTo } : {}),
    };
  }
  if (!filter.studentId && !filter.batchId) return {};

  const rows = await AttendanceEntry.aggregate<{ _id: string; total: number; present: number }>([
    { $match: filter },
    { $group: { _id: "$studentId", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } } } },
  ]);
  const result: Record<string, number> = {};
  for (const r of rows) result[String(r._id)] = r.total ? Math.round((r.present / r.total) * 100) : 0;
  return result;
}

/** Same grouping as `percentages`, but keeps the present/absent counts too — backs the Attendance Report's per-student table. */
export async function byStudent(
  req: Request,
  params: { batchId?: string; dateFrom?: string; dateTo?: string },
): Promise<{ studentId: string; present: number; absent: number; pct: number }[]> {
  if (!hasBroadReadAccess(req)) {
    if (!req.user!.studentId) throw ApiError.forbidden("No linked student record");
    (params as Record<string, unknown>).studentId = req.user!.studentId;
  }

  const filter: Record<string, unknown> = {};
  if (params.batchId) filter.batchId = params.batchId;
  if ((params as Record<string, unknown>).studentId) filter.studentId = (params as Record<string, unknown>).studentId;
  if (params.dateFrom || params.dateTo) {
    filter.date = {
      ...(params.dateFrom ? { $gte: params.dateFrom } : {}),
      ...(params.dateTo ? { $lte: params.dateTo } : {}),
    };
  }

  const rows = await AttendanceEntry.aggregate<{ _id: string; total: number; present: number }>([
    { $match: filter },
    { $group: { _id: "$studentId", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } } } },
  ]);
  return rows
    .map((r) => ({
      studentId: String(r._id),
      present: r.present,
      absent: r.total - r.present,
      pct: r.total ? Math.round((r.present / r.total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Blended present/absent/pct plus a per-day-per-batch breakdown — backs the
 * admin Attendance report page's stat cards and daily table without
 * shipping every raw row to the browser to group there.
 */
export async function stats(req: Request, params: { batchId?: string; batchIds?: string[]; dateFrom?: string; dateTo?: string }) {
  if (!hasBroadReadAccess(req)) {
    if (!req.user!.studentId) throw ApiError.forbidden("No linked student record");
    (params as Record<string, unknown>).studentId = req.user!.studentId;
  }

  const filter: Record<string, unknown> = {};
  if (params.batchId) filter.batchId = params.batchId;
  else if (params.batchIds?.length) filter.batchId = { $in: params.batchIds };
  if ((params as Record<string, unknown>).studentId) filter.studentId = (params as Record<string, unknown>).studentId;
  if (params.dateFrom || params.dateTo) {
    filter.date = {
      ...(params.dateFrom ? { $gte: params.dateFrom } : {}),
      ...(params.dateTo ? { $lte: params.dateTo } : {}),
    };
  }

  const [facet] = await AttendanceEntry.aggregate<{
    overall: { _id: string; count: number }[];
    daily: { _id: { date: string; batchId: Types.ObjectId }; present: number; absent: number }[];
  }>([
    { $match: filter },
    {
      $facet: {
        overall: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        daily: [
          {
            $group: {
              _id: { date: "$date", batchId: "$batchId" },
              present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } },
              absent: { $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] } },
            },
          },
        ],
      },
    },
  ]);

  const present = facet.overall.find((s) => s._id === "Present")?.count || 0;
  const absent = facet.overall.find((s) => s._id === "Absent")?.count || 0;
  const pct = present + absent ? Math.round((present / (present + absent)) * 100) : 0;

  return {
    present,
    absent,
    pct,
    daily: facet.daily
      .map((d) => ({ date: d._id.date, batchId: String(d._id.batchId), present: d.present, absent: d.absent }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}
