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
  feeType: (typeof FEE_TYPES)[number];
  month?: string; // for monthly-fee payments
  note?: string;
  /** "admission" marks the one payment created automatically alongside a new Student (student.service.ts's create) — everything else is a regular Fee Management transaction. */
  source: "admission" | "regular";
  admissionFeeComponent?: number; // snapshot of the fixed Admission Fee at the time of this admission payment
  courseFeeComponent?: number; // snapshot of the Course Fee at the time of this admission payment
  previousDue?: number; // the student's due immediately before this payment — auditability, never recomputed later
  createdBy?: Types.ObjectId; // -> User, whoever recorded this payment
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
    feeType: { type: String, enum: FEE_TYPES, required: true },
    month: { type: String, trim: true },
    note: { type: String, trim: true },
    source: { type: String, enum: ["admission", "regular"], default: "regular" },
    admissionFeeComponent: { type: Number, min: 0 },
    courseFeeComponent: { type: Number, min: 0 },
    previousDue: { type: Number },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

paymentSchema.index({ studentId: 1, date: -1 });
paymentSchema.index({ date: -1 });

export const Payment = model<PaymentDoc>("Payment", paymentSchema);
