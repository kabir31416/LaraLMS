import { Request } from "express";
import { StudentImportSession, StudentImportSessionDoc } from "./studentImportSession.model";
import { StudentImportRow, StudentImportRowDoc, ROW_IMPORT_STATUS } from "./studentImportRow.model";
import { parseStudentWorkbook, buildImportTemplateBuffer, MAX_IMPORT_ROWS } from "./studentImport.excel";
import { validateParsedRows, revalidateRowForApproval } from "./studentImport.rowValidator";
import type { ParsedStudentRow } from "./studentImportRow.model";
import { Student } from "../students/student.model";
import { Guardian } from "../guardians/guardian.model";
import { Course } from "../courses/course.model";
import * as studentService from "../students/student.service";
import { getSettings } from "../settings/settings.service";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../common/utils/pagination";
import { Types } from "mongoose";
import type { AnyBulkWriteOperation } from "mongoose";

/**
 * Bulk Student Upload orchestration (Excel Student Information Import spec
 * §2/§8/§13/§27/§28).
 *
 * FINAL BUSINESS RULE: EXCEL IMPORT = STUDENT INFORMATION ONLY.
 *   - COURSE is selected by the admin BEFORE upload, validated exactly once
 *     here, and stored on the session — every row inherits that same
 *     course, never a per-row value, so a course/batch mismatch is
 *     structurally impossible rather than merely validated.
 *   - BATCH is never read, validated, or assigned by import at all — an
 *     imported student simply has no batch until the existing
 *     batch-assignment workflow (unrelated to this module) is used later.
 *   - FEE/PAYMENT is never created by import — no admission fee, discount,
 *     payment, invoice, or receipt logic runs here. Admin adds payment
 *     later through the existing Fee Management screens.
 *
 * The one hard rule everything else here protects: uploading/previewing a
 * file NEVER creates a Student. Only approveRow() does, and it does so by
 * calling the exact same student.service.ts `create()` every normal
 * Admission does — no parallel creation path.
 *
 * This deployment has no MongoDB replica set, so `session.withTransaction`
 * is not available (same documented constraint as enrollment.service.ts's
 * roll-uniqueness check and every other multi-write operation in this
 * codebase). Safety here instead comes from two things:
 *   1. An atomic conditional claim (`findOneAndUpdate` with a status
 *      filter) before any work starts, so two simultaneous approval
 *      requests for the same row can never both proceed.
 *   2. A manual compensating rollback: if student.service.ts's create()
 *      throws after partially persisting (e.g. the guardian upsert or
 *      profile-completion refresh inside it fails), the just-created
 *      Student (and its Guardian) are deleted again before the row is
 *      marked FAILED, so a failed approval never leaves an orphan behind.
 */

type RowStatus = (typeof ROW_IMPORT_STATUS)[number];
const COUNTER_FIELD: Partial<Record<RowStatus, string>> = {
  PENDING: "pendingRows",
  APPROVED: "approvedRows",
  REJECTED: "rejectedRows",
  FAILED: "failedRows",
};

async function adjustCounters(sessionId: string, fromStatus: RowStatus, toStatus: RowStatus): Promise<void> {
  const inc: Record<string, number> = {};
  const fromField = COUNTER_FIELD[fromStatus];
  const toField = COUNTER_FIELD[toStatus];
  if (fromField) inc[fromField] = (inc[fromField] || 0) - 1;
  if (toField) inc[toField] = (inc[toField] || 0) + 1;
  if (Object.keys(inc).length > 0) await StudentImportSession.findByIdAndUpdate(sessionId, { $inc: inc });
}

// -------------------- Upload + Preview (never writes to Student) --------------------

/**
 * `courseId` is mandatory and validated here, once, against real Course
 * master data — never trusted blindly from the client beyond "this id
 * exists and is active" (§9/§23 "never trust an unverified client-supplied
 * course ID" — the trust boundary is exactly this one server-side lookup,
 * not the client's selection itself).
 */
export async function uploadAndPreview(req: Request, file: { buffer: Buffer; originalname: string }, courseId: string): Promise<StudentImportSessionDoc> {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.badRequest("নির্বাচিত কোর্সটি পাওয়া যায়নি।");
  if (course.status !== "সক্রিয়") throw ApiError.badRequest("নির্বাচিত কোর্সটি নিষ্ক্রিয়।");

  const { rows: parsedRows, headerErrors, headerWarnings } = parseStudentWorkbook(file.buffer);
  if (headerErrors.length > 0) throw ApiError.badRequest(headerErrors.join(" "));
  if (parsedRows.length === 0) throw ApiError.badRequest("এক্সেল ফাইলে কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।");
  if (parsedRows.length > MAX_IMPORT_ROWS) {
    throw ApiError.badRequest(`একটি ফাইলে সর্বোচ্চ ${MAX_IMPORT_ROWS} জন শিক্ষার্থীর তথ্য আপলোড করা যাবে — ফাইলে আছে ${parsedRows.length} সারি।`);
  }

  const validated = await validateParsedRows(parsedRows);

  const validRows = validated.filter((r) => r.status !== "ERROR").length;
  const errorRows = validated.length - validRows;

  const session = await StudentImportSession.create({
    originalFileName: file.originalname,
    uploadedBy: req.user!.id,
    courseId: course._id,
    courseName: course.name,
    headerWarnings,
    totalRows: validated.length,
    validRows,
    errorRows,
    pendingRows: validRows,
    status: "ready",
  });

  await StudentImportRow.insertMany(
    validated.map((r) => ({
      sessionId: session._id,
      rowNumber: r.rowNumber,
      parsed: r.parsed,
      validationStatus: r.status,
      validationMessages: r.messages,
      duplicateInFile: r.duplicateInFile,
      matchesExistingStudentId: r.matchesExistingStudentId,
      importStatus: r.status === "ERROR" ? "FAILED" : "PENDING",
      failureReason: r.status === "ERROR" ? r.messages.join(" ") : undefined,
    })),
  );
  // ERROR rows start life as FAILED (not approvable) rather than PENDING —
  // "pendingRows" above only ever counted non-ERROR rows, so this doesn't
  // double count; an admin can still fix the underlying master data and
  // retry a FAILED row later.
  if (errorRows > 0) {
    await StudentImportSession.findByIdAndUpdate(session._id, { $set: { failedRows: errorRows } });
  }

  await recordAudit({
    req,
    action: "student-import.upload",
    module: "students",
    targetCollection: "studentimportsessions",
    targetId: String(session._id),
    after: { fileName: file.originalname, courseId: String(course._id), courseName: course.name, totalRows: validated.length, validRows, errorRows },
  });

  return getSessionOrThrow(String(session._id));
}

export function generateTemplate(): Buffer {
  return buildImportTemplateBuffer();
}

async function getSessionOrThrow(sessionId: string): Promise<StudentImportSessionDoc> {
  const doc = await StudentImportSession.findById(sessionId);
  if (!doc) throw ApiError.notFound("Import session not found");
  return doc;
}

export async function getSession(sessionId: string): Promise<StudentImportSessionDoc> {
  return getSessionOrThrow(sessionId);
}

export async function listRows(req: Request, sessionId: string) {
  await getSessionOrThrow(sessionId);
  const { page, limit, skip } = parsePagination(req, { rowNumber: 1 });
  const filter: Record<string, unknown> = { sessionId };
  if (req.query.importStatus) filter.importStatus = req.query.importStatus;
  if (req.query.validationStatus) filter.validationStatus = req.query.validationStatus;

  const [items, total] = await Promise.all([
    StudentImportRow.find(filter)
      .sort({ rowNumber: 1 })
      .skip(skip)
      .limit(limit)
      // Single batched populate for the whole page, not one query per row —
      // lets the preview show the already-existing/just-created student's
      // real registration ID instead of a bare, meaningless ObjectId.
      .populate("createdStudentId", "registrationId name currentRollNumber")
      .populate("matchesExistingStudentId", "registrationId name phone"),
    StudentImportRow.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function listHistory(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { uploadedAt: -1 });
  const [items, total] = await Promise.all([
    StudentImportSession.find().sort(sort).skip(skip).limit(limit).populate<{ uploadedBy: { _id: unknown; identifier: string } | null }>("uploadedBy", "identifier"),
    StudentImportSession.countDocuments(),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

// -------------------- Row-by-row approval (the only path that creates a Student) --------------------

/**
 * Builds the exact body student.service.ts's create() expects — student
 * information only. `courseId`/`courseName` come from the SESSION (the
 * admin's UI selection), never from the row, which is what makes a
 * course/batch mismatch structurally impossible rather than merely
 * validated. No batch field exists here at all. No discount/paid/
 * paymentMethod either — student.service.ts's create() defaults those to 0
 * when absent, so this never creates a payment.
 */
function buildStudentCreateBody(parsed: ParsedStudentRow, courseId: string): Record<string, unknown> {
  return {
    name: parsed.name,
    phone: parsed.phone,
    dob: parsed.dob,
    gender: parsed.gender,
    rollNumber: parsed.rollNumber,
    courseId,
    religion: parsed.religion,
    bloodGroup: parsed.bloodGroup,
    fatherName: parsed.fatherName,
    motherName: parsed.motherName,
    guardianMobile: parsed.guardianMobile,
    guardianName: parsed.guardianName,
    guardianRelation: parsed.guardianRelation,
    guardianOccupation: parsed.guardianOccupation,
    division: parsed.division,
    district: parsed.district,
    upazila: parsed.upazila,
    postOffice: parsed.postOffice,
    postcode: parsed.postcode,
    village: parsed.village,
    presentAddress: parsed.presentAddress,
    permanentAddress: parsed.permanentAddress,
    hscInstitution: parsed.hscInstitution,
    hscBoard: parsed.hscBoard,
    hscRoll: parsed.hscRoll,
    hscRegistrationNumber: parsed.hscRegistrationNumber,
    hscPassingYear: parsed.hscPassingYear,
    hscGroup: parsed.hscGroup,
    hscGpa: parsed.hscGpa,
    sscInstitution: parsed.sscInstitution,
    sscBoard: parsed.sscBoard,
    sscRoll: parsed.sscRoll,
    sscRegistrationNumber: parsed.sscRegistrationNumber,
    sscPassingYear: parsed.sscPassingYear,
    sscGroup: parsed.sscGroup,
    sscGpa: parsed.sscGpa,
    admissionType: "নতুন",
    feeType: "এককালীন",
  };
}

/** Best-effort compensation if student.service.ts's create() fails partway through — deletes the just-created Student/Guardian so a failed row never leaves an orphan behind. Safe to call even when nothing was actually created (no-op). */
async function compensateOrphanStudent(phone: string): Promise<void> {
  const orphan = await Student.findOne({ phone });
  if (!orphan) return;
  await Guardian.deleteMany({ studentId: orphan._id });
  await orphan.deleteOne();
}

function findRowPopulated(rowId: string) {
  return StudentImportRow.findById(rowId)
    .populate("createdStudentId", "registrationId name currentRollNumber")
    .populate("matchesExistingStudentId", "registrationId name phone");
}

async function claimRow(sessionId: string, rowId: string): Promise<StudentImportRowDoc> {
  const before = await StudentImportRow.findOneAndUpdate(
    { _id: rowId, sessionId, importStatus: { $in: ["PENDING", "FAILED"] } },
    { $set: { importStatus: "PROCESSING" } },
    { new: false },
  );
  if (!before) {
    throw ApiError.conflict("এই সারিটি অনুমোদনের জন্য প্রস্তুত নয় — হয়তো ইতিমধ্যে অনুমোদিত/বাতিল হয়েছে অথবা এখন অন্য কেউ প্রসেস করছে।");
  }
  return before;
}

export async function approveRow(req: Request, sessionId: string, rowId: string): Promise<StudentImportRowDoc> {
  const session = await getSessionOrThrow(sessionId);
  const courseId = String(session.courseId);
  const before = await claimRow(sessionId, rowId);
  const beforeStatus = before.importStatus; // "PENDING" or "FAILED" — whichever the atomic claim matched

  const validationError = await revalidateRowForApproval(before.parsed, courseId);
  if (validationError) {
    await StudentImportRow.updateOne({ _id: rowId }, { $set: { importStatus: "FAILED", failureReason: validationError } });
    await adjustCounters(sessionId, beforeStatus, "FAILED");
    await recordAudit({ req, action: "student-import.row-approve-failed", module: "students", targetCollection: "studentimportrows", targetId: rowId, after: { reason: validationError } });
    return (await findRowPopulated(rowId))!;
  }

  try {
    const body = buildStudentCreateBody(before.parsed, courseId);
    const created = await studentService.create(req, body);
    const createdId = String((created as { _id: unknown })._id);

    await StudentImportRow.updateOne(
      { _id: rowId },
      {
        $set: {
          importStatus: "APPROVED",
          approvedBy: req.user!.id,
          approvedAt: new Date(),
          createdStudentId: createdId,
        },
        $unset: { failureReason: "" },
      },
    );
    await adjustCounters(sessionId, beforeStatus, "APPROVED");
    await recordAudit({ req, action: "student-import.row-approve", module: "students", targetCollection: "studentimportrows", targetId: rowId, after: { studentId: createdId } });
    return (await findRowPopulated(rowId))!;
  } catch (err) {
    if (before.parsed.phone) await compensateOrphanStudent(before.parsed.phone);
    const message = err instanceof ApiError ? err.message : "শিক্ষার্থী তৈরি করা যায়নি — অজানা সমস্যা।";
    await StudentImportRow.updateOne({ _id: rowId }, { $set: { importStatus: "FAILED", failureReason: message } });
    await adjustCounters(sessionId, beforeStatus, "FAILED");
    await recordAudit({ req, action: "student-import.row-approve-failed", module: "students", targetCollection: "studentimportrows", targetId: rowId, after: { reason: message } });
    return (await findRowPopulated(rowId))!;
  }
}

/**
 * Row IDs across the WHOLE session (not just the current page) that are
 * approvable and not already known-invalid — backs the Preview page's
 * "Approve All Valid" button, which must not require paging through the
 * session 20/100 rows at a time just to build a selection. One projected
 * query (`_id` only), never N.
 */
export async function listValidRowIds(sessionId: string): Promise<{ rowIds: string[]; count: number }> {
  await getSessionOrThrow(sessionId);
  const rows = await StudentImportRow.find({
    sessionId,
    importStatus: { $in: ["PENDING", "FAILED"] },
    validationStatus: { $ne: "ERROR" },
  })
    .select("_id")
    .lean();
  const rowIds = rows.map((r) => String(r._id));
  return { rowIds, count: rowIds.length };
}

// -------------------- Bulk approval (one request, not N) --------------------

export type BulkApprovalOutcome = "APPROVED" | "DUPLICATE" | "INVALID" | "FAILED" | "SKIPPED";

export interface BulkApprovalResultItem {
  rowId: string;
  rowNumber: number;
  outcome: BulkApprovalOutcome;
  studentId?: string;
  reason?: string;
}

export interface BulkApprovalSummary {
  total: number;
  approved: number;
  duplicate: number;
  invalid: number;
  failed: number;
  skipped: number;
  results: BulkApprovalResultItem[];
}

/** Runs `worker` over `items` with at most `limit` in flight at once — bounded so a large selection doesn't open hundreds of simultaneous Mongo connections, but still overlaps the I/O latency of independent students' creation instead of paying it fully serially. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

const BULK_APPROVE_CONCURRENCY = 8;

/**
 * Bulk Approval (Bulk Student Upload Approval spec) — the entire selection
 * is processed in ONE request instead of the frontend firing one
 * approve-row call per student. Every actual Student is still created
 * through the exact same student.service.ts `create()` normal Admission
 * and single-row approval use (§"reuse business logic") — nothing here
 * duplicates that business logic or bypasses it for speed. The speed comes
 * from batching everything AROUND that call instead:
 *   - the Course is resolved ONCE for the whole selection, not per row
 *     (every row already shares the same session-level course);
 *   - existing-phone/existing-roll duplicate checks are ONE query each
 *     across every selected row, not one query per row;
 *   - the row claim and the final status update are each a single
 *     `bulkWrite`, not N sequential `updateOne` calls;
 *   - only the actual `create()` calls (which each still do their own
 *     several sequential writes — registrationId counter, Student insert,
 *     Guardian upsert, profile-completion, audit log) run with bounded
 *     concurrency, since those are the one part of the work that
 *     genuinely can't be collapsed into a single batched query without
 *     forking the business logic.
 *
 * Never fails the whole batch for one bad row (§"partial success") — every
 * row resolves to exactly one outcome (APPROVED/DUPLICATE/INVALID/FAILED/
 * SKIPPED) and the request always returns 200 with a full summary.
 */
export async function bulkApproveRows(req: Request, sessionId: string, rowIds: string[]): Promise<BulkApprovalSummary> {
  const session = await getSessionOrThrow(sessionId);
  const courseId = String(session.courseId);
  const uniqueRowIds = Array.from(new Set(rowIds));

  // Snapshot "before" status now (needed for correct counter math) and scope
  // strictly to rows that actually belong to this session — a crafted
  // rowIds array must never let a caller touch another session's rows.
  const targetRows = await StudentImportRow.find({ _id: { $in: uniqueRowIds }, sessionId });
  const targetById = new Map(targetRows.map((r) => [String(r._id), r]));
  const claimableIds = targetRows.filter((r) => r.importStatus === "PENDING" || r.importStatus === "FAILED").map((r) => r._id);

  const results: BulkApprovalResultItem[] = [];
  for (const id of uniqueRowIds) {
    const row = targetById.get(id);
    if (!row || row.importStatus === "PROCESSING" || row.importStatus === "APPROVED" || row.importStatus === "REJECTED") {
      results.push({
        rowId: id,
        rowNumber: row?.rowNumber ?? -1,
        outcome: "SKIPPED",
        reason: !row ? "সারিটি এই সেশনে পাওয়া যায়নি।" : "সারিটি অনুমোদনের জন্য প্রস্তুত নয় (ইতিমধ্যে প্রসেসড)।",
      });
    }
  }
  if (claimableIds.length === 0) return summarizeBulk(uniqueRowIds.length, results);

  // Single bulkWrite claim — one round trip, still per-document atomic (the
  // status filter is re-asserted on each op) rather than one findOneAndUpdate per row.
  await StudentImportRow.bulkWrite(
    claimableIds.map((id) => ({
      updateOne: { filter: { _id: id, importStatus: { $in: ["PENDING", "FAILED"] } }, update: { $set: { importStatus: "PROCESSING" } } },
    })),
    { ordered: false },
  );
  const claimedRows = await StudentImportRow.find({ _id: { $in: claimableIds }, importStatus: "PROCESSING" });
  const claimedIds = new Set(claimedRows.map((r) => String(r._id)));
  for (const id of claimableIds) {
    if (!claimedIds.has(String(id))) {
      const row = targetById.get(String(id))!;
      results.push({ rowId: String(id), rowNumber: row.rowNumber, outcome: "SKIPPED", reason: "সারিটি এই মুহূর্তে অন্য একটি অনুরোধ প্রসেস করছে।" });
    }
  }
  if (claimedRows.length === 0) return summarizeBulk(uniqueRowIds.length, results);

  // Every status transition below is tallied here in memory and applied to
  // the session's counters as ONE `$inc` at the very end, instead of a
  // separate adjustCounters() write per row (which would otherwise be
  // exactly the "one query per student" pattern this whole endpoint exists
  // to avoid).
  const counterDelta: Record<string, number> = {};
  const bumpCounters = (beforeStatus: RowStatus, toStatus: RowStatus) => {
    const fromField = COUNTER_FIELD[beforeStatus];
    const toField = COUNTER_FIELD[toStatus];
    if (fromField) counterDelta[fromField] = (counterDelta[fromField] || 0) - 1;
    if (toField) counterDelta[toField] = (counterDelta[toField] || 0) + 1;
  };
  const finishRow = (row: StudentImportRowDoc, beforeStatus: RowStatus, toStatus: RowStatus, outcome: BulkApprovalOutcome, extra: Partial<BulkApprovalResultItem> = {}): BulkApprovalResultItem => {
    bumpCounters(beforeStatus, toStatus);
    return { rowId: String(row._id), rowNumber: row.rowNumber, outcome, ...extra };
  };
  const flushCounters = async () => {
    if (Object.keys(counterDelta).length > 0) await StudentImportSession.findByIdAndUpdate(sessionId, { $inc: counterDelta });
  };

  // Course is validated ONCE for the whole batch — every claimed row shares this same session-level course.
  const course = await Course.findById(courseId).select("status");
  if (!course || course.status !== "সক্রিয়") {
    const reason = !course ? "নির্বাচিত কোর্সটি আর পাওয়া যাচ্ছে না।" : "নির্বাচিত কোর্সটি নিষ্ক্রিয়।";
    const bulkOps: AnyBulkWriteOperation<StudentImportRowDoc>[] = claimedRows.map((r) => ({
      updateOne: { filter: { _id: r._id }, update: { $set: { importStatus: "FAILED" as const, failureReason: reason } } },
    }));
    await StudentImportRow.bulkWrite(bulkOps, { ordered: false });
    for (const row of claimedRows) {
      const beforeStatus = targetById.get(String(row._id))!.importStatus;
      results.push(finishRow(row, beforeStatus, "FAILED", "INVALID", { reason }));
    }
    await flushCounters();
    await recordBulkAudit(req, sessionId, uniqueRowIds.length, results);
    return summarizeBulk(uniqueRowIds.length, results);
  }

  // Batched, fresh duplicate pre-check — the same rules revalidateRowForApproval
  // applies per-row, but ONE query per field across the whole selection.
  const phones = claimedRows.map((r) => r.parsed.phone).filter((p): p is string => !!p);
  const existingByPhone = new Map<string, string>();
  if (phones.length > 0) {
    const matches = await Student.find({ phone: { $in: phones } }).select("phone");
    for (const m of matches) existingByPhone.set(m.phone, String(m._id));
  }
  const settings = await getSettings();
  const existingByRoll = new Map<string, string>();
  if (settings.rollNumberScope === "global") {
    const rolls = claimedRows.map((r) => r.parsed.rollNumber).filter((r): r is string => !!r);
    if (rolls.length > 0) {
      const matches = await Student.find({ currentRollNumber: { $in: rolls } }).select("currentRollNumber");
      for (const m of matches) existingByRoll.set(m.currentRollNumber as string, String(m._id));
    }
  }

  const toCreate: StudentImportRowDoc[] = [];
  const phoneSeenInBatch = new Set<string>();
  const skipOps: AnyBulkWriteOperation<StudentImportRowDoc>[] = [];
  for (const row of claimedRows) {
    const p = row.parsed;
    const beforeStatus = targetById.get(String(row._id))!.importStatus;
    if (!p.name || !p.phone) {
      const reason = "আবশ্যক তথ্য অনুপস্থিত (নাম/মোবাইল)।";
      skipOps.push({ updateOne: { filter: { _id: row._id }, update: { $set: { importStatus: "FAILED" as const, failureReason: reason } } } });
      results.push(finishRow(row, beforeStatus, "FAILED", "INVALID", { reason }));
      continue;
    }
    if (existingByPhone.has(p.phone) || phoneSeenInBatch.has(p.phone)) {
      const reason = `"${p.phone}" মোবাইল নম্বরের একজন শিক্ষার্থী ইতোমধ্যে বিদ্যমান।`;
      skipOps.push({ updateOne: { filter: { _id: row._id }, update: { $set: { importStatus: "FAILED" as const, failureReason: reason } } } });
      results.push(finishRow(row, beforeStatus, "FAILED", "DUPLICATE", { reason, studentId: existingByPhone.get(p.phone) }));
      continue;
    }
    if (p.rollNumber && existingByRoll.has(p.rollNumber)) {
      const reason = `রোল/রেজিস্ট্রেশন নম্বর "${p.rollNumber}" ইতোমধ্যে ব্যবহৃত হয়েছে।`;
      skipOps.push({ updateOne: { filter: { _id: row._id }, update: { $set: { importStatus: "FAILED" as const, failureReason: reason } } } });
      results.push(finishRow(row, beforeStatus, "FAILED", "DUPLICATE", { reason, studentId: existingByRoll.get(p.rollNumber) }));
      continue;
    }
    phoneSeenInBatch.add(p.phone);
    toCreate.push(row);
  }
  if (skipOps.length > 0) {
    await StudentImportRow.bulkWrite(skipOps, { ordered: false });
  }

  // The actual creation — still one real student.service.ts create() call per
  // student (same business logic single/bulk approval share), bounded concurrency.
  const createOutcomes = await mapWithConcurrency(toCreate, BULK_APPROVE_CONCURRENCY, async (row) => {
    try {
      const body = buildStudentCreateBody(row.parsed, courseId);
      const created = await studentService.create(req, body);
      return { row, ok: true as const, studentId: String((created as { _id: unknown })._id) };
    } catch (err) {
      if (row.parsed.phone) await compensateOrphanStudent(row.parsed.phone);
      const message = err instanceof ApiError ? err.message : "শিক্ষার্থী তৈরি করা যায়নি — অজানা সমস্যা।";
      return { row, ok: false as const, reason: message };
    }
  });

  const finalOps: AnyBulkWriteOperation<StudentImportRowDoc>[] = createOutcomes.map(({ row, ...outcome }) =>
    outcome.ok
      ? { updateOne: { filter: { _id: row._id }, update: { $set: { importStatus: "APPROVED" as const, approvedBy: new Types.ObjectId(req.user!.id), approvedAt: new Date(), createdStudentId: new Types.ObjectId(outcome.studentId) }, $unset: { failureReason: "" } } } }
      : { updateOne: { filter: { _id: row._id }, update: { $set: { importStatus: "FAILED" as const, failureReason: outcome.reason } } } },
  );
  if (finalOps.length > 0) await StudentImportRow.bulkWrite(finalOps, { ordered: false });

  for (const { row, ...outcome } of createOutcomes) {
    const beforeStatus = targetById.get(String(row._id))!.importStatus;
    if (outcome.ok) {
      results.push(finishRow(row, beforeStatus, "APPROVED", "APPROVED", { studentId: outcome.studentId }));
    } else {
      results.push(finishRow(row, beforeStatus, "FAILED", "FAILED", { reason: outcome.reason }));
    }
  }

  await flushCounters();
  await recordBulkAudit(req, sessionId, uniqueRowIds.length, results);
  return summarizeBulk(uniqueRowIds.length, results);
}

function summarizeBulk(total: number, results: BulkApprovalResultItem[]): BulkApprovalSummary {
  const count = (o: BulkApprovalOutcome) => results.filter((r) => r.outcome === o).length;
  return {
    total,
    approved: count("APPROVED"),
    duplicate: count("DUPLICATE"),
    invalid: count("INVALID"),
    failed: count("FAILED"),
    skipped: count("SKIPPED"),
    results,
  };
}

async function recordBulkAudit(req: Request, sessionId: string, requested: number, results: BulkApprovalResultItem[]): Promise<void> {
  const summary = summarizeBulk(requested, results);
  await recordAudit({
    req,
    action: "student-import.bulk-approve",
    module: "students",
    targetCollection: "studentimportsessions",
    targetId: sessionId,
    after: { requested, approved: summary.approved, duplicate: summary.duplicate, invalid: summary.invalid, failed: summary.failed, skipped: summary.skipped },
  });
}

export async function rejectRow(req: Request, sessionId: string, rowId: string, reason: string): Promise<StudentImportRowDoc> {
  await getSessionOrThrow(sessionId);
  const before = await StudentImportRow.findOneAndUpdate(
    { _id: rowId, sessionId, importStatus: { $in: ["PENDING", "FAILED"] } },
    { $set: { importStatus: "REJECTED", rejectedBy: req.user!.id, rejectedAt: new Date(), rejectionReason: reason } },
    { new: false },
  );
  if (!before) throw ApiError.conflict("এই সারিটি বাতিল করা যাচ্ছে না — হয়তো ইতিমধ্যে প্রসেস হয়েছে।");
  await adjustCounters(sessionId, before.importStatus, "REJECTED");
  await recordAudit({ req, action: "student-import.row-reject", module: "students", targetCollection: "studentimportrows", targetId: rowId, after: { reason } });
  return (await findRowPopulated(rowId))!;
}
