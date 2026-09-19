import { Request } from "express";
import { Lecture, LectureDoc } from "./lecture.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";

/** See course.service.ts's getDirectorCourseIds — a Batch Director only sees lectures whose CourseSubject belongs to their own course(s) (Phase 4 §7/§8). */
async function scopeCourseSubjectIds(scopeCourseIds: string[]): Promise<string[]> {
  const { CourseSubject } = await import("../courseSubjects/courseSubject.model");
  const ids = await CourseSubject.find({ courseId: { $in: scopeCourseIds } }).distinct("_id");
  return ids.map(String);
}

export async function list(req: Request, scopeCourseIds?: string[]) {
  const { page, limit, skip, sort } = parsePagination(req, { lectureNumber: 1 });
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["title"]) };
  if (req.query.courseSubjectId) filter.courseSubjectId = req.query.courseSubjectId;
  if (scopeCourseIds) {
    const allowedCourseSubjectIds = await scopeCourseSubjectIds(scopeCourseIds);
    filter.courseSubjectId = filter.courseSubjectId
      ? { $eq: filter.courseSubjectId, $in: allowedCourseSubjectIds }
      : { $in: allowedCourseSubjectIds };
  }

  const [items, total] = await Promise.all([
    Lecture.find(filter).sort(sort).skip(skip).limit(limit),
    Lecture.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string, scopeCourseIds?: string[]): Promise<LectureDoc> {
  const doc = await Lecture.findById(id);
  if (!doc) throw ApiError.notFound("Lecture not found");
  if (scopeCourseIds) {
    const allowedCourseSubjectIds = await scopeCourseSubjectIds(scopeCourseIds);
    if (!allowedCourseSubjectIds.includes(String(doc.courseSubjectId))) throw ApiError.notFound("Lecture not found");
  }
  return doc;
}

export async function create(req: Request, data: Pick<LectureDoc, "title" | "courseSubjectId" | "lectureNumber" | "description"> & Partial<Pick<LectureDoc, "status">>) {
  const doc = await Lecture.create(data);
  await recordAudit({ req, action: "lecture.create", module: "academic", targetCollection: "lectures", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<Pick<LectureDoc, "title" | "courseSubjectId" | "lectureNumber" | "description" | "status">>) {
  const doc = await Lecture.findById(id);
  if (!doc) throw ApiError.notFound("Lecture not found");
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "lecture.update", module: "academic", targetCollection: "lectures", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string) {
  const doc = await Lecture.findById(id);
  if (!doc) throw ApiError.notFound("Lecture not found");
  // NOTE: once Exam/OfflineExam/VideoClass (Modules 18-21) land, add the same
  // "is this referenced?" guard used above for Session/Course/Subject before
  // allowing this delete — tracked alongside those modules, not forgotten.
  await doc.deleteOne();
  await recordAudit({ req, action: "lecture.delete", module: "academic", targetCollection: "lectures", targetId: id, before: doc.toObject() });
}
