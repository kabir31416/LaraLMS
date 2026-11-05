import { Schema, model, Document, Types } from "mongoose";

/**
 * A scheduled exam that students are assigned to and receive admit cards for.
 *
 * This is intentionally separate from OfflineExam (exams module): an
 * OfflineExam is a result-entry record (one batch + subject + date + full
 * marks, created by Result Entry, `isPublished` gating the public
 * marksheet). A scheduled exam is an event with times, venue, instructions
 * and a draft → published → completed / cancelled lifecycle, and may span
 * several batches. Re-using OfflineExam would have changed the meaning of
 * its existing fields and the public marksheet.
 */
export const EXAM_TYPES = ["model_test", "weekly", "monthly", "final", "admission_test", "other"] as const;
export const EXAM_STATUSES = ["draft", "published", "completed", "cancelled"] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export interface ExamScheduleDoc extends Document {
  /** Human code, e.g. EXM-2026-0007 — also the prefix of every admit card number. */
  code: string;
  name: string;
  examType: (typeof EXAM_TYPES)[number];
  courseId: Types.ObjectId;
  /** Primary batch. Optional: without it the exam is course-wide. */
  batchId?: Types.ObjectId;
  /** When true, students of any batch of the course may be assigned (not only `batchId`). */
  allowCrossBatch: boolean;
  sessionId?: Types.ObjectId;
  subjectId?: Types.ObjectId;
  date: string; // yyyy-mm-dd
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  durationMinutes?: number;
  venue?: string;
  instructions?: string;
  status: ExamStatus;
  /** Bumped whenever anything printed on the admit card changes — an admit card generated at an older version is "outdated". */
  version: number;
  /** Admit card number sequence for this exam (atomic $inc). */
  admitSeq: number;
  publishedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const examScheduleSchema = new Schema<ExamScheduleDoc>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    examType: { type: String, enum: EXAM_TYPES, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    allowCrossBatch: { type: Boolean, default: false },
    sessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    date: { type: String, required: true },
    startTime: String,
    endTime: String,
    durationMinutes: { type: Number, min: 1 },
    venue: { type: String, trim: true },
    instructions: { type: String, trim: true },
    status: { type: String, enum: EXAM_STATUSES, default: "draft" },
    version: { type: Number, default: 1 },
    admitSeq: { type: Number, default: 0 },
    publishedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, trim: true },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true },
);

examScheduleSchema.index({ date: -1 });
examScheduleSchema.index({ status: 1, date: 1 });
examScheduleSchema.index({ courseId: 1, batchId: 1 });

export const ExamSchedule = model<ExamScheduleDoc>("ExamSchedule", examScheduleSchema);

/**
 * One student's place in one scheduled exam. Unique per (exam, student) so a
 * student can never be assigned twice; removal is a soft status change so the
 * assignment history (who assigned/removed, when, why) is kept, and
 * re-assigning reactivates the same record. The admit card is embedded here
 * (number, QR code, when/by whom/at which exam version it was generated) —
 * there is no separate admit-card collection and no copy of student data.
 * `batchId` is the student's batch at assignment time, recorded on purpose:
 * it keeps batch-wise admit printing and director scoping stable even if the
 * student later moves batch.
 */
export const ASSIGNMENT_STATUSES = ["active", "removed"] as const;

export interface ExamAssignmentDoc extends Document {
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  batchId?: Types.ObjectId;
  method: "batch" | "student";
  status: (typeof ASSIGNMENT_STATUSES)[number];
  assignedAt: Date;
  assignedBy?: string;
  removedAt?: Date;
  removedBy?: string;
  removeReason?: string;
  admit?: {
    cardNo: string;
    verifyCode: string;
    examVersion: number;
    generatedAt: Date;
    generatedBy?: string;
    count: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const examAssignmentSchema = new Schema<ExamAssignmentDoc>(
  {
    examId: { type: Schema.Types.ObjectId, ref: "ExamSchedule", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    method: { type: String, enum: ["batch", "student"], required: true },
    status: { type: String, enum: ASSIGNMENT_STATUSES, default: "active" },
    assignedAt: { type: Date, required: true },
    assignedBy: String,
    removedAt: Date,
    removedBy: String,
    removeReason: { type: String, trim: true },
    admit: {
      type: new Schema(
        {
          cardNo: { type: String, required: true },
          verifyCode: { type: String, required: true },
          examVersion: { type: Number, required: true },
          generatedAt: { type: Date, required: true },
          generatedBy: String,
          count: { type: Number, default: 1 },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
);

examAssignmentSchema.index({ examId: 1, studentId: 1 }, { unique: true });
examAssignmentSchema.index({ studentId: 1, status: 1 });
examAssignmentSchema.index({ examId: 1, status: 1, batchId: 1 });
examAssignmentSchema.index({ "admit.cardNo": 1 }, { unique: true, partialFilterExpression: { "admit.cardNo": { $exists: true } } });
examAssignmentSchema.index({ "admit.verifyCode": 1 }, { unique: true, partialFilterExpression: { "admit.verifyCode": { $exists: true } } });

export const ExamAssignment = model<ExamAssignmentDoc>("ExamAssignment", examAssignmentSchema);
