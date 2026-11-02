import { Schema, model, Document, Types } from "mongoose";
import { SETTLEMENT_STATUS } from "../mess.constants";

/**
 * Final leaving settlement:
 *   Security Deposit + Advance Balance − Outstanding Due − Approved Damage/Other
 *   = Refundable Amount (negative ⇒ the student still owes that much).
 * Every figure is (re)computed server-side from the live ledger at creation
 * and again at completion — client-supplied totals are never trusted.
 */
export interface MessSettlementDoc extends Document {
  settlementNo: string;
  membershipId: Types.ObjectId;
  studentId: Types.ObjectId;
  messId: Types.ObjectId;
  leavingDate: string;
  depositBalance: number;
  advanceBalance: number;
  outstandingDue: number;
  damageCharges: number;
  damageNote?: string;
  depositApplied: number;
  depositRefund: number;
  advanceRefund: number;
  refundableAmount: number;
  /** max(0, −refundableAmount) — still owed by the student after the deposit is used up. */
  remainingDue: number;
  status: (typeof SETTLEMENT_STATUS)[number];
  /** Equal to membershipId while not cancelled — unique, so one membership can't have two live settlements. */
  activeKey?: string;
  refundMethod?: string;
  refundDate?: string;
  refundReference?: string;
  notes?: string;
  createdBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  completedBy?: Types.ObjectId;
  completedAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const messSettlementSchema = new Schema<MessSettlementDoc>(
  {
    settlementNo: { type: String, required: true, unique: true, immutable: true },
    membershipId: { type: Schema.Types.ObjectId, ref: "MessMembership", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    leavingDate: { type: String, required: true },
    depositBalance: { type: Number, default: 0 },
    advanceBalance: { type: Number, default: 0 },
    outstandingDue: { type: Number, default: 0 },
    damageCharges: { type: Number, default: 0, min: 0 },
    damageNote: { type: String, trim: true },
    depositApplied: { type: Number, default: 0 },
    depositRefund: { type: Number, default: 0 },
    advanceRefund: { type: Number, default: 0 },
    refundableAmount: { type: Number, default: 0 },
    remainingDue: { type: Number, default: 0 },
    status: { type: String, enum: SETTLEMENT_STATUS, default: "pending" },
    activeKey: { type: String },
    refundMethod: { type: String, trim: true },
    refundDate: { type: String },
    refundReference: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    completedAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelReason: { type: String, trim: true },
  },
  { timestamps: true },
);

messSettlementSchema.index({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $exists: true } } });
messSettlementSchema.index({ messId: 1, createdAt: -1 });
messSettlementSchema.index({ membershipId: 1 });

export const MessSettlement = model<MessSettlementDoc>("MessSettlement", messSettlementSchema);
