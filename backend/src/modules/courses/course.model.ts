import { Schema, model, Document, Types } from "mongoose";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

export interface CourseDoc extends Document {
  name: string;
  sessionId: Types.ObjectId;
  duration: number; // months
  /** Source of truth for admission-time Course Fee (student.service.ts's create) — never hard-coded in the admission form. Changing this never rewrites already-admitted students' totalCourseFee snapshot. */
  fee: number;
  /** Inactive courses stay out of new admission/batch dropdowns but existing Students/Batches keep referencing them (Settings §25). */
  status: (typeof MASTER_DATA_STATUS)[number];
  /** Lower sorts first in every Course list this app renders (Settings §26). */
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<CourseDoc>(
  {
    name: { type: String, required: true, trim: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    duration: { type: Number, required: true, min: 1 },
    fee: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: MASTER_DATA_STATUS, default: "সক্রিয়" },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// A course name only needs to be unique within its own session.
courseSchema.index({ sessionId: 1, name: 1 }, { unique: true });

export const Course = model<CourseDoc>("Course", courseSchema);
