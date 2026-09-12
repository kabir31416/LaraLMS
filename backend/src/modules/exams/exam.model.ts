import { Schema, model, Document, Types } from "mongoose";

export interface OfflineExamDoc extends Document {
  batchId: Types.ObjectId; // -> Batch
  subjectId: Types.ObjectId; // -> Subject
  lectureId: Types.ObjectId; // -> Lecture
  title: string;
  fullMarks: number;
  date: string; // yyyy-mm-dd
  createdAt: Date;
  updatedAt: Date;
}

const offlineExamSchema = new Schema<OfflineExamDoc>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    lectureId: { type: Schema.Types.ObjectId, ref: "Lecture", required: true },
    title: { type: String, required: true, trim: true },
    fullMarks: { type: Number, required: true, min: 1 },
    date: { type: String, required: true },
  },
  { timestamps: true },
);

offlineExamSchema.index({ batchId: 1, date: -1 });

export const OfflineExam = model<OfflineExamDoc>("OfflineExam", offlineExamSchema);
