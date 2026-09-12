import { Schema, model, Document } from "mongoose";

export const STAFF_TYPES = ["Admin", "Teacher", "Staff", "Batch Director"] as const;
export const STAFF_STATUS = ["সক্রিয়", "নিষ্ক্রিয়"] as const; // matches the frontend's existing Bengali enum exactly

export interface StaffDoc extends Document {
  name: string;
  photoUrl?: string;
  phone: string;
  email?: string;
  address?: string;
  staffType: (typeof STAFF_TYPES)[number];
  salary: number;
  joinDate: string;
  status: (typeof STAFF_STATUS)[number];
  createdAt: Date;
  updatedAt: Date;
}

const staffSchema = new Schema<StaffDoc>(
  {
    name: { type: String, required: true, trim: true },
    photoUrl: String,
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    staffType: { type: String, enum: STAFF_TYPES, required: true },
    salary: { type: Number, default: 0 },
    joinDate: { type: String, required: true },
    status: { type: String, enum: STAFF_STATUS, default: "সক্রিয়" },
  },
  { timestamps: true },
);

staffSchema.index({ staffType: 1, status: 1 });
staffSchema.index({ name: "text", phone: "text" });

export const Staff = model<StaffDoc>("Staff", staffSchema);
