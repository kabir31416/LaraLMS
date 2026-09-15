import { Schema, model, Document, Types } from "mongoose";

/**
 * Bulk Student Upload — one document per uploaded Excel file. Rows live in
 * their own collection (StudentImportRow) rather than embedded here, so
 * approving/rejecting one row is a single targeted update on its own
 * document instead of a positional update against a growing embedded array
 * on a session shared by every other row's concurrent approval.
 *
 * UPLOAD/PREVIEW NEVER CREATES A STUDENT — this document (and its rows) is
 * the only thing the upload step writes. A row only becomes a real Student
 * when an admin explicitly approves it (studentImport.service.ts's
 * approveRow), which calls the existing student.service.ts `create()` —
 * never a parallel creation path.
 *
 * The original uploaded file is never persisted to disk (parsed once in
 * memory, then discarded) — re-validation at approval time re-queries
 * Course/Student master data fresh rather than re-parsing the file, so
 * there is no need to keep the raw spreadsheet (which would otherwise be
 * unnecessary-to-retain student PII sitting on disk — §8/§19 of the spec).
 */
export const IMPORT_SESSION_STATUS = ["processing", "ready", "completed", "failed"] as const;

export interface StudentImportSessionDoc extends Document {
  originalFileName: string;
  uploadedBy: Types.ObjectId; // -> User
  uploadedAt: Date;

  totalRows: number;
  validRows: number; // VALID + WARNING at upload time (approvable)
  errorRows: number; // ERROR at upload time (not approvable until fixed — this MVP has no in-place row edit, so an ERROR row must be rejected and the corrected student re-uploaded in a future import)

  pendingRows: number;
  approvedRows: number;
  rejectedRows: number;
  failedRows: number;

  status: (typeof IMPORT_SESSION_STATUS)[number];

  createdAt: Date;
  updatedAt: Date;
}

const studentImportSessionSchema = new Schema<StudentImportSessionDoc>(
  {
    originalFileName: { type: String, required: true, trim: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploadedAt: { type: Date, default: Date.now },

    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    errorRows: { type: Number, default: 0 },

    pendingRows: { type: Number, default: 0 },
    approvedRows: { type: Number, default: 0 },
    rejectedRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },

    status: { type: String, enum: IMPORT_SESSION_STATUS, default: "processing" },
  },
  { timestamps: true },
);

studentImportSessionSchema.index({ uploadedAt: -1 });

export const StudentImportSession = model<StudentImportSessionDoc>("StudentImportSession", studentImportSessionSchema);
