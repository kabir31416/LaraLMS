import { Schema, model, Document, Types } from "mongoose";

export interface SubjectDoc extends Document {
  name: string;
  courseId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<SubjectDoc>(
  {
    name: { type: String, required: true, trim: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  },
  { timestamps: true },
);

subjectSchema.index({ courseId: 1, name: 1 }, { unique: true });

export const Subject = model<SubjectDoc>("Subject", subjectSchema);
