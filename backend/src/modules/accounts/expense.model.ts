import { Schema, model, Document, Types } from "mongoose";
import { PAYMENT_METHODS } from "./income.model";

export interface ExpenseEntryDoc extends Document {
  date: string; // ISO
  category: string;
  amount: number;
  branchId: Types.ObjectId; // -> Branch
  method: (typeof PAYMENT_METHODS)[number];
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenseEntrySchema = new Schema<ExpenseEntryDoc>(
  {
    date: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

expenseEntrySchema.index({ date: -1 });
expenseEntrySchema.index({ branchId: 1 });

export const ExpenseEntry = model<ExpenseEntryDoc>("ExpenseEntry", expenseEntrySchema);
