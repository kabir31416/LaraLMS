import { Schema, model, Document, Types } from "mongoose";

export interface LectureDoc extends Document {
  title: string;
  subjectId: Types.ObjectId;
  lectureNumber: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const lectureSchema = new Schema<LectureDoc>(
  {
    title: { type: String, required: true, trim: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    lectureNumber: { type: Number, required: true, min: 1 },
    description: { type: String, trim: true },
  },
  { timestamps: true },
);

lectureSchema.index({ subjectId: 1, lectureNumber: 1 }, { unique: true });

export const Lecture = model<LectureDoc>("Lecture", lectureSchema);
