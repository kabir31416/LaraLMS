import { Schema, model, Document, Types } from "mongoose";

export const ROW_VALIDATION_STATUS = ["VALID", "WARNING", "ERROR"] as const;
export const ROW_IMPORT_STATUS = ["PENDING", "PROCESSING", "APPROVED", "REJECTED", "FAILED"] as const;

/**
 * The exact subset of student.validation.ts's createStudentSchema fields a
 * spreadsheet can populate — deliberately a fixed, named allow-list (never
 * "whatever columns were in the file") so nothing an Excel file contains can
 * ever reach a protected field (password/role/isAdmin/system id — §19 of
 * the spec). `courseName` is the raw text from the sheet; `courseId` is
 * only ever filled in by server-side resolution against real Course master
 * data, never trusted from the file itself.
 */
export interface ParsedStudentRow {
  name?: string;
  phone?: string;
  dob?: string; // yyyy-MM-dd, normalized
  rollNumber?: string; // -> Student.currentRollNumber (the "previous registration/roll", NOT the system Registration ID)
  courseName?: string; // raw text from the sheet
  courseId?: string; // resolved server-side against Course master data — never from the file
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

const parsedStudentRowSchema = new Schema<ParsedStudentRow>(
  {
    name: String,
    phone: String,
    dob: String,
    rollNumber: String,
    courseName: String,
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    guardianMobile: String,
    guardianName: String,
    guardianRelation: String,
    guardianOccupation: String,
    bloodGroup: String,
    presentAddress: String,
    permanentAddress: String,
    hscInstitution: String,
    hscBoard: String,
    hscPassingYear: String,
    hscGroup: String,
    hscGpa: String,
    sscInstitution: String,
    sscBoard: String,
    sscPassingYear: String,
    sscGroup: String,
    sscGpa: String,
    discount: Number,
    paid: Number,
    paymentMethod: String,
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
  createdPaymentId?: Types.ObjectId;

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
    createdPaymentId: { type: Schema.Types.ObjectId, ref: "Payment" },

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
