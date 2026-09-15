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

export interface ParsedStudentRow {
  name?: string;
  phone?: string;
  dob?: string;
  rollNumber?: string;
  courseName?: string;
  courseId?: string;
  guardianMobile?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianOccupation?: string;
  bloodGroup?: string;
  presentAddress?: string;
  permanentAddress?: string;
  hscInstitution?: string;
  hscBoard?: string;
  hscPassingYear?: string;
  hscGroup?: string;
  hscGpa?: string;
  sscInstitution?: string;
  sscBoard?: string;
  sscPassingYear?: string;
  sscGroup?: string;
  sscGpa?: string;
  discount?: number;
  paid?: number;
  paymentMethod?: string;
}

export interface StudentImportSession {
  _id: string;
  originalFileName: string;
  uploadedBy: string | { _id: string; identifier: string };
  uploadedAt: string;
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
  createdPaymentId?: string;
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
