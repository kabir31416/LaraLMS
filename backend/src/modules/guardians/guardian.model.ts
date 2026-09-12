import { Schema, model, Document, Types } from "mongoose";
import { RELATIONS } from "../students/student.constants";

export interface GuardianDoc extends Document {
  studentId: Types.ObjectId;
  name: string;
  relation: string;
  phone: string;
  occupation?: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const guardianSchema = new Schema<GuardianDoc>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    name: { type: String, required: true, trim: true },
    relation: { type: String, required: true, enum: RELATIONS },
    phone: { type: String, required: true, trim: true },
    occupation: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: true },
);

guardianSchema.index({ studentId: 1 });

export const Guardian = model<GuardianDoc>("Guardian", guardianSchema);
