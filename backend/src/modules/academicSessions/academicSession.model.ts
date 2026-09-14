import { Schema, model, Document } from "mongoose";

export const MASTER_DATA_STATUS = ["সক্রিয়", "নিষ্ক্রিয়"] as const;

export interface AcademicSessionDoc extends Document {
  name: string;
  startDate: Date;
  endDate: Date;
  /** Inactive sessions stay out of new Course/selection dropdowns but existing Courses/data keep referencing them (Settings §25 — never hard-delete referenced master data). */
  status: (typeof MASTER_DATA_STATUS)[number];
  createdAt: Date;
  updatedAt: Date;
}

const academicSessionSchema = new Schema<AcademicSessionDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: MASTER_DATA_STATUS, default: "সক্রিয়" },
  },
  { timestamps: true },
);

academicSessionSchema.pre("validate", function (next) {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    next(new Error("startDate must be before endDate"));
    return;
  }
  next();
});

export const AcademicSession = model<AcademicSessionDoc>("AcademicSession", academicSessionSchema);
