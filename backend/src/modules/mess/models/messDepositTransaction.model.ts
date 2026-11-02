import { Schema, model, Document, Types } from "mongoose";
import { DEPOSIT_TX_STATUS, DEPOSIT_TX_TYPES, DepositTxStatus, DepositTxType } from "../mess.constants";

/**
 * Every movement OUT of a member's security deposit. Money INTO the deposit
 * is a MessPayment with purpose "deposit" (so it gets a real receipt).
 *  - deduct:       damage / other approved charge kept by the Mess
 *  - apply_to_due: deposit used to clear outstanding rent dues
 *  - refund:       deposit paid back to the student
 */
export interface MessDepositTransactionDoc extends Document {
  txNo: string;
  membershipId: Types.ObjectId;
  studentId: Types.ObjectId;
  messId: Types.ObjectId;
  type: DepositTxType;
  amount: number;
  reason?: string;
  date: string;
  status: DepositTxStatus;
  method?: string; // refunds only
  reference?: string;
  settlementId?: Types.ObjectId;
  requestedBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  completedBy?: Types.ObjectId;
  completedAt?: Date;
  rejectedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const messDepositTransactionSchema = new Schema<MessDepositTransactionDoc>(
  {
    txNo: { type: String, required: true, unique: true, immutable: true },
    membershipId: { type: Schema.Types.ObjectId, ref: "MessMembership", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    type: { type: String, enum: DEPOSIT_TX_TYPES, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    reason: { type: String, trim: true },
    date: { type: String, required: true },
    status: { type: String, enum: DEPOSIT_TX_STATUS, default: "pending" },
    method: { type: String, trim: true },
    reference: { type: String, trim: true },
    settlementId: { type: Schema.Types.ObjectId, ref: "MessSettlement" },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    completedAt: { type: Date },
    rejectedReason: { type: String, trim: true },
  },
  { timestamps: true },
);

messDepositTransactionSchema.index({ membershipId: 1, status: 1 });
messDepositTransactionSchema.index({ messId: 1, date: -1 });
// A settlement posts at most one transaction of each type — a retried
// settlement completion can never double-apply the deposit.
messDepositTransactionSchema.index(
  { settlementId: 1, type: 1 },
  { unique: true, partialFilterExpression: { settlementId: { $exists: true } } },
);

export const MessDepositTransaction = model<MessDepositTransactionDoc>("MessDepositTransaction", messDepositTransactionSchema);
