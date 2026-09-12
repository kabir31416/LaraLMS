import { Schema, model, Document, Types } from "mongoose";

export interface CourseDoc extends Document {
  name: string;
  sessionId: Types.ObjectId;
  duration: number; // months
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<CourseDoc>(
  {
    name: { type: String, required: true, trim: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    duration: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

// A course name only needs to be unique within its own session.
courseSchema.index({ sessionId: 1, name: 1 }, { unique: true });

export const Course = model<CourseDoc>("Course", courseSchema);
