import { Schema, model, Document, Types } from "mongoose";

export const ATTENDANCE_STATUS = ["Present", "Absent"] as const;
export const ATTENDANCE_SOURCE = ["Manual", "Exam"] as const;

export interface AttendanceEntryDoc extends Document {
  studentId: Types.ObjectId; // -> Student
  batchId: Types.ObjectId; // -> Batch
  date: string; // yyyy-mm-dd
  status: (typeof ATTENDANCE_STATUS)[number];
  source: (typeof ATTENDANCE_SOURCE)[number];
  examId?: Types.ObjectId; // -> OfflineExam, set when source === "Exam"
  createdAt: Date;
  updatedAt: Date;
}

const attendanceEntrySchema = new Schema<AttendanceEntryDoc>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ATTENDANCE_STATUS, required: true },
    source: { type: String, enum: ATTENDANCE_SOURCE, required: true, default: "Manual" },
    examId: { type: Schema.Types.ObjectId, ref: "OfflineExam" },
  },
  { timestamps: true },
);

attendanceEntrySchema.index({ batchId: 1, date: 1 });
attendanceEntrySchema.index({ studentId: 1, date: -1 });
// One Manual entry per student per day...
attendanceEntrySchema.index(
  { studentId: 1, date: 1 },
  { unique: true, partialFilterExpression: { source: "Manual" } },
);
// ...and one Exam-linked entry per student per exam (a student can have several exams on the same day).
attendanceEntrySchema.index(
  { studentId: 1, examId: 1 },
  { unique: true, partialFilterExpression: { source: "Exam" } },
);

export const AttendanceEntry = model<AttendanceEntryDoc>("AttendanceEntry", attendanceEntrySchema);
