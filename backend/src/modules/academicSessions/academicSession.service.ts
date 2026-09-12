import { Request } from "express";
import { AcademicSession, AcademicSessionDoc } from "./academicSession.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { startDate: -1 });
  const filter = buildSearchFilter(req.query.search, ["name"]);
  const [items, total] = await Promise.all([
    AcademicSession.find(filter).sort(sort).skip(skip).limit(limit),
    AcademicSession.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string): Promise<AcademicSessionDoc> {
  const doc = await AcademicSession.findById(id);
  if (!doc) throw ApiError.notFound("Session not found");
  return doc;
}

export async function create(req: Request, data: Pick<AcademicSessionDoc, "name" | "startDate" | "endDate">) {
  const doc = await AcademicSession.create(data);
  await recordAudit({ req, action: "academic-session.create", module: "academic", targetCollection: "academicsessions", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<Pick<AcademicSessionDoc, "name" | "startDate" | "endDate">>) {
  const doc = await getById(id);
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "academic-session.update", module: "academic", targetCollection: "academicsessions", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string) {
  const doc = await getById(id);
  // A session with courses under it shouldn't vanish silently — Phase 1 §4's "no delete guard" finding, fixed here.
  const { Course } = await import("../courses/course.model");
  const inUse = await Course.exists({ sessionId: id });
  if (inUse) throw ApiError.conflict("This session has courses under it — remove or reassign them first");
  await doc.deleteOne();
  await recordAudit({ req, action: "academic-session.delete", module: "academic", targetCollection: "academicsessions", targetId: id, before: doc.toObject() });
}
