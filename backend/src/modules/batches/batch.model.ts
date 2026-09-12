import { Schema, model, Document, Types } from "mongoose";

export const WEEK_DAYS = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার"] as const;

export interface BatchDoc extends Document {
  name: string;
  courseId: Types.ObjectId; // real Course ref — fixes Phase 1 §3's "stored by name" bug
  batchTime: string;
  days: (typeof WEEK_DAYS)[number][];
  roomNumber?: string;
  // Plain string, not yet an ObjectId ref, because Staff (Module 13) doesn't
  // exist as a backend collection yet and the frontend still assigns
  // directors from its old mock Staff list. Switches to a real
  // `{ type: Schema.Types.ObjectId, ref: "Staff" }` the moment Module 13 lands.
  directorId?: string;
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
    directorId: { type: String }, // see the interface comment above re: Module 13
    startDate: { type: String, required: true },
  },
  { timestamps: true },
);

export const Batch = model<BatchDoc>("Batch", batchSchema);
