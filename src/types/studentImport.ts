/**
 * Bulk Student Upload (Excel) — mirrors the backend's StudentImportSession /
 * StudentImportRow document shapes exactly (backend/src/modules/
 * studentImports/*.model.ts), not a frontend-renamed DTO, since this feature
 * talks to the API directly rather than going through StudentContext.
 */

export const IMPORT_SESSION_STATUS = ["processing", "ready", "completed", "failed"] as const;
export type ImportSessionStatus = (typeof IMPORT_SESSION_STATUS)[number];

export const ROW_VALIDATION_STATUS = ["VALID", "WARNING", "ERROR"] as const;
export type RowValidationStatus = (typeof ROW_VALIDATION_STATUS)[number];

export const ROW_IMPORT_STATUS = ["PENDING", "PROCESSING", "APPROVED", "REJECTED", "FAILED"] as const;
export type RowImportStatus = (typeof ROW_IMPORT_STATUS)[number];

/**
 * FINAL BUSINESS RULE: EXCEL IMPORT = STUDENT INFORMATION ONLY — there is no
 * courseName/courseId here (it lives once on StudentImportSession below,
 * the admin's UI selection, never per row), no batch field, and no
 * discount/paid/paymentMethod — fee/payment is added later via Fee
 * Management, never during import.
 */
export interface ParsedStudentRow {
  name?: string;
  dob?: string;
  phone?: string;
  gender?: string;

  /** "Coaching Reg No" (new format) or "রেজিস্ট্রেশন/পূর্বের রোল" (old format) -> Student.currentRollNumber. The system's own permanent registration ID is always auto-generated, never taken from Excel. */
  rollNumber?: string;

  religion?: string;
  bloodGroup?: string;

  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianMobile?: string;
  guardianRelation?: string;
  guardianOccupation?: string;

  division?: string;
  district?: string;
  upazila?: string;
  postOffice?: string;
  postcode?: string;
  village?: string;
  presentAddress?: string;
  permanentAddress?: string;

  sscInstitution?: string;
  sscBoard?: string;
  sscRoll?: string;
  sscRegistrationNumber?: string;
  sscGpa?: string;
  sscPassingYear?: string;
  sscGroup?: string;

  hscInstitution?: string;
  hscBoard?: string;
  hscRoll?: string;
  hscRegistrationNumber?: string;
  hscGpa?: string;
  hscPassingYear?: string;
  hscGroup?: string;
}

export interface StudentImportSession {
  _id: string;
  originalFileName: string;
  uploadedBy: string | { _id: string; identifier: string };
  uploadedAt: string;
  /** Admin-selected before upload — applied to every row in this session (structurally guarantees no course/batch mismatch). */
  courseId: string;
  courseName: string;
  /** Informational only — e.g. an old file's Course/Batch/Fee columns were found and ignored. Never blocks the import. */
  headerWarnings: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  pendingRows: number;
  approvedRows: number;
  rejectedRows: number;
  failedRows: number;
  status: ImportSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PopulatedStudentRef {
  _id: string;
  registrationId?: string;
  name?: string;
  currentRollNumber?: string;
  phone?: string;
}

export interface StudentImportRow {
  _id: string;
  sessionId: string;
  rowNumber: number;
  parsed: ParsedStudentRow;
  validationStatus: RowValidationStatus;
  validationMessages: string[];
  duplicateInFile: boolean;
  // Populated (createdStudentId/matchesExistingStudentId) on rows returned from
  // list/approve/reject — see studentImport.service.ts's findRowPopulated().
  matchesExistingStudentId?: string | PopulatedStudentRef;
  importStatus: RowImportStatus;
  approvedBy?: string;
  approvedAt?: string;
  createdStudentId?: string | PopulatedStudentRef;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentImportListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Bulk Approval — mirrors backend/src/modules/studentImports/
 * studentImport.service.ts's BulkApprovalOutcome/ResultItem/Summary exactly.
 * One request approves an entire selection; the response always carries a
 * full per-row breakdown so failed/skipped rows are never silently dropped.
 */
export const BULK_APPROVAL_OUTCOMES = ["APPROVED", "DUPLICATE", "INVALID", "FAILED", "SKIPPED"] as const;
export type BulkApprovalOutcome = (typeof BULK_APPROVAL_OUTCOMES)[number];

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

export interface ValidRowIdsResponse {
  rowIds: string[];
  count: number;
}
