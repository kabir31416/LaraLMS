import { Schema, model, Document, Types } from "mongoose";
import { MESS_PAYMENT_PURPOSE, MessPaymentPurpose } from "../mess.constants";

/**
 * Money received for the Mess. Deliberately its own collection, NOT the
 * existing tuition `Payment` collection: Payment.create() recomputes the
 * student's tuition due/paid and every Fee Management / Dashboard / Report
 * total sums Payment rows as course-fee income, so Mess money stored there
 * would silently inflate Course Fee collections. This collection follows the
 * same conventions instead — atomic immutable receipt number, client
 * idempotency key with a unique index, soft cancellation, method validated
 * against the shared PaymentMethod master data.
 */
export interface MessPaymentDoc extends Document {
  receiptNo: string;
  studentId: Types.ObjectId;
  membershipId?: Types.ObjectId;
  /** Set for an advance taken against a reservation; membershipId is filled in when the reservation becomes a membership. */
  reservationId?: Types.ObjectId;
  messId: Types.ObjectId;
  purpose: MessPaymentPurpose;
  amount: number;
  method: string;
  date: string; // yyyy-mm-dd
  reference?: string; // bKash/Nagad trx id, bank slip no, ...
  note?: string;
  idempotencyKey?: string;
  /**
   * How this receipt splits between the dining-charge ledger and the
   * advance/deposit. Always written for new payments; for older rows
   * (pre-split) the purpose alone decides — see PAYMENT_PORTION in
   * messLedger.service.ts.
   */
  allocation?: { rent: number; deposit: number };
  /** "yyyy-mm" the payment was taken against (operator's choice; FIFO still settles the oldest due first). */
  billingMonth?: string;
  /** Dining-charge due immediately BEFORE this payment — receipt snapshot ("previous due"). */
  dueBefore?: number;
  /** Balances immediately after this payment — receipt snapshot, never recomputed. */
  balanceAfter?: { due: number; advance: number; depositBalance: number };
  status: "active" | "cancelled";
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancelReason?: string;
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const messPaymentSchema = new Schema<MessPaymentDoc>(
  {
    receiptNo: { type: String, required: true, unique: true, immutable: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    membershipId: { type: Schema.Types.ObjectId, ref: "MessMembership" },
    reservationId: { type: Schema.Types.ObjectId, ref: "MessReservation" },
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    purpose: { type: String, enum: MESS_PAYMENT_PURPOSE, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    reference: { type: String, trim: true },
    note: { type: String, trim: true },
    idempotencyKey: { type: String },
    allocation: { rent: Number, deposit: Number },
    billingMonth: { type: String },
    dueBefore: { type: Number },
    balanceAfter: {
      due: Number,
      advance: Number,
      depositBalance: Number,
    },
    status: { type: String, enum: ["active", "cancelled"], default: "active" },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelReason: { type: String, trim: true },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Many payments per student are normal — never unique on studentId. Only an
// identical client submission attempt (double-click/retry) is rejected.
messPaymentSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true } } });
messPaymentSchema.index({ membershipId: 1, status: 1 });
messPaymentSchema.index({ messId: 1, date: -1 });
messPaymentSchema.index({ studentId: 1, date: -1 });
messPaymentSchema.index({ reservationId: 1 });

export const MessPayment = model<MessPaymentDoc>("MessPayment", messPaymentSchema);
