import { Request } from "express";
import { Subject, SubjectDoc } from "./subject.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";

/** See course.service.ts's getDirectorCourseIds — a Batch Director only sees subjects under their own course(s) (Phase 4 §7/§8). */
export async function list(req: Request, scopeCourseIds?: string[]) {
  const { page, limit, skip, sort } = parsePagination(req, { displayOrder: 1, name: 1 });
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["name"]) };
  if (req.query.courseId) filter.courseId = req.query.courseId;
  if (scopeCourseIds) filter.courseId = filter.courseId ? { $eq: filter.courseId, $in: scopeCourseIds } : { $in: scopeCourseIds };

  const [items, total] = await Promise.all([
    Subject.find(filter).sort(sort).skip(skip).limit(limit),
    Subject.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string, scopeCourseIds?: string[]): Promise<SubjectDoc> {
  const doc = await Subject.findById(id);
  if (!doc) throw ApiError.notFound("Subject not found");
  if (scopeCourseIds && !scopeCourseIds.includes(String(doc.courseId))) throw ApiError.notFound("Subject not found");
  return doc;
}

export async function create(req: Request, data: Pick<SubjectDoc, "name" | "courseId"> & Partial<Pick<SubjectDoc, "status" | "displayOrder">>) {
  const doc = await Subject.create(data);
  await recordAudit({ req, action: "subject.create", module: "academic", targetCollection: "subjects", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<Pick<SubjectDoc, "name" | "courseId" | "status" | "displayOrder">>) {
  const doc = await Subject.findById(id);
  if (!doc) throw ApiError.notFound("Subject not found");
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "subject.update", module: "academic", targetCollection: "subjects", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string) {
  const doc = await Subject.findById(id);
  if (!doc) throw ApiError.notFound("Subject not found");
  const { Lecture } = await import("../lectures/lecture.model");
  if (await Lecture.exists({ subjectId: id })) {
    throw ApiError.conflict("This subject has lectures under it — remove or reassign them first");
  }
  await doc.deleteOne();
  await recordAudit({ req, action: "subject.delete", module: "academic", targetCollection: "subjects", targetId: id, before: doc.toObject() });
}
