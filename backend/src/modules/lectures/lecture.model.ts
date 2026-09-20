import { Schema, model, Document, Types } from "mongoose";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

/**
 * Subject/Course Refactor: a Lecture belongs to a CourseSubject (a Subject
 * assigned to one specific Course), never directly to the global Subject.
 * This is what keeps "বাংলা"'s lectures independent between, say, BSc
 * Nursing and Diploma Nursing — each Course's assignment of বাংলা is its
 * own CourseSubject row with its own Lectures, even though both point at
 * the same global Subject document.
 */
export interface LectureDoc extends Document {
  title: string;
  courseSubjectId: Types.ObjectId;
  /** Also this Lecture's display order within its CourseSubject — a second, competing order field was deliberately not added (Settings §26). */
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
    courseSubjectId: { type: Schema.Types.ObjectId, ref: "CourseSubject", required: true },
    lectureNumber: { type: Number, required: true, min: 1 },
    description: { type: String, trim: true },
    status: { type: String, enum: MASTER_DATA_STATUS, default: "সক্রিয়" },
  },
  { timestamps: true },
);

lectureSchema.index({ courseSubjectId: 1, lectureNumber: 1 }, { unique: true });

export const Lecture = model<LectureDoc>("Lecture", lectureSchema);
