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

export async function create(req: Request, studentId: string, data: Pick<GuardianDoc, "name" | "relation" | "phone" | "occupation" | "address" | "isPrimary">) {
  if (data.isPrimary) await Guardian.updateMany({ studentId }, { $set: { isPrimary: false } });
  const doc = await Guardian.create({ ...data, studentId });
  await recordAudit({ req, action: "guardian.create", module: "students", targetCollection: "guardians", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<Pick<GuardianDoc, "name" | "relation" | "phone" | "occupation" | "address" | "isPrimary">>) {
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

/**
 * Used internally by student.service both from the Admission form's inline
 * guardian fields (Admin, includes guardianMobile) and from a student's own
 * self-update (Phase 4 — never includes guardianMobile, since that field is
 * admin-controlled; the `?? existing.phone` fallback below is what keeps a
 * student's self-edit from ever clearing it).
 */
export async function upsertPrimaryFromInlineFields(
  req: Request,
  studentId: string,
  fields: { guardianName?: string; guardianRelation?: string; guardianMobile?: string; guardianOccupation?: string; guardianAddress?: string },
): Promise<void> {
  if (!fields.guardianName && !fields.guardianMobile && !fields.guardianOccupation && !fields.guardianAddress && !fields.guardianRelation) return;
  const existing = await Guardian.findOne({ studentId, isPrimary: true });
  if (existing) {
    existing.name = fields.guardianName ?? existing.name;
    existing.relation = (fields.guardianRelation as GuardianDoc["relation"]) ?? existing.relation;
    existing.phone = fields.guardianMobile ?? existing.phone;
    existing.occupation = fields.guardianOccupation ?? existing.occupation;
    existing.address = fields.guardianAddress ?? existing.address;
    await existing.save();
    return;
  }
  // Guardian.phone is a required schema field (guardian.model.ts) — the
  // Excel Student Information Import spec (§5/§28) makes guardianMobile
  // optional, unlike the Admission form which always supplies it, so a row
  // with a guardian name but no guardian phone must not attempt to create a
  // Guardian record at all (it would otherwise fail Mongoose validation on
  // the empty required `phone`). The name/relation/occupation are simply
  // not saved until a phone is provided later via the normal edit flow.
  if (!fields.guardianMobile) return;
  await Guardian.create({
    studentId,
    name: fields.guardianName || "—",
    relation: fields.guardianRelation || "অন্যান্য",
    phone: fields.guardianMobile,
    occupation: fields.guardianOccupation,
    address: fields.guardianAddress,
    isPrimary: true,
  });
}
