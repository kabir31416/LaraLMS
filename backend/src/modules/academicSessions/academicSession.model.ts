import { Schema, model, Document } from "mongoose";

export interface AcademicSessionDoc extends Document {
  name: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const academicSessionSchema = new Schema<AcademicSessionDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
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
