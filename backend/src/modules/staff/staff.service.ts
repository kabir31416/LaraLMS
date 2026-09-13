import { Request } from "express";
import { Staff, StaffDoc } from "./staff.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";
import { toAsciiDigits } from "../../common/utils/digits";

/**
 * Normalizes and uniqueness-checks a staffId before it's written, the same
 * way applyRollNumberIfPresent does for a Student's Roll Number — this is
 * the credential auth.service.ts's staffLogin matches against, so a
 * silent collision here would surface as a raw duplicate-key error at
 * save time instead of a clean message.
 */
async function normalizeAndCheckStaffId(staffId: string, excludeId?: string): Promise<string> {
  const normalized = toAsciiDigits(staffId).trim();
  if (!normalized) throw ApiError.badRequest("Staff ID cannot be empty");
  const clash = await Staff.findOne({ staffId: normalized, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
  if (clash) throw ApiError.conflict(`Staff ID "${normalized}" is already in use`);
  return normalized;
}

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { createdAt: -1 });
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["name", "phone", "email"]) };
  if (req.query.staffType) filter.staffType = req.query.staffType;
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Staff.find(filter).sort(sort).skip(skip).limit(limit),
    Staff.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string): Promise<StaffDoc> {
  const doc = await Staff.findById(id);
  if (!doc) throw ApiError.notFound("Staff not found");
  return doc;
}

/** Active Batch Directors — used to populate the director picker on Batch forms. */
export async function listDirectors(): Promise<StaffDoc[]> {
  return Staff.find({ staffType: "Batch Director", status: "সক্রিয়" }).sort({ name: 1 });
}

export async function create(req: Request, data: Partial<StaffDoc>): Promise<StaffDoc> {
  const payload = { ...data };
  if (payload.staffId) payload.staffId = await normalizeAndCheckStaffId(payload.staffId);
  const doc = await Staff.create(payload);
  await recordAudit({ req, action: "staff.create", module: "staff", targetCollection: "staff", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<StaffDoc>): Promise<StaffDoc> {
  const doc = await getById(id);
  const before = doc.toObject();
  if (typeof patch.staffId === "string" && patch.staffId.trim() !== (doc.staffId ?? "")) {
    patch = { ...patch, staffId: await normalizeAndCheckStaffId(patch.staffId, id) };
  }
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "staff.update", module: "staff", targetCollection: "staff", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string): Promise<void> {
  const doc = await getById(id);

  // Phase 1 §4's missing-delete-guard finding, fixed: a director who still
  // directs at least one batch can't just vanish.
  const { Batch } = await import("../batches/batch.model");
  if (await Batch.exists({ directorId: id })) {
    throw ApiError.conflict("This staff member still directs at least one batch — reassign it first");
  }

  const { User } = await import("../users/user.model");
  if (await User.exists({ linkedStaffId: id })) {
    throw ApiError.conflict("This staff member has a login account — remove it first");
  }

  await doc.deleteOne();
  await recordAudit({ req, action: "staff.delete", module: "staff", targetCollection: "staff", targetId: id, before: doc.toObject() });
}
