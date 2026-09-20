import { Request } from "express";
import { Types } from "mongoose";
import { Student, StudentDoc, ProfileCompletion } from "./student.model";
import { Course } from "../courses/course.model";
import { getSettings } from "../settings/settings.service";
import { PERMISSIONS } from "../rbac/permissions";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";
import { generateRegistrationId } from "../../common/utils/idGenerators";
import { toAsciiDigits } from "../../common/utils/digits";
import { pageIdsByRoll, reorderByIds } from "../../common/utils/rollSort";
import * as guardianService from "../guardians/guardian.service";
import { uploadStudentPhoto, deleteCloudinaryAsset } from "../../common/utils/cloudinaryService";

/**
 * `hscInstitution` mirrors HscInstitution master data by name, same
 * established convention as Course/MaterialType/PaymentMethod (Bulk Student
 * Upload spec §5-§8) — never a ref, so a later rename of the master record
 * never rewrites an already-admitted student's history. Called from both
 * create() and applyPatch() (used by both the normal admin edit and the
 * student's own self-edit), so every entry point that can set this field —
 * including bulk-import's approveRow(), which calls create() below — ends
 * up registering/reusing the same master-data record. Mutates the body/patch
 * in place so the canonical (first-registered) spelling is what actually
 * gets stored on the Student, not whatever casing/spacing the caller typed.
 */
async function syncHscInstitution(body: Record<string, unknown>): Promise<void> {
  if (typeof body.hscInstitution === "string" && body.hscInstitution.trim()) {
    const hscInstitutionService = await import("../hscInstitutions/hscInstitution.service");
    const institution = await hscInstitutionService.getOrCreateByName(body.hscInstitution);
    body.hscInstitution = institution.name;
  }
}

/**
 * No student-create/update path here provisions a Portal login — there is
 * no login account for a student at all. The Student Portal authenticates
 * by matching phone + Roll Number directly against the live Student record
 * on every login attempt (auth.service.ts's studentLogin, a pure read-only
 * lookup), so nothing here needs to keep a separate account or password in
 * sync with this collection.
 */
interface GuardianInline {
  guardianName?: string;
  guardianRelation?: string;
  guardianMobile?: string;
  guardianOccupation?: string;
  guardianAddress?: string;
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

async function resolveCourseOrThrow(courseId: string) {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.badRequest("Invalid course");
  return course;
}

/** The student-editable subset (Phase 4) — dob/gender/institution/address/guardianMobile are admin-controlled and always present after admission, so they'd make "complete" trivially true and are deliberately excluded here. */
const COMPLETION_FIELDS: (keyof StudentDoc)[] = [
  "photoUrl",
  "presentAddress",
  "permanentAddress",
  "hscInstitution",
  "sscInstitution",
];

async function computeProfileCompletion(doc: StudentDoc): Promise<ProfileCompletion> {
  const missing: string[] = [];
  for (const field of COMPLETION_FIELDS) if (!doc[field]) missing.push(field);
  const guardian = await guardianService.getPrimary(String(doc._id));
  if (!guardian || !guardian.name || guardian.name === "—") missing.push("guardianName");

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
    guardianOccupation: guardian?.occupation,
    guardianAddress: guardian?.address,
  };
}

async function withGuardians(docs: StudentDoc[]): Promise<Record<string, unknown>[]> {
  const { Guardian } = await import("../guardians/guardian.model");
  const guardians = await Guardian.find({ studentId: { $in: docs.map((d) => d._id) } }).sort({ isPrimary: -1, createdAt: 1 });
  const byStudent = new Map<string, (typeof guardians)[number]>();
  for (const g of guardians) if (!byStudent.has(String(g.studentId))) byStudent.set(String(g.studentId), g);
  return docs.map((doc) => {
    const g = byStudent.get(String(doc._id));
    return {
      ...doc.toObject(),
      guardianName: g?.name,
      guardianRelation: g?.relation,
      guardianMobile: g?.phone,
      guardianOccupation: g?.occupation,
      guardianAddress: g?.address,
    };
  });
}

/**
 * Shared scope/filter logic for both list() and admissionRollStats() — the
 * "which rows is this caller even allowed to see" part (course/section/
 * batch/director scope), kept separate from search and from the
 * admission-roll status bucket so admissionRollStats can compute Total/
 * Added/Missing against the same base filter a list() call is using
 * (Admission Result feature §11).
 */
/** yyyy-mm-dd -> "-MM-DD" (2-digit) suffix for a same-day-and-month-any-year `dob` match — see the birthdayToday filter below. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The Student List's free-text search box must find a student by name,
 * roll, System ID, or mobile (all plain Student fields — buildSearchFilter
 * handles those directly), and ALSO by guardian mobile (Coaching Reg No /
 * Roll vs System ID spec §6) — guardianMobile lives on the separate
 * Guardian collection (Phase 1 §17), not on Student, so it can't join the
 * same single-collection $or the way the others do. Resolved as one extra
 * OR-branch (`_id: {$in: ...}`) rather than merged into `buildSearchFilter`
 * itself, so that helper stays a generic single-collection utility other
 * modules can keep using unchanged.
 */
async function buildSearchFilterWithGuardian(search: unknown): Promise<Record<string, unknown>> {
  const base = buildSearchFilter(search, ["name", "phone", "registrationId", "currentRollNumber", "admissionRoll"]);
  if (typeof search !== "string" || !search.trim()) return base;
  const { Guardian } = await import("../guardians/guardian.model");
  const regex = new RegExp(escapeRegex(search.trim()), "i");
  const guardianStudentIds = await Guardian.find({ phone: regex }).distinct("studentId");
  if (guardianStudentIds.length === 0) return base;
  const existingOr = (base.$or as Record<string, unknown>[] | undefined) ?? [];
  return { $or: [...existingOr, { _id: { $in: guardianStudentIds } }] };
}

async function buildStudentFilter(req: Request): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = {};
  // Batched "these exact students" lookup (comma-separated _ids) — backs
  // read views that already know which specific students they need (e.g.
  // Fee Management's payment-history rows) and must resolve them in one
  // query instead of one `Student.findById` per row.
  if (typeof req.query.ids === "string" && req.query.ids.trim()) {
    const ids = req.query.ids.split(",").map((s) => s.trim()).filter((s) => Types.ObjectId.isValid(s));
    filter._id = { $in: ids.map((id) => new Types.ObjectId(id)) };
  }
  if (req.query.course) filter.course = req.query.course;
  // The real Course reference (student.courseId -> Course._id), distinct
  // from `course` above (a denormalized free-text name) — backs Batch
  // Assignment's "eligible students" query, which must scope to the same
  // Course as the Batch being assigned to (Batch.courseId), not every
  // unassigned student regardless of course.
  if (typeof req.query.courseId === "string" && Types.ObjectId.isValid(req.query.courseId)) {
    filter.courseId = new Types.ObjectId(req.query.courseId);
  }
  if (req.query.section) filter.section = req.query.section;
  if (req.query.profileStatus) filter["profileCompletion.status"] = req.query.profileStatus;
  // "Unassigned" must match both a genuinely absent currentBatchId (the
  // normal case — see enrollment.service.ts's withdraw, which $unsets it)
  // AND one explicitly stored as null (a document written outside this
  // app's own code paths, e.g. a direct import/migration, can have the key
  // present with a null value) — {$exists:false} alone only matches the
  // first case and would silently drop the second out of Batch Assignment's
  // "available students" list even though the student has no batch. A plain
  // equality match against `null` covers both in MongoDB (it matches a
  // missing field as well as an explicit null) without needing `$or`, which
  // would otherwise collide with — and get overwritten by — the search
  // filter's own top-level `$or` below (Object.assign, not a merge).
  // ROOT CAUSE of "Batch Details / Batch Assignment misses students that
  // definitely exist": list()'s default (no explicit ?sortBy=) path runs
  // this filter through pageIdsByRoll's aggregation ($match), not
  // Model.find() — Mongoose only auto-casts query values to their schema
  // type for find()-family calls, never for aggregate() pipeline stages.
  // `req.query.batchId` is always a plain string (an Express query param),
  // so an uncast `{currentBatchId: "<hex string>"}` in a $match compares a
  // BSON string against the real BSON ObjectId stored on every Student
  // document — which never matches, for any batch, every time this path is
  // hit (i.e. every batch-scoped Batch Details / Batch Assignment request,
  // since none of them pass sortBy). Casting explicitly here fixes both the
  // aggregate() path and the find() path (which already worked, since it
  // casts on its own) with one change, at the one place this filter is
  // built for every caller (list(), exportList(), admissionRollStats()).
  if (req.query.batchId === "unassigned") filter.currentBatchId = null;
  else if (typeof req.query.batchId === "string" && Types.ObjectId.isValid(req.query.batchId)) {
    filter.currentBatchId = new Types.ObjectId(req.query.batchId);
  }

  // dueStatus is the 3-state successor to the older boolean dueOnly (kept for
  // backward compatibility — nothing in this codebase currently sends it,
  // but it's cheap to keep honoring).
  if (req.query.dueStatus === "has" || req.query.dueOnly === "true") filter.due = { $gt: 0 };
  else if (req.query.dueStatus === "none") filter.due = { $lte: 0 };

  // Case/whitespace-insensitive exact match against the HSC institution's
  // canonical master-data name — covers both newly-synced records (see
  // syncHscInstitution) and any pre-existing free-text spelling variance.
  if (typeof req.query.hscInstitution === "string" && req.query.hscInstitution.trim()) {
    filter.hscInstitution = new RegExp(`^${escapeRegex(req.query.hscInstitution.trim())}$`, "i");
  }

  // division/district are free text (Excel Student Information Import §5 —
  // no separate master-data collection for Bangladesh's address hierarchy),
  // so a case-insensitive substring match tolerates minor spelling/spacing
  // variance the way an exact dropdown match couldn't.
  if (typeof req.query.division === "string" && req.query.division.trim()) {
    filter.division = new RegExp(escapeRegex(req.query.division.trim()), "i");
  }
  if (typeof req.query.district === "string" && req.query.district.trim()) {
    filter.district = new RegExp(escapeRegex(req.query.district.trim()), "i");
  }

  if (typeof req.query.gender === "string" && req.query.gender.trim()) {
    filter.gender = req.query.gender;
  }

  // guardianMobile lives on the separate Guardian collection, not on
  // Student itself (Phase 1 §17) — resolve it to a set of studentIds first,
  // the same cross-collection pattern directorId below already uses via
  // Batch. An empty match set still filters correctly: Mongo's $in: []
  // simply returns zero documents.
  if (typeof req.query.guardianMobile === "string" && req.query.guardianMobile.trim()) {
    const { Guardian } = await import("../guardians/guardian.model");
    const studentIds = await Guardian.find({ phone: new RegExp(escapeRegex(req.query.guardianMobile.trim()), "i") }).distinct("studentId");
    filter._id = { $in: studentIds };
  }

  // Same day-and-month as today, any birth year — dob is stored as a plain
  // "yyyy-mm-dd" string (student.model.ts), so this is a simple suffix
  // match, not a date-arithmetic query.
  if (req.query.birthdayToday === "true") {
    const today = new Date();
    filter.dob = new RegExp(`-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}$`);
  }

  if (req.query.directorId) {
    const { Batch } = await import("../batches/batch.model");
    const batchIds = await Batch.find({ directorId: req.query.directorId }).distinct("_id");
    filter.currentBatchId = { $in: batchIds };
  }

  if (typeof req.query.feeType === "string" && req.query.feeType.trim()) {
    filter.feeType = req.query.feeType;
  }
  return filter;
}

export async function list(req: Request) {
  // Default sort is Roll Number ascending (numeric-aware) — never Registration
  // ID, never MongoDB insertion order. A caller may still explicitly ask for
  // a different field via ?sortBy=&sortOrder=, which parsePagination handles
  // as before; only the *default* (no sortBy given) changes here.
  const explicitSort = typeof req.query.sortBy === "string" && req.query.sortBy.trim();
  const { page, limit, skip, sort } = parsePagination(req, { createdAt: -1 });
  const filter = await buildStudentFilter(req);

  // "Missing" also matches a completely absent field, not just an empty
  // string — Mongo's $in:[null] quirk covers both without needing a second
  // $or that would collide with buildSearchFilter's own $or below.
  if (req.query.admissionRollStatus === "added") filter.admissionRoll = { $exists: true, $ne: "" };
  else if (req.query.admissionRollStatus === "missing") filter.admissionRoll = { $in: [null, ""] };

  Object.assign(filter, await buildSearchFilterWithGuardian(req.query.search));

  let docs: StudentDoc[];
  let total: number;
  if (explicitSort) {
    [docs, total] = await Promise.all([
      Student.find(filter).sort(sort).skip(skip).limit(limit),
      Student.countDocuments(filter),
    ]);
  } else {
    const order = req.query.sortOrder === "desc" ? -1 : 1;
    const [orderedIds, count] = await Promise.all([
      pageIdsByRoll(Student, filter, order, skip, limit),
      Student.countDocuments(filter),
    ]);
    const fetched = await Student.find({ _id: { $in: orderedIds } });
    docs = reorderByIds(fetched, orderedIds);
    total = count;
  }
  const items = await withGuardians(docs);
  return { items, meta: buildMeta(page, limit, total) };
}

/**
 * Backs the Student List's Print/Export actions — the same filter/search
 * logic as list() (so "print/export respects every active filter" holds by
 * construction, not by keeping two filter-building implementations in
 * sync), but returns every matching row in one shot instead of one page, so
 * "export exactly the 75 filtered students, not all 1000" is possible
 * without the frontend ever fetching the full unfiltered collection itself.
 * Capped defensively rather than truly unbounded — a print/export click is
 * still one request/response cycle, not a background job.
 */
const EXPORT_MAX_ROWS = 2000;

export async function exportList(req: Request): Promise<Record<string, unknown>[]> {
  const filter = await buildStudentFilter(req);
  Object.assign(filter, await buildSearchFilterWithGuardian(req.query.search));

  // Roll ascending (numeric-aware), same default as list() — a print/export
  // must show students in the same order the on-screen list does.
  const orderedIds = await pageIdsByRoll(Student, filter, 1, 0, EXPORT_MAX_ROWS);
  const fetched = await Student.find({ _id: { $in: orderedIds } });
  const docs = reorderByIds(fetched, orderedIds);
  const withG = await withGuardians(docs);

  const batchIds = [...new Set(docs.map((d) => d.currentBatchId).filter(Boolean).map((id) => String(id)))];
  const { Batch } = await import("../batches/batch.model");
  const batches = batchIds.length ? await Batch.find({ _id: { $in: batchIds } }).select("name") : [];
  const batchNameById = new Map(batches.map((b) => [String(b._id), b.name]));

  return withG.map((s) => {
    const row = s as Record<string, unknown> & { currentBatchId?: unknown };
    return {
      id: String(row._id),
      name: row.name,
      rollNumber: row.currentRollNumber,
      registrationId: row.registrationId,
      phone: row.phone,
      guardianMobile: row.guardianMobile,
      dob: row.dob,
      course: row.course,
      batchName: row.currentBatchId ? batchNameById.get(String(row.currentBatchId)) : undefined,
      hscInstitution: row.hscInstitution,
      due: row.due,
      status: row.status,
    };
  });
}

/** Total/Added/Missing counts for the Admission Result page's summary cards — always the full three-way breakdown of whatever batch/course/director scope is selected, independent of any admissionRollStatus filter applied to the list itself (Admission Result feature §11). */
/**
 * Admission Result feature is gated for Admin by its own dedicated
 * permission (PERMISSIONS.ADMISSION_RESULTS_MANAGE) on top of the broad
 * STUDENTS_READ/STUDENTS_UPDATE the route itself accepts — an Admin can be
 * individually denied this one permission (User.deniedPermissions) without
 * touching STUDENTS_READ/STUDENTS_UPDATE, which every other Student List/
 * Profile page still needs. A Batch Director's own scoped permission
 * (STUDENTS_READ_OWN_BATCH / STUDENTS_MANAGE_ADMISSION_ROLL_OWN_BATCH) is
 * a completely separate path and is never affected by this check.
 */
function assertAdmissionResultAccess(req: Request, broadPermission: string): void {
  const perms = req.user!.permissions;
  const hasBroadAccess = perms.includes("*") || perms.includes(broadPermission);
  if (!hasBroadAccess) return; // batch-director-scoped caller — unaffected, existing behavior
  const hasAdmissionResultAccess = perms.includes("*") || perms.includes(PERMISSIONS.ADMISSION_RESULTS_MANAGE);
  if (!hasAdmissionResultAccess) throw ApiError.forbidden("Admission Result access has been disabled for this account.");
}

export async function admissionRollStats(req: Request): Promise<{ total: number; added: number; missing: number }> {
  assertAdmissionResultAccess(req, PERMISSIONS.STUDENTS_READ);
  const filter = await buildStudentFilter(req);
  const [total, added] = await Promise.all([
    Student.countDocuments(filter),
    Student.countDocuments({ ...filter, admissionRoll: { $exists: true, $ne: "" } }),
  ]);
  return { total, added, missing: total - added };
}

/**
 * Fee Management's due-list summary cards (মোট/প্যাকেজ/মাসিক বকেয়া) — a
 * global aggregate across every student with a due balance, computed once in
 * the database instead of the frontend loading the entire due-student
 * population just to sum three numbers client-side. Honors the exact same
 * filter/search a caller's due-list fetch is using, same reasoning as
 * admissionRollStats above.
 */
export async function dueStats(req: Request): Promise<{ totalDue: number; packageDue: number; monthlyDue: number }> {
  const filter = await buildStudentFilter(req);
  Object.assign(filter, await buildSearchFilterWithGuardian(req.query.search));
  const [row] = await Student.aggregate<{ totalDue: number; packageDue: number; monthlyDue: number }>([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalDue: { $sum: "$due" },
        packageDue: { $sum: { $cond: [{ $eq: ["$feeType", "এককালীন"] }, "$due", 0] } },
        monthlyDue: { $sum: { $cond: [{ $eq: ["$feeType", "মাসিক"] }, "$due", 0] } },
      },
    },
  ]);
  return row ? { totalDue: row.totalDue, packageDue: row.packageDue, monthlyDue: row.monthlyDue } : { totalDue: 0, packageDue: 0, monthlyDue: 0 };
}

/**
 * One student-count per Batch, in a single aggregation — backs Batches.tsx's
 * per-row roster count without either an N-requests-per-batch waterfall or
 * filtering StudentContext's own (deliberately capped) global list, which
 * silently undercounts once total students exceed that cap.
 */
export async function batchStudentCounts(): Promise<Record<string, number>> {
  const rows = await Student.aggregate<{ _id: unknown; count: number }>([
    { $match: { currentBatchId: { $exists: true } } },
    { $group: { _id: "$currentBatchId", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
}

/**
 * Admission Result feature — the official admission-test roll, editable by
 * Admin (any student) or a Batch Director (only students in a batch they
 * direct). Authorization is enforced here, at the service layer, exactly
 * like exam.service.ts's assertCanActOnBatch — never left to the frontend
 * hiding a batch selector.
 */
export async function updateAdmissionRoll(req: Request, id: string, rawAdmissionRoll: string): Promise<Record<string, unknown>> {
  const doc = await getDocOrThrow(id);
  assertAdmissionResultAccess(req, PERMISSIONS.STUDENTS_UPDATE);

  const perms = req.user!.permissions;
  const hasBroadAccess = perms.includes("*") || perms.includes(PERMISSIONS.STUDENTS_UPDATE);
  if (!hasBroadAccess) {
    if (!req.user!.staffId || !doc.currentBatchId) {
      throw ApiError.forbidden("You do not have permission to access this student.");
    }
    const { Batch } = await import("../batches/batch.model");
    const batch = await Batch.findById(doc.currentBatchId).select("directorId");
    if (!batch || String(batch.directorId ?? "") !== req.user!.staffId) {
      throw ApiError.forbidden("You do not have permission to access this student.");
    }
  }

  const admissionRoll = toAsciiDigits(rawAdmissionRoll).trim();
  if (!/^\d+$/.test(admissionRoll)) {
    throw ApiError.badRequest("Admission roll must contain digits only.");
  }

  // Scoped uniqueness — see student.model.ts's index comment: an official
  // admission-test roll only needs to be unique within one admission cycle
  // (the student's Course's own AcademicSession), not globally, since every
  // year's exam restarts its own numbering from scratch.
  const clashFilter: Record<string, unknown> = { admissionRoll, _id: { $ne: doc._id } };
  if (doc.courseId) {
    const course = await Course.findById(doc.courseId).select("sessionId");
    if (course?.sessionId) {
      const sisterCourseIds = await Course.find({ sessionId: course.sessionId }).distinct("_id");
      clashFilter.courseId = { $in: sisterCourseIds };
    }
  }
  const clash = await Student.findOne(clashFilter);
  if (clash) {
    throw ApiError.conflict(`Admission roll "${admissionRoll}" is already assigned to another student.`);
  }

  const before = doc.toObject();
  doc.admissionRoll = admissionRoll;
  await doc.save();
  await recordAudit({
    req,
    action: "student.update-admission-roll",
    module: "students",
    targetCollection: "students",
    targetId: id,
    before,
    after: doc.toObject(),
  });
  return withGuardian(doc);
}

export async function getById(id: string): Promise<Record<string, unknown>> {
  const doc = await Student.findById(id);
  if (!doc) throw ApiError.notFound("Student not found");
  return withGuardian(doc);
}

/**
 * Self-service "my profile" for the Student Portal (Phase 3, Module 27).
 * A student holds neither STUDENTS_READ nor BATCHES_READ_OWN / STAFF_MANAGE,
 * so the frontend can't resolve its own batch/director the way admin/director
 * screens do (via the full Batch/Staff list contexts) — this denormalizes
 * both onto the response, the same read-time-join pattern withGuardian()
 * already uses, so the student portal needs exactly one authorized call.
 */
export async function getMyProfile(req: Request): Promise<Record<string, unknown>> {
  const studentId = req.user?.studentId;
  if (!studentId) throw ApiError.forbidden("No linked student record");
  const doc = await getDocOrThrow(studentId);
  const withG = await withGuardian(doc);

  let batch: Record<string, unknown> | null = null;
  let director: Record<string, unknown> | null = null;
  if (doc.currentBatchId) {
    const { Batch } = await import("../batches/batch.model");
    const batchDoc = await Batch.findById(doc.currentBatchId);
    if (batchDoc) {
      batch = {
        id: String(batchDoc._id),
        name: batchDoc.name,
        batchTime: batchDoc.batchTime,
        roomNumber: batchDoc.roomNumber,
        days: batchDoc.days,
      };
      if (batchDoc.directorId) {
        const { Staff } = await import("../staff/staff.model");
        const staffDoc = await Staff.findById(batchDoc.directorId);
        if (staffDoc) director = { id: String(staffDoc._id), name: staffDoc.name };
      }
    }
  }

  return { ...withG, batch, director };
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
    profileCompletion: { status: "incomplete", percent: 0, missingFields: COMPLETION_FIELDS.concat("guardianName" as never) },
  });
  await recordAudit({ req, action: "student.quick-create", module: "students", targetCollection: "students", targetId: String(doc._id), after: doc.toObject() });
  return withGuardian(doc);
}

/**
 * Admission (Phase 4): only name/phone/dob/rollNumber/courseId/guardianMobile
 * are required (enforced by createStudentSchema) — everything else, the
 * student completes later via the Portal. Course Fee and Admission Fee are
 * never taken from the client: totalCourseFee always comes from the
 * selected Course's own `fee` (a one-time snapshot — later Course.fee edits
 * in Settings never rewrite this student's history) and admissionFee always
 * comes from Settings.admissionFeeBdt at the moment of admission (a
 * snapshot too — see student.model's `admissionFee`, Settings §6/§24). If an
 * amount was paid at admission time, it's recorded as a real Payment
 * (source: "admission") through the existing Fee Management pipeline rather
 * than just baked into this Student document — so it shows up immediately
 * in Payment History/Fee Management, and a receipt number is generated
 * exactly the way every other payment gets one.
 */
export async function create(req: Request, body: Record<string, unknown> & GuardianInline): Promise<Record<string, unknown>> {
  const course = await resolveCourseOrThrow(String(body.courseId));
  const settings = await getSettings();
  const admissionFee = settings.admissionFeeBdt;
  const totalCourseFee = course.fee;
  const discount = Number(body.discount) || 0;
  const feeType = (body.feeType as StudentDoc["feeType"]) || "এককালীন";
  const fees = computeFees({
    feeType,
    totalCourseFee,
    admissionFee,
    monthlyFee: Number(body.monthlyFee) || 0,
    courseDuration: Number(body.courseDuration) || 0,
    discount,
    paid: 0, // the admission-time payment (if any) is applied below through payment.service, never baked in directly
  });

  // registrationId is ALWAYS system-generated — a Student's permanent ID is
  // never taken from Excel or any other caller-supplied value, for admission
  // and bulk import alike. What Excel calls "Coaching Reg No" is the
  // coaching center's own roll/registration value and is stored as
  // currentRollNumber below instead (see body.rollNumber).
  const registrationId = await generateRegistrationId();
  const { paid: _paid, paymentMethod, ...rest } = body as Record<string, unknown>;
  await syncHscInstitution(rest);
  const doc = await Student.create({
    ...rest,
    registrationId,
    courseId: course._id,
    course: course.name,
    currentRollNumber: body.rollNumber || undefined,
    admissionDate: body.admissionDate || new Date().toISOString().slice(0, 10),
    feeType,
    discount,
    totalCourseFee,
    admissionFee,
    ...fees,
    paid: 0,
  });

  await guardianService.upsertPrimaryFromInlineFields(req, String(doc._id), body);
  await refreshProfileCompletion(doc);

  await recordAudit({ req, action: "student.create", module: "students", targetCollection: "students", targetId: String(doc._id), after: doc.toObject() });

  const amountPaid = Number(body.paid) || 0;
  if (amountPaid > 0) {
    const paymentService = await import("../payments/payment.service");
    await paymentService.create(req, {
      studentId: String(doc._id),
      date: doc.admissionDate,
      amount: amountPaid,
      discount: 0,
      fine: 0,
      method: (paymentMethod as string) || "নগদ",
      feeType: "এককালীন",
      note: "ভর্তির সময় প্রদান",
      source: "admission",
      admissionFeeComponent: admissionFee,
      courseFeeComponent: totalCourseFee,
    });
  }

  const fresh = await getDocOrThrow(String(doc._id));
  return withGuardian(fresh);
}

/**
 * The general edit form's body (createStudentSchema.partial(), via
 * updateStudentSchema) includes `rollNumber` for symmetry with the create
 * form, but the schema field is `currentRollNumber` — a plain
 * Object.assign(doc, patch) silently drops it onto a non-schema path that
 * Mongoose never persists. Editing Roll Number from the normal "সম্পাদনা"
 * form looked like it worked (200 OK, no error) but never actually changed
 * anything. Bridges the rename and reuses updateRoll()'s own collision
 * scope-check so both entry points enforce the same uniqueness rule.
 */
async function applyRollNumberIfPresent(doc: StudentDoc, patch: Record<string, unknown>): Promise<void> {
  if (typeof patch.rollNumber !== "string" || patch.rollNumber === doc.currentRollNumber) return;
  const rollNumber = patch.rollNumber;
  if (doc.currentBatchId) {
    const { getSettings } = await import("../settings/settings.service");
    const settings = await getSettings();
    const scopeFilter: Record<string, unknown> = { currentRollNumber: rollNumber, _id: { $ne: doc._id } };
    if (settings.rollNumberScope !== "global") scopeFilter.currentBatchId = doc.currentBatchId;
    const clash = await Student.findOne(scopeFilter);
    if (clash) throw ApiError.conflict(`Roll number "${rollNumber}" is already in use`);
  }
  doc.currentRollNumber = rollNumber;
}

/**
 * totalCourseFee is never client-settable (createStudentSchema/updateStudentSchema
 * have no such field at all — see student.validation.ts) — it only ever comes
 * from the referenced Course's own `fee`. So when an admin changes a
 * student's Course after admission, this re-snapshots totalCourseFee from
 * the *new* Course here; a Course.fee edit in Settings never reaches back
 * into this or any other already-admitted student (Phase 4 historical
 * integrity requirement) since nothing re-reads Course.fee except this path
 * and student.service.ts's create().
 */
async function applyCourseIdIfPresent(doc: StudentDoc, patch: Record<string, unknown>): Promise<boolean> {
  if (typeof patch.courseId !== "string" || patch.courseId === String(doc.courseId ?? "")) return false;
  const course = await resolveCourseOrThrow(patch.courseId);
  doc.courseId = course._id as never;
  doc.course = course.name;
  doc.totalCourseFee = course.fee;
  return true;
}

async function applyPatch(req: Request, doc: StudentDoc, patch: Record<string, unknown> & GuardianInline) {
  const before = doc.toObject();

  await syncHscInstitution(patch);
  await applyRollNumberIfPresent(doc, patch);
  const courseChanged = await applyCourseIdIfPresent(doc, patch);
  const { rollNumber: _rollNumber, courseId: _courseId, ...rest } = patch;

  const feeFieldsTouched = courseChanged || ["feeType", "monthlyFee", "courseDuration", "discount", "paid"].some((k) => k in patch);
  Object.assign(doc, rest);
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

  if (patch.guardianName || patch.guardianMobile || patch.guardianRelation || patch.guardianOccupation || patch.guardianAddress) {
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

/**
 * The one place a Student's photo is ever written — shared by the Admin
 * upload endpoint, the Student Portal's self-upload, and the public Student
 * Entry workflow (Student Photo Management), so all three follow the exact
 * same "upload first, save second, delete-old-asset last" sequence rather
 * than three near-duplicate implementations that could drift apart.
 *
 * Order matters here: the new photo is uploaded and the document saved
 * *before* the old Cloudinary asset is touched, so a failure at any earlier
 * step never leaves a student without a working photo. Deleting the old
 * asset is best-effort (cloudinaryService logs and swallows its own
 * errors) — a stray orphaned image in Cloudinary is a cheap, recoverable
 * problem; a broken student update is not.
 */
export async function applyPhotoUpload(req: Request, id: string, fileBuffer: Buffer): Promise<StudentDoc> {
  const doc = await Student.findById(id).select("+photoPublicId");
  if (!doc) throw ApiError.notFound("Student not found");

  const before = doc.toObject();
  const previousPublicId = doc.photoPublicId;

  // Named after the student's current Roll Number when one is set (the
  // identifier office staff actually recognize), falling back to the
  // permanent Registration ID for a student not yet assigned a roll.
  const uploaded = await uploadStudentPhoto(fileBuffer, doc.currentRollNumber || doc.registrationId);
  doc.photoUrl = uploaded.url;
  doc.photoPublicId = uploaded.publicId;
  await doc.save();
  await refreshProfileCompletion(doc);

  await recordAudit({
    req,
    action: "student.upload-photo",
    module: "students",
    targetCollection: "students",
    targetId: id,
    before,
    after: { photoUrl: doc.photoUrl },
  });

  if (previousPublicId && previousPublicId !== uploaded.publicId) {
    await deleteCloudinaryAsset(previousPublicId);
  }

  return doc;
}

/** Removes a student's photo entirely (Admin-only — see student.routes.ts). Never used by the self/public paths, which only ever replace a photo, never blank it out. */
export async function applyPhotoRemoval(req: Request, id: string): Promise<StudentDoc> {
  const doc = await Student.findById(id).select("+photoPublicId");
  if (!doc) throw ApiError.notFound("Student not found");

  const before = doc.toObject();
  const previousPublicId = doc.photoPublicId;
  doc.photoUrl = undefined;
  doc.photoPublicId = undefined;
  await doc.save();
  await refreshProfileCompletion(doc);

  await recordAudit({ req, action: "student.remove-photo", module: "students", targetCollection: "students", targetId: id, before, after: { photoUrl: null } });

  if (previousPublicId) await deleteCloudinaryAsset(previousPublicId);

  return doc;
}

/** Admin upload/replace — any student, gated by STUDENTS_UPDATE (student.routes.ts). */
export async function uploadPhoto(req: Request, id: string, fileBuffer: Buffer): Promise<Record<string, unknown>> {
  const doc = await applyPhotoUpload(req, id, fileBuffer);
  return withGuardian(doc);
}

export async function removePhoto(req: Request, id: string): Promise<Record<string, unknown>> {
  const doc = await applyPhotoRemoval(req, id);
  return withGuardian(doc);
}

/** Student Portal self-upload — identity comes from the session (req.user.studentId), never a client-supplied id, same principle as getMyProfile above. */
export async function uploadMyPhoto(req: Request, fileBuffer: Buffer): Promise<Record<string, unknown>> {
  const studentId = req.user?.studentId;
  if (!studentId) throw ApiError.forbidden("No linked student record");
  const doc = await applyPhotoUpload(req, studentId, fileBuffer);
  return withGuardian(doc);
}

export async function removeMyPhoto(req: Request): Promise<Record<string, unknown>> {
  const studentId = req.user?.studentId;
  if (!studentId) throw ApiError.forbidden("No linked student record");
  const doc = await applyPhotoRemoval(req, studentId);
  return withGuardian(doc);
}
