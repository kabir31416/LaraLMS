import { Schema, model, Document, Types } from "mongoose";
import { ISSUE_STATUS } from "./book.constants";

export interface BookIssueDoc extends Document {
  studentId: Types.ObjectId; // -> Student
  branchId?: string; // optional — issues come from main stock, see branchStock.model.ts's note
  bookId: Types.ObjectId; // -> Book
  quantity: number;
  issueDate: string; // yyyy-mm-dd
  returnedQuantity: number;
  status: (typeof ISSUE_STATUS)[number];
  createdAt: Date;
  updatedAt: Date;
}

const bookIssueSchema = new Schema<BookIssueDoc>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    branchId: { type: String },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    quantity: { type: Number, required: true, min: 1 },
    issueDate: { type: String, required: true },
    returnedQuantity: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ISSUE_STATUS, default: "ইস্যু" },
  },
  { timestamps: true },
);

bookIssueSchema.index({ studentId: 1, createdAt: -1 });

export const BookIssue = model<BookIssueDoc>("BookIssue", bookIssueSchema);
