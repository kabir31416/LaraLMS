import { Schema, model, Document } from "mongoose";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

/**
 * Subject/Course Refactor: a Subject is now a GLOBAL, reusable catalog entry
 * — no `courseId` here at all. "বাংলা" is created exactly once and assigned
 * to as many Courses as needed via a CourseSubject row (courseSubject.model.ts),
 * instead of the pre-refactor design where a Subject belonged to exactly one
 * Course and had to be recreated per Course, causing duplicate names.
 */
export interface SubjectDoc extends Document {
  name: string;
  /** Optional short code (e.g. "BAN" for বাংলা) — display/reporting convenience only, never used as a lookup key. */
  code?: string;
  /** Inactive subjects stay out of new Course-assignment pickers but existing CourseSubject/Lecture/Result references keep working (Settings §25). */
  status: (typeof MASTER_DATA_STATUS)[number];
  /** Lower sorts first in the global Subject list (Settings §26). Per-Course ordering is CourseSubject.order, not this. */
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<SubjectDoc>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    status: { type: String, enum: MASTER_DATA_STATUS, default: "সক্রিয়" },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Exact-normalized uniqueness (trim only, case-sensitive) — deliberately not
// a fuzzy/case-insensitive match, so genuinely different subjects with
// similar names are never silently merged (Duplicate Subject Handling).
subjectSchema.index({ name: 1 }, { unique: true });

export const Subject = model<SubjectDoc>("Subject", subjectSchema);
