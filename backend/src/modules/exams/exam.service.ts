import { Request } from "express";
import { OfflineExam, OfflineExamDoc } from "./exam.model";
import { OfflineResult } from "./result.model";
import { Batch } from "../batches/batch.model";
import { Student } from "../students/student.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../common/utils/pagination";
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

export async function create(
  req: Request,
  data: { batchId: string; subjectId: string; lectureId: string; title: string; fullMarks: number; date: string },
): Promise<OfflineExamDoc> {
  await assertCanActOnBatch(req, data.batchId);
  const doc = await OfflineExam.create(data);
  await recordAudit({ req, action: "exam.create", module: "exams", targetCollection: "offlineexams", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function list(req: Request) {
  const scope = await readScope(req);
  const { page, limit, skip, sort } = parsePagination(req, { date: -1 });
  const filter: Record<string, unknown> = {};
  if (req.query.batchId) filter.batchId = req.query.batchId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;
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
