import { Schema, model, Document, Types } from "mongoose";
import { PAYMENT_METHODS } from "./income.model";

export const BRANCH_LEDGER_TYPES = ["expense", "income"] as const; // expense = sent to branch, income = received from branch
export const BRANCH_ITEM_TYPES = ["বই", "ভর্তি ফর্ম", "অন্যান্য"] as const;

export interface BranchLedgerEntryDoc extends Document {
  date: string; // ISO
  branchId: Types.ObjectId; // -> Branch
  type: (typeof BRANCH_LEDGER_TYPES)[number];
  // For expense (sent to branch)
  itemType?: (typeof BRANCH_ITEM_TYPES)[number];
  description?: string;
  quantity?: number;
  // For income (received from branch)
  method?: (typeof PAYMENT_METHODS)[number];
  amount: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const branchLedgerEntrySchema = new Schema<BranchLedgerEntryDoc>(
  {
    date: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    type: { type: String, enum: BRANCH_LEDGER_TYPES, required: true },
    itemType: { type: String, enum: BRANCH_ITEM_TYPES },
    description: { type: String, trim: true },
    quantity: { type: Number, min: 0 },
    method: { type: String, enum: PAYMENT_METHODS },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

branchLedgerEntrySchema.index({ branchId: 1, date: 1 });

export const BranchLedgerEntry = model<BranchLedgerEntryDoc>("BranchLedgerEntry", branchLedgerEntrySchema);
