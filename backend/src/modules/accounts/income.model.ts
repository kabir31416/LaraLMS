import { Schema, model, Document, Types } from "mongoose";

export const TRANSACTION_SOURCES = ["manual", "student_fee", "admission_fee", "book_sale", "book_issue", "exam_fee"] as const;
export const PAYMENT_METHODS = ["নগদ", "বিকাশ", "নগদ (মোবাইল)", "রকেট", "ব্যাংক", "অন্যান্য"] as const;

export interface IncomeEntryDoc extends Document {
  date: string; // ISO
  category: string;
  amount: number;
  branchId: Types.ObjectId; // -> Branch
  method: (typeof PAYMENT_METHODS)[number];
  studentId?: Types.ObjectId; // -> Student
  note?: string;
  source: (typeof TRANSACTION_SOURCES)[number];
  refId?: string; // e.g. the Payment id this was auto-posted from
  createdAt: Date;
  updatedAt: Date;
}

const incomeEntrySchema = new Schema<IncomeEntryDoc>(
  {
    date: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student" },
    note: { type: String, trim: true },
    source: { type: String, enum: TRANSACTION_SOURCES, default: "manual" },
    refId: { type: String },
  },
  { timestamps: true },
);

incomeEntrySchema.index({ date: -1 });
incomeEntrySchema.index({ branchId: 1 });
// An auto-posted entry (source != manual) is posted at most once per refId — the same guard
// the old client-side AccountsAutoBridge dedup used, now enforced atomically by the DB.
incomeEntrySchema.index(
  { source: 1, refId: 1 },
  { unique: true, partialFilterExpression: { refId: { $exists: true } } },
);

export const IncomeEntry = model<IncomeEntryDoc>("IncomeEntry", incomeEntrySchema);
