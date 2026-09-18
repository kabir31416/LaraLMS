import { Schema, model, Document, Types } from "mongoose";

export const ROW_VALIDATION_STATUS = ["VALID", "WARNING", "ERROR"] as const;
export const ROW_IMPORT_STATUS = ["PENDING", "PROCESSING", "APPROVED", "REJECTED", "FAILED"] as const;

/**
 * The exact subset of student information a spreadsheet can populate —
 * deliberately a fixed, named allow-list (never "whatever columns were in
 * the file") so nothing an Excel file contains can ever reach a protected
 * field (password/role/isAdmin/system id, or Course/Batch/Fee — Excel
 * Student Information Import §5/§19).
 *
 * FINAL BUSINESS RULE: EXCEL IMPORT = STUDENT INFORMATION ONLY. There is no
 * courseName/courseId here (the admin-selected course lives once on the
 * session — studentImportSession.model.ts — never per row), no batch field
 * at all, and no discount/paid/paymentMethod — fee/payment is added later
 * through the existing Fee Management screens, never during import.
 */
export interface ParsedStudentRow {
  // Identity
  registrationNumber?: string; // new-format "Coaching Reg No" -> becomes Student.registrationId directly when present (never auto-generated in that case)
  name?: string;
  dob?: string; // yyyy-MM-dd, normalized
  phone?: string;
  gender?: string;

  // Legacy-only (pre-existing bulk import format) — the old "previous roll",
  // kept entirely separate from registrationNumber above so an old file's
  // roll value never becomes the new permanent registration ID.
  rollNumber?: string; // -> Student.currentRollNumber

  // Personal
  religion?: string;
  bloodGroup?: string;

  // Guardian
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianMobile?: string;
  guardianRelation?: string;
  guardianOccupation?: string;

  // Address
  division?: string;
  district?: string;
  upazila?: string;
  postOffice?: string;
  postcode?: string;
  village?: string;
  presentAddress?: string;
  permanentAddress?: string;

  // SSC
  sscInstitution?: string;
  sscBoard?: string;
  sscRoll?: string;
  sscRegistrationNumber?: string;
  sscGpa?: string;
  sscPassingYear?: string;
  sscGroup?: string;

  // HSC
  hscInstitution?: string;
  hscBoard?: string;
  hscRoll?: string;
  hscRegistrationNumber?: string;
  hscGpa?: string;
  hscPassingYear?: string;
  hscGroup?: string;
}

const parsedStudentRowSchema = new Schema<ParsedStudentRow>(
  {
    registrationNumber: String,
    name: String,
    dob: String,
    phone: String,
    gender: String,

    rollNumber: String,

    religion: String,
    bloodGroup: String,

    fatherName: String,
    motherName: String,
    guardianName: String,
    guardianMobile: String,
    guardianRelation: String,
    guardianOccupation: String,

    division: String,
    district: String,
    upazila: String,
    postOffice: String,
    postcode: String,
    village: String,
    presentAddress: String,
    permanentAddress: String,

    sscInstitution: String,
    sscBoard: String,
    sscRoll: String,
    sscRegistrationNumber: String,
    sscGpa: String,
    sscPassingYear: String,
    sscGroup: String,

    hscInstitution: String,
    hscBoard: String,
    hscRoll: String,
    hscRegistrationNumber: String,
    hscGpa: String,
    hscPassingYear: String,
    hscGroup: String,
  },
  { _id: false },
);

export interface StudentImportRowDoc extends Document {
  sessionId: Types.ObjectId;
  rowNumber: number; // 1-based Excel row number (header excluded), for admin-facing display

  parsed: ParsedStudentRow;

  validationStatus: (typeof ROW_VALIDATION_STATUS)[number];
  validationMessages: string[]; // human-readable, Bengali — shown per row in the preview

  /** Set when this row's phone/roll matches another row in the same file (in-file duplicate) or an existing Student (DB duplicate) — surfaced as a WARNING/ERROR message too, kept structured here for the UI to badge distinctly. */
  duplicateInFile: boolean;
  matchesExistingStudentId?: Types.ObjectId;

  importStatus: (typeof ROW_IMPORT_STATUS)[number];

  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdStudentId?: Types.ObjectId;

  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;

  failureReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const studentImportRowSchema = new Schema<StudentImportRowDoc>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "StudentImportSession", required: true },
    rowNumber: { type: Number, required: true },

    parsed: { type: parsedStudentRowSchema, required: true },

    validationStatus: { type: String, enum: ROW_VALIDATION_STATUS, required: true },
    validationMessages: { type: [String], default: [] },

    duplicateInFile: { type: Boolean, default: false },
    matchesExistingStudentId: { type: Schema.Types.ObjectId, ref: "Student" },

    importStatus: { type: String, enum: ROW_IMPORT_STATUS, default: "PENDING" },

    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    createdStudentId: { type: Schema.Types.ObjectId, ref: "Student" },

    rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true },

    failureReason: { type: String, trim: true },
  },
  { timestamps: true },
);

studentImportRowSchema.index({ sessionId: 1, rowNumber: 1 });
studentImportRowSchema.index({ sessionId: 1, importStatus: 1 });

export const StudentImportRow = model<StudentImportRowDoc>("StudentImportRow", studentImportRowSchema);
