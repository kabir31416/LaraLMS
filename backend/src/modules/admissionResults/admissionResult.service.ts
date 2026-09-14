import { Request } from "express";
import fs from "fs";
import path from "path";
import { Types } from "mongoose";
import {
  AdmissionResult,
  AdmissionResultDoc,
  AdmissionResultImport,
  RESULT_ROUNDS,
  UnmatchedRoll,
} from "./admissionResult.model";
import { parseAdmissionResultPdf, ParsedRollEntry } from "./pdfParser.service";
import { Student, StudentDoc } from "../students/student.model";
import { Batch } from "../batches/batch.model";
import { Course } from "../courses/course.model";
import { AcademicSession } from "../academicSessions/academicSession.model";
import { PERMISSIONS } from "../rbac/permissions";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../common/utils/pagination";
import { toAsciiDigits } from "../../common/utils/digits";
import { logger } from "../../logger/logger";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "admission-results");

type PreviewStatus = "MATCHED" | "NOT_FOUND" | "ALREADY_IMPORTED" | "PARSING_ERROR";

export interface PreviewRow extends ParsedRollEntry {
  status: PreviewStatus;
  reason?: string;
  studentId?: string;
  studentName?: string;
  studentRoll?: string;
  phone?: string;
  batchId?: string;
  batchName?: string;
}

/** Batch Directors may only ever see/act on their own batch(es) — same server-enforced pattern already used across the app (student.controller.ts, exam.service.ts's readScope). */
async function resolveBatchScope(req: Request): Promise<string[] | undefined> {
  const perms = req.user!.permissions;
  if (perms.includes("*") || perms.includes(PERMISSIONS.ADMISSION_RESULTS_MANAGE)) return undefined;
  if (!perms.includes(PERMISSIONS.ADMISSION_RESULTS_READ_OWN_BATCH)) throw ApiError.forbidden("Missing permission");
  if (!req.user!.staffId) throw ApiError.forbidden("No linked staff record");
  const batchIds = await Batch.find({ directorId: req.user!.staffId }).distinct("_id");
  return batchIds.map(String);
}

function assertAdmin(req: Request): void {
  const perms = req.user!.permissions;
  if (!perms.includes("*") && !perms.includes(PERMISSIONS.ADMISSION_RESULTS_MANAGE)) {
    throw ApiError.forbidden("Only Admin may perform this action");
  }
}

/**
 * Disambiguates a roll shared by more than one Student (legitimate — the
 * Admission Roll feature itself only guarantees uniqueness within one
 * admission cycle, i.e. one Course's AcademicSession — see student.model.ts's
 * index comment) by preferring whichever candidate's own Course falls under
 * the import's selected session. Left genuinely ambiguous otherwise, rather
 * than guessing.
 */
function pickStudent(candidates: StudentDoc[], sessionCourseIds: Set<string>): { student?: StudentDoc; ambiguous: boolean } {
  if (candidates.length === 0) return { ambiguous: false };
  if (candidates.length === 1) return { student: candidates[0], ambiguous: false };
  const scoped = candidates.filter((c) => c.courseId && sessionCourseIds.has(String(c.courseId)));
  if (scoped.length === 1) return { student: scoped[0], ambiguous: false };
  return { ambiguous: true };
}

async function buildPreviewRows(
  entries: ParsedRollEntry[],
  sessionId: string | undefined,
  sessionName: string,
  resultRound: string,
): Promise<{ rows: PreviewRow[]; batchNameById: Map<string, string> }> {
  const rolls = Array.from(new Set(entries.map((e) => e.admissionRoll)));
  const students = rolls.length
    ? await Student.find({ admissionRoll: { $in: rolls } }).select("name currentRollNumber phone currentBatchId admissionRoll courseId")
    : [];
  const byRoll = new Map<string, StudentDoc[]>();
  for (const s of students) {
    const arr = byRoll.get(s.admissionRoll!) || [];
    arr.push(s);
    byRoll.set(s.admissionRoll!, arr);
  }

  const batchIds = Array.from(new Set(students.map((s) => s.currentBatchId).filter(Boolean).map(String)));
  const batches = batchIds.length ? await Batch.find({ _id: { $in: batchIds } }).select("name") : [];
  const batchNameById = new Map(batches.map((b) => [String(b._id), b.name]));

  const sessionCourseIds = new Set(
    sessionId ? (await Course.find({ sessionId }).distinct("_id")).map(String) : [],
  );

  const existing = rolls.length
    ? await AdmissionResult.find({ session: sessionName, resultRound, admissionRoll: { $in: rolls } }).select("studentId admissionRoll")
    : [];
  const existingKeys = new Set(existing.map((e) => `${e.studentId}_${e.admissionRoll}`));

  const rows: PreviewRow[] = entries.map((entry) => {
    const candidates = byRoll.get(entry.admissionRoll) || [];
    const { student, ambiguous } = pickStudent(candidates, sessionCourseIds);
    if (ambiguous) {
      return { ...entry, status: "PARSING_ERROR", reason: "একাধিক শিক্ষার্থী একই ভর্তি রোল ব্যবহার করছে — সঠিকভাবে সনাক্ত করা যায়নি" };
    }
    if (!student) return { ...entry, status: "NOT_FOUND" };

    const base: PreviewRow = {
      ...entry,
      studentId: String(student._id),
      studentName: student.name,
      studentRoll: student.currentRollNumber,
      phone: student.phone,
      batchId: student.currentBatchId ? String(student.currentBatchId) : undefined,
      batchName: student.currentBatchId ? batchNameById.get(String(student.currentBatchId)) : undefined,
      status: "MATCHED",
    };
    if (existingKeys.has(`${student._id}_${entry.admissionRoll}`)) return { ...base, status: "ALREADY_IMPORTED" };
    return base;
  });

  return { rows, batchNameById };
}

function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function saveFile(buffer: Buffer, originalName: string): string {
  ensureUploadDir();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${safeName}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);
  return path.join("uploads", "admission-results", fileName);
}

export interface UploadPreviewResult {
  import: { id: string; fileName: string; status: string; parseMethod: string; totalPdfRolls: number; matchedCount: number; unmatchedCount: number; duplicateCount: number; errorCount: number };
  rows: PreviewRow[];
}

/**
 * Upload → parse → match, and persist an AdmissionResultImport in
 * "preview_ready" status — nothing is written to AdmissionResult yet (§6:
 * "do not save immediately"). confirmImport() re-parses the same saved
 * file and re-matches from scratch rather than trusting this response, so
 * nothing here needs to be cached beyond the file itself.
 */
export async function uploadAndPreview(
  req: Request,
  file: { buffer: Buffer; originalname: string },
  body: { programId?: string; sessionId: string; resultRound: (typeof RESULT_ROUNDS)[number] },
): Promise<UploadPreviewResult> {
  assertAdmin(req);

  const session = await AcademicSession.findById(body.sessionId);
  if (!session) throw ApiError.badRequest("Invalid session");
  let programName: string | undefined;
  if (body.programId) {
    const course = await Course.findById(body.programId);
    if (!course) throw ApiError.badRequest("Invalid program");
    programName = course.name;
  }

  const parsed = await parseAdmissionResultPdf(file.buffer);
  if (parsed.entries.length === 0 && parsed.errors.length === 0) {
    throw ApiError.badRequest("পিডিএফ থেকে কোনো ভর্তি রোল পাওয়া যায়নি — ফাইলটি সঠিক কিনা যাচাই করুন।");
  }

  const { rows } = await buildPreviewRows(parsed.entries, body.sessionId, session.name, body.resultRound);

  const filePath = saveFile(file.buffer, file.originalname);

  const unmatchedRolls: UnmatchedRoll[] = rows
    .filter((r) => r.status === "NOT_FOUND")
    .map((r) => ({
      admissionRoll: r.admissionRoll,
      instituteName: r.instituteName,
      instituteCode: r.instituteCode,
      seatCapacity: r.seatCapacity,
      selectionType: r.selectionType,
      resolved: false,
    }));

  const counts = {
    matched: rows.filter((r) => r.status === "MATCHED").length,
    duplicate: rows.filter((r) => r.status === "ALREADY_IMPORTED").length,
    error: rows.filter((r) => r.status === "PARSING_ERROR").length + parsed.errors.length,
  };

  const doc = await AdmissionResultImport.create({
    fileName: file.originalname,
    filePath,
    programId: body.programId,
    programName,
    sessionId: body.sessionId,
    sessionName: session.name,
    resultRound: body.resultRound,
    parseMethod: parsed.method,
    totalPdfRolls: rows.length,
    matchedCount: counts.matched,
    unmatchedCount: unmatchedRolls.length,
    duplicateCount: counts.duplicate,
    errorCount: counts.error,
    status: "preview_ready",
    unmatchedRolls,
    parseErrors: parsed.errors,
    uploadedBy: req.user!.id,
  });

  await recordAudit({ req, action: "admission-result.upload-preview", module: "admission-results", targetCollection: "admissionresultimports", targetId: String(doc._id), after: { fileName: file.originalname, totalPdfRolls: rows.length, ...counts } });

  return {
    import: {
      id: String(doc._id),
      fileName: doc.fileName,
      status: doc.status,
      parseMethod: doc.parseMethod,
      totalPdfRolls: doc.totalPdfRolls,
      matchedCount: doc.matchedCount,
      unmatchedCount: doc.unmatchedCount,
      duplicateCount: doc.duplicateCount,
      errorCount: doc.errorCount,
    },
    rows,
  };
}

async function getImportOrThrow(importId: string) {
  const doc = await AdmissionResultImport.findById(importId);
  if (!doc) throw ApiError.notFound("Import not found");
  return doc;
}

/** Re-parses the saved file and re-matches against the CURRENT database state, then writes real AdmissionResult rows for everything that's still genuinely new (§6/§7 — confirm is the only place data is actually committed, and it never trusts a client-held copy of the preview). */
export async function confirmImport(req: Request, importId: string): Promise<{ imported: number; skipped: number }> {
  assertAdmin(req);
  const importDoc = await getImportOrThrow(importId);
  if (importDoc.status !== "preview_ready") throw ApiError.conflict("This import has already been confirmed or cancelled");
  if (!importDoc.filePath) throw ApiError.internal("Import file missing");

  const buffer = fs.readFileSync(path.join(process.cwd(), importDoc.filePath));
  const parsed = await parseAdmissionResultPdf(buffer);
  const { rows } = await buildPreviewRows(parsed.entries, importDoc.sessionId ? String(importDoc.sessionId) : undefined, importDoc.sessionName, importDoc.resultRound);

  const toInsert = rows.filter((r) => r.status === "MATCHED");
  let imported = 0;
  for (const row of toInsert) {
    try {
      await AdmissionResult.create({
        studentId: row.studentId,
        studentRoll: row.studentRoll,
        studentName: row.studentName,
        phone: row.phone,
        batchId: row.batchId,
        batchName: row.batchName,
        admissionRoll: row.admissionRoll,
        programId: importDoc.programId,
        programName: row.programName || importDoc.programName || "—",
        session: row.sessionLabel || importDoc.sessionName,
        instituteName: row.instituteName,
        instituteCode: row.instituteCode,
        seatCapacity: row.seatCapacity,
        selectionType: row.selectionType,
        resultRound: importDoc.resultRound,
        sourceImportId: importDoc._id,
        sourcePdf: importDoc.filePath,
        importedBy: req.user!.id,
      });
      imported++;
    } catch (err) {
      // Unique-index race (e.g. another confirm running concurrently) — treat as already-imported rather than failing the whole batch.
      logger.warn({ err, admissionRoll: row.admissionRoll }, "Skipped a row during admission-result confirm");
    }
  }

  const unmatchedRolls: UnmatchedRoll[] = rows
    .filter((r) => r.status === "NOT_FOUND")
    .map((r) => ({ admissionRoll: r.admissionRoll, instituteName: r.instituteName, instituteCode: r.instituteCode, seatCapacity: r.seatCapacity, selectionType: r.selectionType, resolved: false }));

  importDoc.matchedCount = imported;
  importDoc.duplicateCount = rows.filter((r) => r.status === "ALREADY_IMPORTED").length;
  importDoc.unmatchedCount = unmatchedRolls.length;
  importDoc.unmatchedRolls = unmatchedRolls;
  importDoc.errorCount = rows.filter((r) => r.status === "PARSING_ERROR").length + parsed.errors.length;
  importDoc.parseErrors = parsed.errors;
  importDoc.status = "confirmed";
  importDoc.completedAt = new Date();
  await importDoc.save();

  await recordAudit({ req, action: "admission-result.confirm-import", module: "admission-results", targetCollection: "admissionresultimports", targetId: importId, after: { imported, skipped: rows.length - imported } });

  return { imported, skipped: rows.length - imported };
}

export async function cancelImport(req: Request, importId: string): Promise<void> {
  assertAdmin(req);
  const importDoc = await getImportOrThrow(importId);
  if (importDoc.status !== "preview_ready") throw ApiError.conflict("Only a not-yet-confirmed import can be cancelled");
  if (importDoc.filePath) {
    try { fs.unlinkSync(path.join(process.cwd(), importDoc.filePath)); } catch { /* best-effort cleanup */ }
  }
  await importDoc.deleteOne();
  await recordAudit({ req, action: "admission-result.cancel-import", module: "admission-results", targetCollection: "admissionresultimports", targetId: importId });
}

/** Admin-only rollback of a confirmed import — deletes every AdmissionResult it produced (§26 "delete/rollback imported result if existing architecture supports it"). */
export async function rollbackImport(req: Request, importId: string): Promise<{ deleted: number }> {
  assertAdmin(req);
  const importDoc = await getImportOrThrow(importId);
  if (importDoc.status !== "confirmed") throw ApiError.conflict("Only a confirmed import can be rolled back");
  const { deletedCount } = await AdmissionResult.deleteMany({ sourceImportId: importDoc._id });
  await recordAudit({ req, action: "admission-result.rollback-import", module: "admission-results", targetCollection: "admissionresults", targetId: importId, before: { deletedCount } });
  await importDoc.deleteOne();
  return { deleted: deletedCount || 0 };
}

/** Shared filter builder for listChanceStudents/getStats/getInstitutesSummary — course/session/institute/round/selection scope, plus the server-enforced batch-director restriction. */
async function buildResultFilter(req: Request, query: Record<string, unknown>): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = {};
  if (query.programName) filter.programName = query.programName;
  if (query.session) filter.session = query.session;
  if (query.instituteName) filter.instituteName = query.instituteName;
  if (query.resultRound) filter.resultRound = query.resultRound;
  if (query.selectionType) filter.selectionType = query.selectionType;

  const scope = await resolveBatchScope(req);
  if (query.batchId === "unassigned") filter.batchId = { $exists: false };
  else if (query.batchId) filter.batchId = query.batchId;
  if (scope) {
    // A Batch Director's own scope always wins over anything a manipulated request might send — never merged, always the final word.
    filter.batchId = filter.batchId && scope.includes(String(filter.batchId)) ? filter.batchId : { $in: scope };
  }
  return filter;
}

export async function listChanceStudents(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { importedAt: -1 });
  const filter = await buildResultFilter(req, req.query as Record<string, unknown>);
  if (req.query.search && typeof req.query.search === "string" && req.query.search.trim()) {
    const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [{ studentName: regex }, { studentRoll: regex }, { admissionRoll: regex }, { phone: regex }, { instituteName: regex }];
  }

  const [items, total] = await Promise.all([
    AdmissionResult.find(filter).sort(sort).skip(skip).limit(limit),
    AdmissionResult.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getStats(req: Request) {
  const filter = await buildResultFilter(req, req.query as Record<string, unknown>);

  const [results, instituteNames] = await Promise.all([
    AdmissionResult.find(filter).select("selectionType batchId"),
    AdmissionResult.distinct("instituteName", filter),
  ]);

  const merit = results.filter((r) => r.selectionType === "Merit").length;
  const tribal = results.filter((r) => r.selectionType === "Tribal").length;

  // "Total Students" — the relevant ERP population for the same batch scope
  // (and program, when the Student.course free-text field can express it),
  // so Chance Rate means something even when no batch/program filter is
  // active (falls back to every student in scope).
  const scope = await resolveBatchScope(req);
  const studentFilter: Record<string, unknown> = {};
  if (req.query.batchId === "unassigned") studentFilter.currentBatchId = { $exists: false };
  else if (req.query.batchId) studentFilter.currentBatchId = req.query.batchId;
  if (scope) studentFilter.currentBatchId = studentFilter.currentBatchId && scope.includes(String(studentFilter.currentBatchId)) ? studentFilter.currentBatchId : { $in: scope };
  if (req.query.programName) studentFilter.course = req.query.programName;

  const totalStudents = await Student.countDocuments(studentFilter);
  const chance = results.length;

  // Unmatched count for the current scope — only really meaningful once a
  // program/session is selected (imports are per-session), so this counts
  // unresolved unmatchedRolls across matching, non-cancelled imports.
  const importFilter: Record<string, unknown> = { status: { $ne: "cancelled" } };
  if (req.query.session) importFilter.sessionName = req.query.session;
  if (req.query.programName) importFilter.programName = req.query.programName;
  const imports = await AdmissionResultImport.find(importFilter).select("unmatchedRolls");
  const unmatched = imports.reduce((sum, imp) => sum + imp.unmatchedRolls.filter((u) => !u.resolved).length, 0);

  return {
    totalStudents,
    chance,
    chanceRate: totalStudents > 0 ? Math.round((chance / totalStudents) * 10000) / 100 : 0,
    totalInstitutes: instituteNames.length,
    merit,
    tribal,
    unmatched,
  };
}

export async function getInstitutesSummary(req: Request) {
  const filter = await buildResultFilter(req, req.query as Record<string, unknown>);
  const rows = await AdmissionResult.aggregate<{ _id: string; selected: number; seatCapacity: number; instituteCode?: string }>([
    { $match: filter },
    { $sort: { importedAt: -1 } },
    {
      $group: {
        _id: "$instituteName",
        selected: { $sum: 1 },
        seatCapacity: { $first: "$seatCapacity" },
        instituteCode: { $first: "$instituteCode" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ instituteName: r._id, instituteCode: r.instituteCode, seatCapacity: r.seatCapacity, selected: r.selected }));
}

export async function getBatchesSummary(req: Request) {
  const filter = await buildResultFilter(req, req.query as Record<string, unknown>);
  const rows = await AdmissionResult.aggregate<{ _id: Types.ObjectId | null; selected: number; batchName?: string }>([
    { $match: filter },
    { $group: { _id: "$batchId", selected: { $sum: 1 }, batchName: { $first: "$batchName" } } },
  ]);

  const scope = await resolveBatchScope(req);
  const results = [];
  for (const r of rows) {
    if (!r._id) continue;
    const studentFilter: Record<string, unknown> = { currentBatchId: r._id };
    if (req.query.programName) studentFilter.course = req.query.programName;
    const total = await Student.countDocuments(studentFilter);
    results.push({
      batchId: String(r._id),
      batchName: r.batchName || "—",
      totalStudents: total,
      selected: r.selected,
      chanceRate: total > 0 ? Math.round((r.selected / total) * 10000) / 100 : 0,
    });
  }
  // A Batch Director only ever sees their own batch(es) here too — buildResultFilter already scoped the underlying rows, this just guards the case where no result rows exist yet for their batch.
  return scope ? results.filter((r) => scope.includes(r.batchId)) : results;
}

export async function getInstituteOptions(req: Request): Promise<string[]> {
  const filter = await buildResultFilter(req, {});
  return AdmissionResult.distinct("instituteName", filter);
}

/**
 * Filter-dropdown options sourced from the actual imported data rather than
 * ERP master data (Course/AcademicSession) — a PDF's own detected program
 * title ("BSc. in Nursing") does not have to match how a Course happens to
 * be named in this ERP, so the Program/Session filters must offer exactly
 * the values that exist on AdmissionResult rows, not a guess at them.
 */
export async function getFilterOptions(req: Request): Promise<{ programs: string[]; sessions: string[]; institutes: string[] }> {
  const filter = await buildResultFilter(req, {});
  const [programs, sessions, institutes] = await Promise.all([
    AdmissionResult.distinct("programName", filter),
    AdmissionResult.distinct("session", filter),
    AdmissionResult.distinct("instituteName", filter),
  ]);
  return { programs: programs.sort(), sessions: sessions.sort(), institutes: institutes.sort() };
}

export async function getStudentHistory(req: Request, studentId: string) {
  const scope = await resolveBatchScope(req);
  if (scope) {
    const student = await Student.findById(studentId).select("currentBatchId");
    if (!student?.currentBatchId || !scope.includes(String(student.currentBatchId))) {
      throw ApiError.forbidden("You do not have permission to access this student.");
    }
  }
  const rows = await AdmissionResult.find({ studentId }).sort({ importedAt: -1 });
  const finalRow = rows.find((r) => r.resultRound === "Final") || rows[0] || null;
  return { history: rows, current: finalRow };
}

export async function listImportHistory(req: Request) {
  assertAdmin(req);
  const { page, limit, skip, sort } = parsePagination(req, { uploadedAt: -1 });
  const [items, total] = await Promise.all([
    AdmissionResultImport.find().sort(sort).skip(skip).limit(limit),
    AdmissionResultImport.countDocuments(),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getImportDetail(req: Request, importId: string) {
  assertAdmin(req);
  return getImportOrThrow(importId);
}

/** Manual match flow (§24): an admin resolves one unmatched roll by hand-picking the correct ERP student, creating the same kind of AdmissionResult a normal confirm would have. */
export async function matchUnmatchedRoll(req: Request, importId: string, rollIndex: number, studentId: string): Promise<AdmissionResultDoc> {
  assertAdmin(req);
  const importDoc = await getImportOrThrow(importId);
  const entry = importDoc.unmatchedRolls[rollIndex];
  if (!entry) throw ApiError.notFound("Unmatched roll not found");
  if (entry.resolved) throw ApiError.conflict("This roll has already been matched");

  const student = await Student.findById(studentId);
  if (!student) throw ApiError.notFound("Student not found");

  const batch = student.currentBatchId ? await Batch.findById(student.currentBatchId).select("name") : null;
  const admissionRoll = toAsciiDigits(entry.admissionRoll).trim();

  const doc = await AdmissionResult.create({
    studentId: student._id,
    studentRoll: student.currentRollNumber,
    studentName: student.name,
    phone: student.phone,
    batchId: student.currentBatchId,
    batchName: batch?.name,
    admissionRoll,
    programId: importDoc.programId,
    programName: importDoc.programName || "—",
    session: importDoc.sessionName,
    instituteName: entry.instituteName,
    instituteCode: entry.instituteCode,
    seatCapacity: entry.seatCapacity,
    selectionType: entry.selectionType,
    resultRound: importDoc.resultRound,
    sourceImportId: importDoc._id,
    sourcePdf: importDoc.filePath,
    matchedManually: true,
    matchedBy: req.user!.id,
    matchedAt: new Date(),
    importedBy: req.user!.id,
  });

  entry.resolved = true;
  entry.resolvedStudentId = student._id as unknown as Types.ObjectId;
  entry.resolvedBy = req.user!.id as unknown as Types.ObjectId;
  entry.resolvedAt = new Date();
  importDoc.unmatchedCount = importDoc.unmatchedRolls.filter((u) => !u.resolved).length;
  importDoc.matchedCount += 1;
  await importDoc.save();

  await recordAudit({ req, action: "admission-result.manual-match", module: "admission-results", targetCollection: "admissionresults", targetId: String(doc._id), after: { studentId, admissionRoll } });

  return doc;
}
