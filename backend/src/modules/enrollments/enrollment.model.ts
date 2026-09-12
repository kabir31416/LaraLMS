import { Schema, model, Document, Types } from "mongoose";

export type EnrollmentStatus = "active" | "transferred" | "completed" | "withdrawn";

export interface BatchEnrollmentDoc extends Document {
  studentId: Types.ObjectId;
  batchId: Types.ObjectId;
  courseId?: Types.ObjectId; // snapshot of the batch's course at enrollment time — Phase 2 §5
  rollNumber?: string; // snapshot of the student's roll during this stint — Phase 1 §15
  startDate: Date;
  endDate?: Date;
  status: EnrollmentStatus;
  transferReason?: string;
  previousEnrollmentId?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const batchEnrollmentSchema = new Schema<BatchEnrollmentDoc>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    rollNumber: String,
    startDate: { type: Date, required: true, default: Date.now },
    endDate: Date,
    status: { type: String, enum: ["active", "transferred", "completed", "withdrawn"], default: "active" },
    transferReason: String,
    previousEnrollmentId: { type: Schema.Types.ObjectId, ref: "BatchEnrollment" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// A student may have at most one *active* enrollment at a time.
batchEnrollmentSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);
batchEnrollmentSchema.index({ batchId: 1, status: 1 });
batchEnrollmentSchema.index({ studentId: 1, startDate: -1 });

export const BatchEnrollment = model<BatchEnrollmentDoc>("BatchEnrollment", batchEnrollmentSchema);
