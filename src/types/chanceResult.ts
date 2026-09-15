/**
 * Admission Result Management (Chance Result) — the PDF-import "who got a
 * chance" pipeline built on top of the existing Admission Roll bookkeeping
 * (Student.admissionRoll, see types/admissionResult.ts). Deliberately a
 * separate file/feature name from that one: that page is where a roll
 * number is typed in for a student; this one is where an official result
 * PDF is uploaded, matched, and turned into permanent "Chance Student"
 * records. Mirrors backend/src/modules/admissionResults/admissionResult.model.ts.
 */

export const SELECTION_TYPES = ["Merit", "Tribal"] as const;
export type SelectionType = (typeof SELECTION_TYPES)[number];

export const RESULT_ROUNDS = ["1st Merit", "2nd Merit", "3rd Merit", "Migration", "Final"] as const;
export type ResultRound = (typeof RESULT_ROUNDS)[number];

/** A permanent "this ERP student got a chance" record. Never overwritten across rounds. */
export interface ChanceResult {
  _id: string;
  studentId: string;
  studentRoll?: string;
  studentName: string;
  phone: string;
  batchId?: string;
  batchName?: string;
  admissionRoll: string;
  programId?: string;
  programName: string;
  session: string;
  instituteName: string;
  instituteCode?: string;
  seatCapacity?: number;
  selectionType: SelectionType;
  resultRound: ResultRound;
  resultStatus: "SELECTED";
  sourceImportId: string;
  sourcePdf?: string;
  matchedManually: boolean;
  matchedBy?: string;
  matchedAt?: string;
  importedBy?: string;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChanceResultStats {
  totalStudents: number;
  chance: number;
  chanceRate: number;
  totalInstitutes: number;
  merit: number;
  tribal: number;
  unmatched: number;
}

export interface InstituteSummaryRow {
  instituteName: string;
  instituteCode?: string;
  seatCapacity?: number;
  selected: number;
}

export interface BatchSummaryRow {
  batchId: string;
  batchName: string;
  totalStudents: number;
  selected: number;
  chanceRate: number;
}

export interface UnmatchedRollEntry {
  admissionRoll: string;
  instituteName: string;
  instituteCode?: string;
  seatCapacity?: number;
  selectionType: SelectionType;
  resolved: boolean;
  resolvedStudentId?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface ParseErrorEntry {
  raw: string;
  reason: string;
}

export interface ImportRecord {
  _id: string;
  fileName: string;
  filePath?: string;
  programId?: string;
  programName?: string;
  sessionId?: string;
  sessionName: string;
  resultRound: ResultRound;
  parseMethod: "text" | "ocr";
  totalPdfRolls: number;
  matchedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  errorCount: number;
  status: "preview_ready" | "confirmed" | "cancelled";
  unmatchedRolls: UnmatchedRollEntry[];
  parseErrors: ParseErrorEntry[];
  uploadedBy: string;
  uploadedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PreviewStatus = "MATCHED" | "NOT_FOUND" | "ALREADY_IMPORTED" | "PARSING_ERROR";

export interface PreviewRow {
  admissionRoll: string;
  instituteName: string;
  instituteCode?: string;
  seatCapacity?: number;
  selectionType: SelectionType;
  programName?: string;
  sessionLabel?: string;
  status: PreviewStatus;
  reason?: string;
  studentId?: string;
  studentName?: string;
  studentRoll?: string;
  phone?: string;
  batchId?: string;
  batchName?: string;
}

export interface UploadPreviewResult {
  import: {
    id: string;
    fileName: string;
    status: string;
    parseMethod: string;
    totalPdfRolls: number;
    matchedCount: number;
    unmatchedCount: number;
    duplicateCount: number;
    errorCount: number;
  };
  rows: PreviewRow[];
}

export interface ChanceResultListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StudentAdmissionHistory {
  history: ChanceResult[];
  current: ChanceResult | null;
}
