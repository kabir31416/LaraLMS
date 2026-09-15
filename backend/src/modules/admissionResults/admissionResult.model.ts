import { Schema, model, Document, Types } from "mongoose";

export const SELECTION_TYPES = ["Merit", "Tribal"] as const;
export const RESULT_ROUNDS = ["1st Merit", "2nd Merit", "3rd Merit", "Migration", "Final"] as const;

/**
 * A single "this ERP student got a chance" record, produced by matching an
 * official admission-result PDF's admission rolls against the existing
 * Admission Roll data on Student (Student.admissionRoll — the feature this
 * module is built on top of, never duplicated here). A student can
 * legitimately accumulate several of these across rounds (1st Merit,
 * Migration, Final, ...) — never overwritten, per the "preserve result
 * history" requirement.
 *
 * Fields are intentionally a snapshot (studentRoll/studentName/phone/
 * batchName/programName) rather than a pure live join — this mirrors the
 * existing app's own convention (see Payment.batchId/courseId's "snapshot,
 * reporting only" comment) so an import's result reads correctly even if
 * the student's roll/batch/name is edited afterward, while `studentId` is
 * still kept for real joins (Student Profile history, aggregation).
 */
export interface AdmissionResultDoc extends Document {
  studentId: Types.ObjectId;
  studentRoll?: string;
  studentName: string;
  phone: string;
  batchId?: Types.ObjectId;
  batchName?: string;

  admissionRoll: string;
  programId?: Types.ObjectId; // -> Course, the import's admin-selected program (may be absent if the PDF text itself named a different program — see programName)
  programName: string; // the program name actually in effect for this row — from the PDF's own detected title when present, else the import's selected program name
  session: string; // e.g. "2025-2026" — detected from the PDF when present, else the import's selected AcademicSession name

  instituteName: string;
  instituteCode?: string;
  seatCapacity?: number;
  selectionType: (typeof SELECTION_TYPES)[number];
  resultRound: (typeof RESULT_ROUNDS)[number];

  /** Always "SELECTED" today — see pdfParser/admissionResult.service's comments on why a missing roll is never turned into an automatic "not selected" conclusion (§8 of the spec). */
  resultStatus: "SELECTED";

  sourceImportId: Types.ObjectId;
  sourcePdf?: string;

  matchedManually: boolean;
  matchedBy?: Types.ObjectId;
  matchedAt?: Date;

  importedBy?: Types.ObjectId;
  importedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const admissionResultSchema = new Schema<AdmissionResultDoc>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    studentRoll: { type: String, trim: true },
    studentName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    batchName: { type: String, trim: true },

    admissionRoll: { type: String, required: true, trim: true },
    programId: { type: Schema.Types.ObjectId, ref: "Course" },
    programName: { type: String, required: true, trim: true },
    session: { type: String, required: true, trim: true },

    instituteName: { type: String, required: true, trim: true },
    instituteCode: { type: String, trim: true },
    seatCapacity: { type: Number },
    selectionType: { type: String, enum: SELECTION_TYPES, required: true },
    resultRound: { type: String, enum: RESULT_ROUNDS, required: true },

    resultStatus: { type: String, enum: ["SELECTED"], default: "SELECTED" },

    sourceImportId: { type: Schema.Types.ObjectId, ref: "AdmissionResultImport", required: true },
    sourcePdf: { type: String, trim: true },

    matchedManually: { type: Boolean, default: false },
    matchedBy: { type: Schema.Types.ObjectId, ref: "User" },
    matchedAt: { type: Date },

    importedBy: { type: Schema.Types.ObjectId, ref: "User" },
    importedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Duplicate-import prevention (§7) — the same student can't be recorded
// twice for the same session+round+admission-roll. A student normally only
// ever has one admission roll for one round anyway; this also backstops
// re-importing the exact same PDF a second time.
admissionResultSchema.index({ studentId: 1, session: 1, resultRound: 1, admissionRoll: 1 }, { unique: true });
admissionResultSchema.index({ sourceImportId: 1 });
admissionResultSchema.index({ instituteName: 1 });
admissionResultSchema.index({ batchId: 1 });
admissionResultSchema.index({ programName: 1, session: 1 });

export const AdmissionResult = model<AdmissionResultDoc>("AdmissionResult", admissionResultSchema);

// -------------------- Import History --------------------

export interface UnmatchedRoll {
  admissionRoll: string;
  instituteName: string;
  instituteCode?: string;
  seatCapacity?: number;
  selectionType: (typeof SELECTION_TYPES)[number];
  resolved: boolean;
  resolvedStudentId?: Types.ObjectId;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
}

const unmatchedRollSchema = new Schema<UnmatchedRoll>(
  {
    admissionRoll: { type: String, required: true, trim: true },
    instituteName: { type: String, required: true, trim: true },
    instituteCode: { type: String, trim: true },
    seatCapacity: { type: Number },
    selectionType: { type: String, enum: SELECTION_TYPES, required: true },
    resolved: { type: Boolean, default: false },
    resolvedStudentId: { type: Schema.Types.ObjectId, ref: "Student" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { _id: false },
);

export interface ParseErrorEntry {
  raw: string;
  reason: string;
}

export interface AdmissionResultImportDoc extends Document {
  fileName: string;
  filePath?: string;
  programId?: Types.ObjectId;
  programName?: string; // the admin's selected label for the whole import — individual rows may carry a different detected programName (multi-program PDFs)
  sessionId?: Types.ObjectId;
  sessionName: string;
  resultRound: (typeof RESULT_ROUNDS)[number];

  parseMethod: "text" | "ocr";
  totalPdfRolls: number;
  matchedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  errorCount: number;

  status: "preview_ready" | "confirmed" | "cancelled";
  unmatchedRolls: UnmatchedRoll[];
  parseErrors: ParseErrorEntry[];

  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const admissionResultImportSchema = new Schema<AdmissionResultImportDoc>(
  {
    fileName: { type: String, required: true, trim: true },
    filePath: { type: String, trim: true },
    programId: { type: Schema.Types.ObjectId, ref: "Course" },
    programName: { type: String, trim: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
    sessionName: { type: String, required: true, trim: true },
    resultRound: { type: String, enum: RESULT_ROUNDS, required: true },

    parseMethod: { type: String, enum: ["text", "ocr"], required: true },
    totalPdfRolls: { type: Number, default: 0 },
    matchedCount: { type: Number, default: 0 },
    unmatchedCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },

    status: { type: String, enum: ["preview_ready", "confirmed", "cancelled"], default: "preview_ready" },
    unmatchedRolls: { type: [unmatchedRollSchema], default: [] },
    parseErrors: { type: [{ raw: String, reason: String }], default: [] },

    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploadedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

admissionResultImportSchema.index({ uploadedAt: -1 });

export const AdmissionResultImport = model<AdmissionResultImportDoc>("AdmissionResultImport", admissionResultImportSchema);
