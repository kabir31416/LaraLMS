import { Schema, model, Document, Types } from "mongoose";
import { STOCK_HISTORY_ACTIONS } from "./book.constants";

export interface StockHistoryDoc extends Document {
  action: (typeof STOCK_HISTORY_ACTIONS)[number];
  bookId: Types.ObjectId; // -> Book
  bookName: string; // snapshot at the time of the action
  quantity: number;
  branchId?: string;
  branchName?: string; // snapshot
  studentId?: Types.ObjectId; // -> Student
  studentName?: string; // snapshot
  note?: string;
  createdAt: Date;
}

const stockHistorySchema = new Schema<StockHistoryDoc>(
  {
    action: { type: String, enum: STOCK_HISTORY_ACTIONS, required: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    bookName: { type: String, required: true },
    quantity: { type: Number, required: true },
    branchId: { type: String },
    branchName: { type: String },
    studentId: { type: Schema.Types.ObjectId, ref: "Student" },
    studentName: { type: String },
    note: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

stockHistorySchema.index({ createdAt: -1 });

export const StockHistory = model<StockHistoryDoc>("StockHistory", stockHistorySchema);
