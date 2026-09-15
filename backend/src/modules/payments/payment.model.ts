import { Schema, model, Document, Types } from "mongoose";
import { FEE_TYPES } from "../students/student.constants";

export interface PaymentDoc extends Document {
  receiptNo: string; // immutable, atomically generated — see idGenerators.ts
  studentId: Types.ObjectId; // -> Student
  batchId?: Types.ObjectId; // snapshot of the student's batch at payment time — reporting only, not authoritative
  courseId?: Types.ObjectId; // snapshot of the student's course at payment time — reporting only, not authoritative
  date: string; // yyyy-mm-dd
  amount: number;
  discount: number;
  fine: number;
  paidAmount: number; // = amount - discount + fine, computed server-side — never trust the client's math
  /**
   * A plain string, not a ref — validated against the real PaymentMethod
   * master-data collection at write time (paymentMethod.service.ts's
   * assertActiveMethod), but stored as the name so an existing Payment keeps
   * showing whatever method it was recorded with even after that method is
   * later renamed/deactivated in Settings (Settings §25).
   */
  method: string;
  /**
   * "ম্যাটেরিয়াল" (Material) is additive to the Student-facing FEE_TYPES
   * union — it exists only on Payment, never on Student.feeType (a
   * student's own billing plan is always tuition-based, never "material").
   * A material payment is a real Payment row (so it shows up in existing
   * Fee/Collection/Payment history) but is never folded into the tuition
   * due/paid/totalFee calculation payment.service.ts's create() otherwise
   * performs (Coaching Material Inventory §6).
   */
  feeType: (typeof FEE_TYPES)[number] | "ম্যাটেরিয়াল";
  month?: string; // for monthly-fee payments
  note?: string;
  /** "admission" marks the one payment created automatically alongside a new Student (student.service.ts's create); "material" marks one created from a paid Material distribution — everything else is a regular Fee Management transaction. */
  source: "admission" | "regular" | "material";
  admissionFeeComponent?: number; // snapshot of the fixed Admission Fee at the time of this admission payment
  courseFeeComponent?: number; // snapshot of the Course Fee at the time of this admission payment
  previousDue?: number; // the student's due immediately before this payment — auditability, never recomputed later
  createdBy?: Types.ObjectId; // -> User, whoever recorded this payment
  /**
   * Client-generated, one per submission attempt (not per student/per
   * amount — a student legitimately has many payments) — protects against
   * double-click/browser-retry/network-retry creating two Payments for the
   * same logical submission. Optional: internal call sites that create a
   * Payment as a side effect of something else (admission, bulk import,
   * paid material distribution) don't go through a click-driven form and
   * don't need one. See payment.service.ts's create().
   */
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentDoc>(
  {
    receiptNo: { type: String, required: true, unique: true, immutable: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    date: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    fine: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, required: true },
    method: { type: String, required: true, trim: true },
    feeType: { type: String, enum: [...FEE_TYPES, "ম্যাটেরিয়াল"], required: true },
    month: { type: String, trim: true },
    note: { type: String, trim: true },
    source: { type: String, enum: ["admission", "regular", "material"], default: "regular" },
    admissionFeeComponent: { type: Number, min: 0 },
    courseFeeComponent: { type: Number, min: 0 },
    previousDue: { type: Number },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    idempotencyKey: { type: String },
  },
  { timestamps: true },
);

paymentSchema.index({ studentId: 1, date: -1 });
paymentSchema.index({ date: -1 });
// Deliberately NOT `studentId: unique` (a student has many payments) — this
// only rejects two Payments sharing the exact same submission-attempt key.
// Partial (only documents that actually have the field), same convention as
// accounts/income.model.ts's own (source, refId) auto-post guard.
paymentSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true } } });

export const Payment = model<PaymentDoc>("Payment", paymentSchema);
