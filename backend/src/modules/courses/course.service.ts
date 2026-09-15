import { Request } from "express";
import { Course, CourseDoc } from "./course.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";

/**
 * Course→Subject→Lecture is master academic data with no permission gate on
 * its own GET routes (any authenticated user may read it) — but a Batch
 * Director should only ever see the course(s) tied to batch(es) they
 * actually direct, never the whole coaching centre's course list (Phase 4
 * §7/§8). Used by course/subject/lecture controllers alike so the same
 * scope applies at every level of the hierarchy.
 */
export async function getDirectorCourseIds(staffId: string): Promise<string[]> {
  const { Batch } = await import("../batches/batch.model");
  const ids = await Batch.find({ directorId: staffId }).distinct("courseId");
  return ids.map(String);
}

export async function list(req: Request, scopeCourseIds?: string[]) {
  const { page, limit, skip, sort } = parsePagination(req, { displayOrder: 1, name: 1 });
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["name"]) };
  if (req.query.sessionId) filter.sessionId = req.query.sessionId;
  if (scopeCourseIds) filter._id = { $in: scopeCourseIds };

  const [items, total] = await Promise.all([
    Course.find(filter).sort(sort).skip(skip).limit(limit),
    Course.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string, scopeCourseIds?: string[]): Promise<CourseDoc> {
  if (scopeCourseIds && !scopeCourseIds.includes(id)) throw ApiError.notFound("Course not found");
  const doc = await Course.findById(id);
  if (!doc) throw ApiError.notFound("Course not found");
  return doc;
}

export async function create(req: Request, data: Pick<CourseDoc, "name" | "sessionId" | "duration" | "fee"> & Partial<Pick<CourseDoc, "status" | "displayOrder">>) {
  const doc = await Course.create(data);
  await recordAudit({ req, action: "course.create", module: "academic", targetCollection: "courses", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<Pick<CourseDoc, "name" | "sessionId" | "duration" | "fee" | "status" | "displayOrder">>) {
  const doc = await Course.findById(id);
  if (!doc) throw ApiError.notFound("Course not found");
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "course.update", module: "academic", targetCollection: "courses", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string) {
  const doc = await Course.findById(id);
  if (!doc) throw ApiError.notFound("Course not found");
  const { Subject } = await import("../subjects/subject.model");
  if (await Subject.exists({ courseId: id })) {
    throw ApiError.conflict("This course has subjects under it — remove or reassign them first");
  }
  await doc.deleteOne();
  await recordAudit({ req, action: "course.delete", module: "academic", targetCollection: "courses", targetId: id, before: doc.toObject() });
}
