import { Request } from "express";
import { Staff, StaffDoc } from "./staff.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";
import { toAsciiDigits } from "../../common/utils/digits";
import { assertSuperAdmin } from "../users/user.service";

/**
 * An "Admin" staff row backs a real password login — editing or removing one
 * (name/mobile/status swap, or deleting it outright) is as sensitive as
 * touching that login directly, so both are gated the same way
 * user.service.ts gates editing/resetting an existing Admin's User account:
 * only the original Super Admin, never any other Admin with plain
 * STAFF_MANAGE. Creating a NEW Admin is unaffected — this only guards an
 * EXISTING one.
 */

function isDuplicateKeyError(err: unknown): boolean {
  return !!(err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000);
}

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
  let doc: StaffDoc;
  try {
    doc = await Staff.create(payload);
  } catch (err) {
    // The pre-check above is a plain findOne — a genuine concurrent
    // request (e.g. a double-submitted create) can still race past it and
    // hit the unique index at insert time. Translate that into the same
    // clean conflict instead of letting a raw E11000 fall through to the
    // generic "A record with this value already exists" handler.
    if (isDuplicateKeyError(err)) throw ApiError.conflict(`Staff ID "${payload.staffId}" is already in use`);
    throw err;
  }
  await recordAudit({ req, action: "staff.create", module: "staff", targetCollection: "staff", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<StaffDoc>): Promise<StaffDoc> {
  const doc = await getById(id);
  // Covers both directions: editing an existing Admin, and trying to
  // promote a non-Admin staff member INTO "Admin" via this same edit —
  // both are gated the same way as touching an Admin's login directly.
  if (doc.staffType === "Admin" || patch.staffType === "Admin") assertSuperAdmin(req);
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
  if (doc.staffType === "Admin") assertSuperAdmin(req);

  // Phase 1 §4's missing-delete-guard finding, fixed: a director who still
  // directs at least one batch can't just vanish.
  const { Batch } = await import("../batches/batch.model");
  if (await Batch.exists({ directorIds: id })) {
    throw ApiError.conflict("This staff member still directs at least one batch — reassign it first");
  }

  const { User } = await import("../users/user.model");
  if (await User.exists({ linkedStaffId: id })) {
    throw ApiError.conflict("This staff member has a login account — remove it first");
  }

  await doc.deleteOne();
  await recordAudit({ req, action: "staff.delete", module: "staff", targetCollection: "staff", targetId: id, before: doc.toObject() });
}
