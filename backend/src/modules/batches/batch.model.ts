import { Schema, model, Document, Types } from "mongoose";

export const WEEK_DAYS = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার"] as const;

export interface BatchDoc extends Document {
  name: string;
  courseId: Types.ObjectId; // real Course ref — fixes Phase 1 §3's "stored by name" bug
  batchTime: string;
  days: (typeof WEEK_DAYS)[number][];
  roomNumber?: string;
  directorId?: Types.ObjectId; // -> Staff, real ref since Module 13
  startDate: string;
  createdAt: Date;
  updatedAt: Date;
}

const batchSchema = new Schema<BatchDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    batchTime: { type: String, required: true },
    days: { type: [String], enum: WEEK_DAYS, default: [] },
    roomNumber: String,
    directorId: { type: Schema.Types.ObjectId, ref: "Staff" },
    startDate: { type: String, required: true },
  },
  { timestamps: true },
);

export const Batch = model<BatchDoc>("Batch", batchSchema);
