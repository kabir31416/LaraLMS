import { Request } from "express";
import { Batch, BatchDoc } from "./batch.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";
import * as enrollmentService from "../enrollments/enrollment.service";

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { name: 1 });
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["name"]) };
  if (req.query.courseId) filter.courseId = req.query.courseId;
  if (req.query.directorId) filter.directorId = req.query.directorId;

  const [items, total] = await Promise.all([
    Batch.find(filter).sort(sort).skip(skip).limit(limit),
    Batch.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string): Promise<BatchDoc> {
  const doc = await Batch.findById(id);
  if (!doc) throw ApiError.notFound("Batch not found");
  return doc;
}

export async function create(req: Request, data: Partial<BatchDoc>) {
  const doc = await Batch.create(data);
  await recordAudit({ req, action: "batch.create", module: "batches", targetCollection: "batches", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<BatchDoc> & { directorId?: string | null }) {
  const doc = await getById(id);
  const before = doc.toObject();
  // `directorId: null` is the explicit "unassign the Batch Director" signal
  // (Batch Director unassignment audit §10) — Object.assign would otherwise
  // just write the literal `null` onto an ObjectId-ref path, which Mongoose
  // does accept, but doing it explicitly here keeps the intent visible and
  // matches how every other "clear this reference" patch in this codebase
  // is handled. Omitting the key entirely (the normal update-nothing case)
  // never reaches this branch, so untouched batches are unaffected.
  const { directorId, ...rest } = patch;
  Object.assign(doc, rest);
  if ("directorId" in patch) {
    doc.directorId = directorId ? (directorId as never) : undefined;
  }
  await doc.save();
  await recordAudit({ req, action: "batch.update", module: "batches", targetCollection: "batches", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string) {
  const doc = await getById(id);
  // Phase 1 §4's missing-delete-guard finding, fixed: a batch with an active
  // roster can't just vanish — students would silently lose their enrollment.
  if (await enrollmentService.hasActiveEnrollments(id)) {
    throw ApiError.conflict("This batch has active students enrolled — transfer or withdraw them first");
  }
  await doc.deleteOne();
  await recordAudit({ req, action: "batch.delete", module: "batches", targetCollection: "batches", targetId: id, before: doc.toObject() });
}
