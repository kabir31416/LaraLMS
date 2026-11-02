import { Schema, model, Document, Types } from "mongoose";
import { MESS_BILL_ITEM_KINDS, MESS_BILL_STATUS } from "../mess.constants";

export interface MessBillItem {
  kind: (typeof MESS_BILL_ITEM_KINDS)[number];
  label: string;
  amount: number;
}

export interface MessBillDoc extends Document {
  billNo: string;
  membershipId: Types.ObjectId;
  studentId: Types.ObjectId;
  messId: Types.ObjectId; // snapshot at generation time
  roomId?: Types.ObjectId;
  seatId?: Types.ObjectId;
  period: string; // "yyyy-mm"
  /**
   * Equal to `period` while the bill is live; rewritten to a unique value on
   * cancellation. The unique {membershipId, periodKey} index is what makes
   * monthly generation idempotent — running it twice can never create a
   * second live bill for the same member and month.
   */
  periodKey: string;
  issueDate: string;
  dueDate: string;
  items: MessBillItem[];
  /** The member's recurring monthly discount (plus any extra discount given on this bill). */
  discount: number;
  /** An approved one-off credit/correction on this bill. */
  adjustment: number;
  adjustmentReason?: string;
  adjustmentApprovedBy?: Types.ObjectId;
  /** Advance/deposit adjusted against this bill under the advance-adjustment rule (recorded as an apply_to_due deposit transaction). */
  advanceAdjusted: number;
  /** How the bill was created: the monthly scheduler, an operator, or the admission's initial dining charge. */
  source: "auto" | "manual" | "admission" | "regenerate";
  /** Balance BEFORE this bill (positive = due carried forward, negative = advance credit). Snapshot only — never recomputed. */
  previousDue: number;
  /** Σ items − discount − adjustment — what this bill itself adds to the member's ledger. */
  currentCharges: number;
  /** currentCharges + previousDue − advanceAdjusted — the invoice's "Total Payable" at the time it was issued. */
  totalPayable: number;
  /** FIFO-allocated share of the member's payments/credits — recomputed by messLedger.service.ts. */
  paidAmount: number;
  dueAmount: number;
  status: (typeof MESS_BILL_STATUS)[number];
  ledgerSeqApplied: number;
  notes?: string;
  generatedBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const billItemSchema = new Schema<MessBillItem>(
  {
    kind: { type: String, enum: MESS_BILL_ITEM_KINDS, required: true },
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const messBillSchema = new Schema<MessBillDoc>(
  {
    billNo: { type: String, required: true, unique: true, immutable: true },
    membershipId: { type: Schema.Types.ObjectId, ref: "MessMembership", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "MessRoom" },
    seatId: { type: Schema.Types.ObjectId, ref: "MessSeat" },
    period: { type: String, required: true },
    periodKey: { type: String, required: true },
    issueDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    items: { type: [billItemSchema], default: [] },
    discount: { type: Number, default: 0, min: 0 },
    adjustment: { type: Number, default: 0, min: 0 },
    adjustmentReason: { type: String, trim: true },
    adjustmentApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    previousDue: { type: Number, default: 0 },
    advanceAdjusted: { type: Number, default: 0, min: 0 },
    source: { type: String, enum: ["auto", "manual", "admission", "regenerate"], default: "manual" },
    currentCharges: { type: Number, required: true, min: 0 },
    totalPayable: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    status: { type: String, enum: MESS_BILL_STATUS, default: "unpaid" },
    ledgerSeqApplied: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelReason: { type: String, trim: true },
  },
  { timestamps: true },
);

messBillSchema.index({ membershipId: 1, periodKey: 1 }, { unique: true });
messBillSchema.index({ messId: 1, period: -1 });
messBillSchema.index({ studentId: 1, period: -1 });

export const MessBill = model<MessBillDoc>("MessBill", messBillSchema);
