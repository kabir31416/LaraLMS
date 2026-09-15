import { Schema, model, Document, Types } from "mongoose";

export const RESULT_SMS_STATUS = ["not_sent", "sent", "failed"] as const;

export interface OfflineResultDoc extends Document {
  examId: Types.ObjectId; // -> OfflineExam
  studentId: Types.ObjectId; // -> Student
  marks: number | null; // null = absent
  /** Per-student Result SMS delivery status (exam.service.ts's submitResult) — auditability alongside the existing exam/student-level audit log entries, not a replacement for them. */
  smsStatus: (typeof RESULT_SMS_STATUS)[number];
  smsSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const offlineResultSchema = new Schema<OfflineResultDoc>(
  {
    examId: { type: Schema.Types.ObjectId, ref: "OfflineExam", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    marks: { type: Number, default: null },
    smsStatus: { type: String, enum: RESULT_SMS_STATUS, default: "not_sent" },
    smsSentAt: { type: Date },
  },
  { timestamps: true },
);

offlineResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });
offlineResultSchema.index({ studentId: 1 });

export const OfflineResult = model<OfflineResultDoc>("OfflineResult", offlineResultSchema);
