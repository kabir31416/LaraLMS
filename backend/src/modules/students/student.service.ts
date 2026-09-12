import { Request } from "express";
import { Student, StudentDoc, ProfileCompletion } from "./student.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";
import { generateRegistrationId } from "../../common/utils/idGenerators";
import * as guardianService from "../guardians/guardian.service";

interface GuardianInline {
  guardianName?: string;
  guardianRelation?: string;
  guardianMobile?: string;
}

function computeFees(input: {
  feeType: StudentDoc["feeType"];
  totalCourseFee: number;
  admissionFee: number;
  monthlyFee: number;
  courseDuration: number;
  discount: number;
  paid: number;
}) {
  const isOneTime = input.feeType === "এককালীন";
  const totalFee = isOneTime
    ? input.totalCourseFee + input.admissionFee - input.discount
    : input.admissionFee + input.monthlyFee * input.courseDuration - input.discount;
  const due = totalFee - input.paid;
  return { totalFee, due };
}

const COMPLETION_FIELDS: (keyof StudentDoc)[] = ["dob", "gender", "institution", "address", "photoUrl"];

async function computeProfileCompletion(doc: StudentDoc): Promise<ProfileCompletion> {
  const missing: string[] = [];
  for (const field of COMPLETION_FIELDS) if (!doc[field]) missing.push(field);
  const guardian = await guardianService.getPrimary(String(doc._id));
  if (!guardian || !guardian.phone) missing.push("guardian");

  const total = COMPLETION_FIELDS.length + 1;
  const percent = Math.round(((total - missing.length) / total) * 100);
  return { status: missing.length === 0 ? "complete" : "incomplete", percent, missingFields: missing };
}

async function refreshProfileCompletion(doc: StudentDoc): Promise<StudentDoc> {
  doc.profileCompletion = await computeProfileCompletion(doc);
  await doc.save();
  return doc;
}

/**
 * Guardian lives in its own collection (Phase 1 §17), but the existing
 * frontend renders `student.guardianName` etc. directly — this flattens the
 * primary guardian back onto the response so nothing on the client needs to
 * change to read it. It's a read-time convenience, not a stored duplicate.
 */
async function withGuardian(doc: StudentDoc): Promise<Record<string, unknown>> {
  const guardian = await guardianService.getPrimary(String(doc._id));
  return {
    ...doc.toObject(),
    guardianName: guardian?.name,
    guardianRelation: guardian?.relation,
    guardianMobile: guardian?.phone,
  };
}

async function withGuardians(docs: StudentDoc[]): Promise<Record<string, unknown>[]> {
  const { Guardian } = await import("../guardians/guardian.model");
  const guardians = await Guardian.find({ studentId: { $in: docs.map((d) => d._id) } }).sort({ isPrimary: -1, createdAt: 1 });
  const byStudent = new Map<string, (typeof guardians)[number]>();
  for (const g of guardians) if (!byStudent.has(String(g.studentId))) byStudent.set(String(g.studentId), g);
  return docs.map((doc) => {
    const g = byStudent.get(String(doc._id));
    return { ...doc.toObject(), guardianName: g?.name, guardianRelation: g?.relation, guardianMobile: g?.phone };
  });
}

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { createdAt: -1 });
  const filter: Record<string, unknown> = {
    ...buildSearchFilter(req.query.search, ["name", "phone", "registrationId", "currentRollNumber"]),
  };
  if (req.query.course) filter.course = req.query.course;
  if (req.query.section) filter.section = req.query.section;
  if (req.query.profileStatus) filter["profileCompletion.status"] = req.query.profileStatus;
  if (req.query.batchId === "unassigned") filter.currentBatchId = { $exists: false };
  else if (req.query.batchId) filter.currentBatchId = req.query.batchId;
  if (req.query.dueOnly === "true") filter.due = { $gt: 0 };

  if (req.query.directorId) {
    const { Batch } = await import("../batches/batch.model");
    const batchIds = await Batch.find({ directorId: req.query.directorId }).distinct("_id");
    filter.currentBatchId = { $in: batchIds };
  }

  const [docs, total] = await Promise.all([
    Student.find(filter).sort(sort).skip(skip).limit(limit),
    Student.countDocuments(filter),
  ]);
  const items = await withGuardians(docs);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string): Promise<Record<string, unknown>> {
  const doc = await Student.findById(id);
  if (!doc) throw ApiError.notFound("Student not found");
  return withGuardian(doc);
}

async function getDocOrThrow(id: string): Promise<StudentDoc> {
  const doc = await Student.findById(id);
  if (!doc) throw ApiError.notFound("Student not found");
  return doc;
}

/** Roll + Name + Phone only — Phase 1 §2/§13. */
export async function quickCreate(req: Request, data: { rollNumber: string; name: string; phone: string }): Promise<Record<string, unknown>> {
  const registrationId = await generateRegistrationId();
  const doc = await Student.create({
    registrationId,
    currentRollNumber: data.rollNumber,
    name: data.name,
    phone: data.phone,
    subjects: [],
    admissionDate: new Date().toISOString().slice(0, 10),
    admissionType: "নতুন",
    feeType: "এককালীন",
    profileCompletion: { status: "incomplete", percent: 0, missingFields: COMPLETION_FIELDS.concat("guardian" as never) },
  });
  await recordAudit({ req, action: "student.quick-create", module: "students", targetCollection: "students", targetId: String(doc._id), after: doc.toObject() });
  return withGuardian(doc);
}

export async function create(req: Request, body: Record<string, unknown> & GuardianInline): Promise<Record<string, unknown>> {
  const registrationId = await generateRegistrationId();
  const fees = computeFees({
    feeType: (body.feeType as StudentDoc["feeType"]) || "এককালীন",
    totalCourseFee: Number(body.totalCourseFee) || 0,
    admissionFee: Number(body.admissionFee) || 0,
    monthlyFee: Number(body.monthlyFee) || 0,
    courseDuration: Number(body.courseDuration) || 0,
    discount: Number(body.discount) || 0,
    paid: Number(body.paid) || 0,
  });

  const doc = await Student.create({
    ...body,
    registrationId,
    currentRollNumber: body.rollNumber || undefined,
    admissionDate: body.admissionDate || new Date().toISOString().slice(0, 10),
    ...fees,
    paid: Number(body.paid) || 0,
  });

  await guardianService.upsertPrimaryFromInlineFields(req, String(doc._id), body);
  await refreshProfileCompletion(doc);

  await recordAudit({ req, action: "student.create", module: "students", targetCollection: "students", targetId: String(doc._id), after: doc.toObject() });
  return withGuardian(doc);
}

async function applyPatch(req: Request, doc: StudentDoc, patch: Record<string, unknown> & GuardianInline) {
  const before = doc.toObject();

  const feeFieldsTouched = ["feeType", "totalCourseFee", "admissionFee", "monthlyFee", "courseDuration", "discount", "paid"].some((k) => k in patch);
  Object.assign(doc, patch);
  if (feeFieldsTouched) {
    const fees = computeFees({
      feeType: doc.feeType,
      totalCourseFee: doc.totalCourseFee,
      admissionFee: doc.admissionFee,
      monthlyFee: doc.monthlyFee,
      courseDuration: doc.courseDuration,
      discount: doc.discount,
      paid: doc.paid,
    });
    doc.totalFee = fees.totalFee;
    doc.due = fees.due;
  }
  await doc.save();

  if (patch.guardianName || patch.guardianMobile || patch.guardianRelation) {
    await guardianService.upsertPrimaryFromInlineFields(req, String(doc._id), patch);
  }
  await refreshProfileCompletion(doc);

  return before;
}

export async function update(req: Request, id: string, patch: Record<string, unknown> & GuardianInline): Promise<Record<string, unknown>> {
  const doc = await getDocOrThrow(id);
  const before = await applyPatch(req, doc, patch);
  await recordAudit({ req, action: "student.update", module: "students", targetCollection: "students", targetId: id, before, after: doc.toObject() });
  return withGuardian(doc);
}

/** Student-editable subset only — the allow-list already lives in the zod schema, this just applies it. */
export async function updateSelf(req: Request, id: string, patch: Record<string, unknown> & GuardianInline): Promise<Record<string, unknown>> {
  const doc = await getDocOrThrow(id);
  const before = await applyPatch(req, doc, patch);
  await recordAudit({ req, action: "student.update-self", module: "students", targetCollection: "students", targetId: id, before, after: doc.toObject() });
  return withGuardian(doc);
}

/** Admin-only, separate from the general update — Phase 1 §13. */
export async function updateRoll(req: Request, id: string, rollNumber: string): Promise<StudentDoc> {
  const doc = await getDocOrThrow(id);
  if (doc.currentBatchId) {
    // Re-use the same scope check enrollment/transfer use, so a manual roll
    // edit can never create the exact collision those flows prevent.
    const { getSettings } = await import("../settings/settings.service");
    const settings = await getSettings();
    const scopeFilter: Record<string, unknown> = { currentRollNumber: rollNumber, _id: { $ne: id } };
    if (settings.rollNumberScope !== "global") scopeFilter.currentBatchId = doc.currentBatchId;
    const clash = await Student.findOne(scopeFilter);
    if (clash) throw ApiError.conflict(`Roll number "${rollNumber}" is already in use`);
  }
  const before = doc.toObject();
  doc.currentRollNumber = rollNumber;
  await doc.save();
  await recordAudit({ req, action: "student.update-roll", module: "students", targetCollection: "students", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function updateStatus(req: Request, id: string, status: StudentDoc["status"]): Promise<StudentDoc> {
  const doc = await getDocOrThrow(id);
  const before = doc.toObject();
  doc.status = status;
  await doc.save();
  await recordAudit({ req, action: "student.update-status", module: "students", targetCollection: "students", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string): Promise<void> {
  const doc = await getDocOrThrow(id);
  await doc.deleteOne();
  await recordAudit({ req, action: "student.delete", module: "students", targetCollection: "students", targetId: id, before: doc.toObject() });
}
