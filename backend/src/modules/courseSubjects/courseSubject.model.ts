import { Schema, model, Document, Types } from "mongoose";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

/**
 * The join between a global Subject and the Course(s) it's assigned to
 * (Subject/Course Refactor) — Course → CourseSubject → Subject → Lecture.
 * A Lecture belongs to exactly one CourseSubject, never directly to a
 * Subject, so the same global Subject ("বাংলা") can carry a completely
 * independent set of Lectures in each Course it's assigned to.
 */
export interface CourseSubjectDoc extends Document {
  courseId: Types.ObjectId;
  subjectId: Types.ObjectId;
  /** Display order of this Subject within its Course — independent of the global Subject's own displayOrder. */
  order: number;
  /** Inactive keeps this assignment (and its Lectures/Results) intact but out of new Result Entry/Lecture-creation pickers (Settings §25 convention). */
  status: (typeof MASTER_DATA_STATUS)[number];
  createdAt: Date;
  updatedAt: Date;
}

const courseSubjectSchema = new Schema<CourseSubjectDoc>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    order: { type: Number, default: 0 },
    status: { type: String, enum: MASTER_DATA_STATUS, default: "সক্রিয়" },
  },
  { timestamps: true },
);

// The same Subject may never be assigned twice to the same Course.
courseSubjectSchema.index({ courseId: 1, subjectId: 1 }, { unique: true });
// Listing a Course's subjects (in order) and checking "is this Subject assigned anywhere" (Subject delete-safety) are the two hot paths.
courseSubjectSchema.index({ courseId: 1, order: 1 });
courseSubjectSchema.index({ subjectId: 1 });

export const CourseSubject = model<CourseSubjectDoc>("CourseSubject", courseSubjectSchema);
