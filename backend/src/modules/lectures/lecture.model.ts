import { Schema, model, Document, Types } from "mongoose";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

export interface LectureDoc extends Document {
  title: string;
  subjectId: Types.ObjectId;
  /** Also this Lecture's display order within its Subject — a second, competing order field was deliberately not added (Settings §26). */
  lectureNumber: number;
  description?: string;
  /** Inactive lectures stay out of new selections but existing Exams/Videos keep referencing them (Settings §25). */
  status: (typeof MASTER_DATA_STATUS)[number];
  createdAt: Date;
  updatedAt: Date;
}

const lectureSchema = new Schema<LectureDoc>(
  {
    title: { type: String, required: true, trim: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    lectureNumber: { type: Number, required: true, min: 1 },
    description: { type: String, trim: true },
    status: { type: String, enum: MASTER_DATA_STATUS, default: "সক্রিয়" },
  },
  { timestamps: true },
);

lectureSchema.index({ subjectId: 1, lectureNumber: 1 }, { unique: true });

export const Lecture = model<LectureDoc>("Lecture", lectureSchema);
