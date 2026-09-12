import { Schema, model, Document, Types } from "mongoose";

export interface OfflineResultDoc extends Document {
  examId: Types.ObjectId; // -> OfflineExam
  studentId: Types.ObjectId; // -> Student
  marks: number | null; // null = absent
  createdAt: Date;
  updatedAt: Date;
}

const offlineResultSchema = new Schema<OfflineResultDoc>(
  {
    examId: { type: Schema.Types.ObjectId, ref: "OfflineExam", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    marks: { type: Number, default: null },
  },
  { timestamps: true },
);

offlineResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });
offlineResultSchema.index({ studentId: 1 });

export const OfflineResult = model<OfflineResultDoc>("OfflineResult", offlineResultSchema);
