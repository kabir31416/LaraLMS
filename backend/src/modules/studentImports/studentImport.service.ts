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
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../common/utils/pagination";

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
    registrationId: parsed.registrationNumber || undefined,
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
