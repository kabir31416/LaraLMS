import { Request } from "express";
import { Guardian, GuardianDoc } from "./guardian.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";

export async function listByStudent(studentId: string): Promise<GuardianDoc[]> {
  return Guardian.find({ studentId }).sort({ isPrimary: -1, createdAt: 1 });
}

export async function getPrimary(studentId: string): Promise<GuardianDoc | null> {
  return Guardian.findOne({ studentId, isPrimary: true }) || Guardian.findOne({ studentId });
}

export async function create(req: Request, studentId: string, data: Pick<GuardianDoc, "name" | "relation" | "phone" | "occupation" | "isPrimary">) {
  if (data.isPrimary) await Guardian.updateMany({ studentId }, { $set: { isPrimary: false } });
  const doc = await Guardian.create({ ...data, studentId });
  await recordAudit({ req, action: "guardian.create", module: "students", targetCollection: "guardians", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<Pick<GuardianDoc, "name" | "relation" | "phone" | "occupation" | "isPrimary">>) {
  const doc = await Guardian.findById(id);
  if (!doc) throw ApiError.notFound("Guardian not found");
  const before = doc.toObject();
  if (patch.isPrimary) await Guardian.updateMany({ studentId: doc.studentId, _id: { $ne: doc._id } }, { $set: { isPrimary: false } });
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "guardian.update", module: "students", targetCollection: "guardians", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string) {
  const doc = await Guardian.findById(id);
  if (!doc) throw ApiError.notFound("Guardian not found");
  await doc.deleteOne();
  await recordAudit({ req, action: "guardian.delete", module: "students", targetCollection: "guardians", targetId: id, before: doc.toObject() });
}

/** Used internally by student.service when the Admission form's inline guardian fields are submitted. */
export async function upsertPrimaryFromInlineFields(
  req: Request,
  studentId: string,
  fields: { guardianName?: string; guardianRelation?: string; guardianMobile?: string },
): Promise<void> {
  if (!fields.guardianName && !fields.guardianMobile) return;
  const existing = await Guardian.findOne({ studentId, isPrimary: true });
  if (existing) {
    existing.name = fields.guardianName ?? existing.name;
    existing.relation = (fields.guardianRelation as GuardianDoc["relation"]) ?? existing.relation;
    existing.phone = fields.guardianMobile ?? existing.phone;
    await existing.save();
    return;
  }
  await Guardian.create({
    studentId,
    name: fields.guardianName || "—",
    relation: fields.guardianRelation || "অন্যান্য",
    phone: fields.guardianMobile || "",
    isPrimary: true,
  });
}
