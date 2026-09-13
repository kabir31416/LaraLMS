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
// A result entry is conceptually unique per batch+subject+lecture+date —
// exam.service.ts's create()/submitResult() enforce this with a
// findOneAndUpdate(upsert) rather than a DB-level unique index, since a
// hard unique index here could fail to build against any duplicate rows
// that already exist from before this fix (Phase 5 §9/§19 — no destructive
// migration on top of existing data).
offlineExamSchema.index({ batchId: 1, subjectId: 1, lectureId: 1, date: 1 });

export const OfflineExam = model<OfflineExamDoc>("OfflineExam", offlineExamSchema);
