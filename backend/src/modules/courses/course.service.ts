import { Request } from "express";
import { Course, CourseDoc } from "./course.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { name: 1 });
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["name"]) };
  if (req.query.sessionId) filter.sessionId = req.query.sessionId;

  const [items, total] = await Promise.all([
    Course.find(filter).sort(sort).skip(skip).limit(limit),
    Course.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string): Promise<CourseDoc> {
  const doc = await Course.findById(id);
  if (!doc) throw ApiError.notFound("Course not found");
  return doc;
}

export async function create(req: Request, data: Pick<CourseDoc, "name" | "sessionId" | "duration">) {
  const doc = await Course.create(data);
  await recordAudit({ req, action: "course.create", module: "academic", targetCollection: "courses", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<Pick<CourseDoc, "name" | "sessionId" | "duration">>) {
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
