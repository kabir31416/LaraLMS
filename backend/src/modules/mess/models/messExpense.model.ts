import { Schema, model, Document, Types } from "mongoose";
import { EXPENSE_STATUS } from "../mess.constants";

/**
 * Mess-specific operating expenses. Kept separate from the coaching
 * Accounts ledger (accounts/expense.model.ts) — that ledger is branch-based
 * coaching bookkeeping, and posting Mess running costs into it would distort
 * the coaching centre's own income-vs-expense figures.
 */
export interface MessExpenseDoc extends Document {
  expenseNo: string;
  messId: Types.ObjectId;
  date: string; // yyyy-mm-dd
  category: string;
  description?: string;
  amount: number;
  method: string;
  paidBy?: string; // who paid out the money
  vendor?: string; // vendor / recipient
  invoiceNo?: string;
  attachment?: { url: string; publicId?: string; resourceType?: string };
  /** Maintenance ticket this expense pays for — the ticket references the expense instead of recording its own cost, so the money is counted once. */
  complaintId?: Types.ObjectId;
  status: (typeof EXPENSE_STATUS)[number];
  addedBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const messExpenseSchema = new Schema<MessExpenseDoc>(
  {
    expenseNo: { type: String, required: true, unique: true, immutable: true },
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    date: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, required: true, trim: true },
    paidBy: { type: String, trim: true },
    vendor: { type: String, trim: true },
    invoiceNo: { type: String, trim: true },
    attachment: { url: String, publicId: String, resourceType: String },
    complaintId: { type: Schema.Types.ObjectId, ref: "MessComplaint" },
    status: { type: String, enum: EXPENSE_STATUS, default: "pending" },
    addedBy: { type: Schema.Types.ObjectId },
    approvedBy: { type: Schema.Types.ObjectId },
    approvedAt: { type: Date },
    rejectedReason: { type: String, trim: true },
  },
  { timestamps: true },
);

messExpenseSchema.index({ messId: 1, date: -1 });
messExpenseSchema.index({ status: 1, date: -1 });
messExpenseSchema.index({ complaintId: 1 });

export const MessExpense = model<MessExpenseDoc>("MessExpense", messExpenseSchema);
