import { Schema, model, Document, Types } from "mongoose";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

export interface SubjectDoc extends Document {
  name: string;
  courseId: Types.ObjectId;
  /** Inactive subjects stay out of new selections but existing Lectures/Results keep referencing them (Settings §25). */
  status: (typeof MASTER_DATA_STATUS)[number];
  /** Lower sorts first — respected by Result/Routine/Reports/Public Marksheet everywhere a subject list renders (Settings §26). */
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<SubjectDoc>(
  {
    name: { type: String, required: true, trim: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    status: { type: String, enum: MASTER_DATA_STATUS, default: "সক্রিয়" },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

subjectSchema.index({ courseId: 1, name: 1 }, { unique: true });

export const Subject = model<SubjectDoc>("Subject", subjectSchema);
