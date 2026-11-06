import { Schema, model, Document, Types } from "mongoose";

/**
 * Issuance record for a student's ID card — one per student. Deliberately
 * holds NO copy of the student's personal data: the card is always rendered
 * from the live Student/Course/Batch records. `fingerprint` is a hash of the
 * printed fields at issue time, so the system can tell when the student's
 * details changed and the physical card needs to be re-issued.
 */
export interface IdCardDoc extends Document {
  studentId: Types.ObjectId;
  /** 1 on first issue, +1 on every re-issue. */
  version: number;
  /** Random, unguessable code behind the QR verification link. Rotated on every re-issue. */
  verifyCode: string;
  /** Codes of earlier versions (latest 10) — a superseded printed card verifies as "replaced", not "unknown". */
  previousCodes: string[];
  fingerprint: string;
  firstIssuedAt: Date;
  generatedAt: Date;
  generatedBy?: string; // User/Staff id from the token
  createdAt: Date;
  updatedAt: Date;
}

const idCardSchema = new Schema<IdCardDoc>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, unique: true },
    version: { type: Number, required: true, min: 1 },
    verifyCode: { type: String, required: true, unique: true },
    previousCodes: { type: [String], default: [] },
    fingerprint: { type: String, required: true },
    firstIssuedAt: { type: Date, required: true },
    generatedAt: { type: Date, required: true },
    generatedBy: String,
  },
  { timestamps: true },
);

idCardSchema.index({ generatedAt: -1 });
idCardSchema.index({ previousCodes: 1 });

export const IdCard = model<IdCardDoc>("IdCard", idCardSchema);
