import { Request } from "express";
import { Subject, SubjectDoc } from "./subject.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";

/**
 * Subjects are now a GLOBAL catalog (Subject/Course Refactor) — there is no
 * per-Course scoping here anymore. A Batch Director sees the same catalog
 * an Admin does (this list is read-only for them either way, gated by
 * SUBJECTS_MANAGE on the write routes); which subjects apply to *their*
 * course(s) is answered by courseSubject.service.ts's listForCourse, not
 * this list.
 */
export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { displayOrder: 1, name: 1 });
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["name", "code"]) };

  const [items, total] = await Promise.all([
    Subject.find(filter).sort(sort).skip(skip).limit(limit),
    Subject.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string): Promise<SubjectDoc> {
  const doc = await Subject.findById(id);
  if (!doc) throw ApiError.notFound("Subject not found");
  return doc;
}

export async function create(req: Request, data: Pick<SubjectDoc, "name"> & Partial<Pick<SubjectDoc, "code" | "status" | "displayOrder">>) {
  const doc = await Subject.create(data);
  await recordAudit({ req, action: "subject.create", module: "academic", targetCollection: "subjects", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<Pick<SubjectDoc, "name" | "code" | "status" | "displayOrder">>) {
  const doc = await Subject.findById(id);
  if (!doc) throw ApiError.notFound("Subject not found");
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "subject.update", module: "academic", targetCollection: "subjects", targetId: id, before, after: doc.toObject() });
  return doc;
}

/**
 * Delete safety (Delete Safety spec): a Subject currently assigned to one
 * or more Courses (via CourseSubject) is never deleted outright — a coach
 * removing "বাংলা" from one course must never silently break every other
 * course that also uses it. Lectures are already unreachable without a
 * CourseSubject to hang off, so checking CourseSubject alone is sufficient.
 */
export async function remove(req: Request, id: string) {
  const doc = await Subject.findById(id);
  if (!doc) throw ApiError.notFound("Subject not found");
  const { CourseSubject } = await import("../courseSubjects/courseSubject.model");
  if (await CourseSubject.exists({ subjectId: id })) {
    throw ApiError.conflict("এই সাবজেক্টটি এক বা একাধিক কোর্সে যুক্ত আছে — আগে সব কোর্স থেকে সরিয়ে দিন।");
  }
  await doc.deleteOne();
  await recordAudit({ req, action: "subject.delete", module: "academic", targetCollection: "subjects", targetId: id, before: doc.toObject() });
}
