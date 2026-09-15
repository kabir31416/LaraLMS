import { Schema, model, Document, Types } from "mongoose";

export interface OfflineExamDoc extends Document {
  batchId: Types.ObjectId; // -> Batch
  subjectId: Types.ObjectId; // -> Subject
  lectureId: Types.ObjectId; // -> Lecture
  title: string;
  fullMarks: number;
  date: string; // yyyy-mm-dd
  /**
   * Gates visibility on the *public* marksheet only (publicResults module) —
   * Admin/Batch Director/Student Portal result views are completely
   * unaffected by this and keep seeing everything, exactly as before
   * (Phase 6 §5). Defaults to true: today's Result Entry has no
   * draft/staging step at all — a result is final the moment a Batch
   * Director sends it — so making every *existing* exam publicly visible
   * by default preserves that same behavior for the new public surface
   * rather than silently hiding a coaching centre's entire result history
   * behind a publish action nothing yet exposes. An explicit "unpublish
   * this exam" admin action can flip individual exams later if needed.
   */
  isPublished: boolean;
  /**
   * Transient concurrency guard for the "Send Result" SMS phase (exam.
   * service.ts's submitResult) — claimed atomically before looping over
   * guardians and cleared right after, so two near-simultaneous Send
   * Result requests for the same exam (a double-click slipping past the
   * frontend's own disable, or a network retry) can never both send SMS.
   * Self-expiring (checked against a short staleness window, not just
   * existence) so a request that crashed mid-send can't leave this exam
   * permanently locked.
   */
  smsSendingLockedAt?: Date;
  /** Set once the SMS phase completes (regardless of per-student success/failure) — auditability, and lets the UI show "SMS last sent at ...". */
  lastSmsSentAt?: Date;
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
    isPublished: { type: Boolean, default: true },
    smsSendingLockedAt: { type: Date },
    lastSmsSentAt: { type: Date },
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
