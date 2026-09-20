import { Request } from "express";
import { CourseSubject, CourseSubjectDoc } from "./courseSubject.model";
import { Subject } from "../subjects/subject.model";
import { Course } from "../courses/course.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";

/** A Batch Director only ever manages/sees CourseSubjects under their own course(s) — same scoping rule as course.service.ts's getDirectorCourseIds, applied one level down. */
function assertCourseInScope(courseId: string, scopeCourseIds?: string[]): void {
  if (scopeCourseIds && !scopeCourseIds.includes(courseId)) throw ApiError.notFound("Course not found");
}

/** Every CourseSubject for one Course, in display order — the "Course → Subjects" list Course Management renders. */
export async function listForCourse(courseId: string, scopeCourseIds?: string[]): Promise<CourseSubjectDoc[]> {
  assertCourseInScope(courseId, scopeCourseIds);
  return CourseSubject.find({ courseId }).sort({ order: 1, createdAt: 1 });
}

/**
 * Every CourseSubject across every Course in one query — lets the frontend
 * build its full Course→Subject picture in a single request instead of one
 * request per Course (this app's master data — Sessions/Courses/Subjects/
 * Lectures — is already fetched this way as flat lists; CourseSubject is no
 * different).
 */
export async function listAll(scopeCourseIds?: string[]): Promise<CourseSubjectDoc[]> {
  const filter: Record<string, unknown> = {};
  if (scopeCourseIds) filter.courseId = { $in: scopeCourseIds };
  return CourseSubject.find(filter).sort({ courseId: 1, order: 1, createdAt: 1 });
}

export async function getById(id: string, scopeCourseIds?: string[]): Promise<CourseSubjectDoc> {
  const doc = await CourseSubject.findById(id);
  if (!doc) throw ApiError.notFound("Course subject not found");
  assertCourseInScope(String(doc.courseId), scopeCourseIds);
  return doc;
}

/**
 * Assigns an existing global Subject to a Course. Both must actually exist,
 * and the same Subject can never be assigned twice to the same Course — the
 * unique (courseId, subjectId) index enforces this at the database level,
 * but it's checked here first so the caller gets a clean, specific
 * conflict message instead of a raw MongoDB duplicate-key error (Duplicate
 * Assignment UX requirement).
 */
export async function assign(
  req: Request,
  courseId: string,
  data: { subjectId: string; order?: number },
  scopeCourseIds?: string[],
): Promise<CourseSubjectDoc> {
  assertCourseInScope(courseId, scopeCourseIds);
  const [course, subject] = await Promise.all([Course.findById(courseId), Subject.findById(data.subjectId)]);
  if (!course) throw ApiError.notFound("Course not found");
  if (!subject) throw ApiError.badRequest("Invalid subject");

  if (await CourseSubject.exists({ courseId, subjectId: data.subjectId })) {
    throw ApiError.conflict("এই সাবজেক্টটি ইতিমধ্যে এই কোর্সে যুক্ত আছে।");
  }

  const doc = await CourseSubject.create({ courseId, subjectId: data.subjectId, order: data.order ?? 0 });
  await recordAudit({ req, action: "course-subject.assign", module: "academic", targetCollection: "coursesubjects", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

/** Reorders or (de)activates an assignment — never changes which Subject or Course it points to (that would just be a different assignment). */
export async function update(
  req: Request,
  id: string,
  patch: { order?: number; status?: CourseSubjectDoc["status"] },
  scopeCourseIds?: string[],
): Promise<CourseSubjectDoc> {
  const doc = await getById(id, scopeCourseIds);
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "course-subject.update", module: "academic", targetCollection: "coursesubjects", targetId: id, before, after: doc.toObject() });
  return doc;
}

/**
 * Removes a Subject from a Course. Never touches the global Subject
 * document itself, and refuses when Lectures still exist under this
 * assignment (they'd otherwise be orphaned with no CourseSubject to hang
 * off) — remove/reassign those first, same "is this referenced?" guard the
 * rest of this app's master data already uses.
 */
export async function remove(req: Request, id: string, scopeCourseIds?: string[]): Promise<void> {
  const doc = await getById(id, scopeCourseIds);
  const { Lecture } = await import("../lectures/lecture.model");
  if (await Lecture.exists({ courseSubjectId: id })) {
    throw ApiError.conflict("এই সাবজেক্টের অধীনে লেকচার আছে — আগে সেগুলো মুছুন বা স্থানান্তর করুন।");
  }
  await doc.deleteOne();
  await recordAudit({ req, action: "course-subject.remove", module: "academic", targetCollection: "coursesubjects", targetId: id, before: doc.toObject() });
}
