import { Schema, model, Document, Types } from "mongoose";
import { ADMISSION_TYPES, FEE_TYPES, GENDERS, STUDENT_STATUS } from "./student.constants";

export interface ProfileCompletion {
  status: "incomplete" | "complete";
  percent: number;
  missingFields: string[];
}

export interface StudentDoc extends Document {
  registrationId: string; // permanent, immutable — Phase 1 §13
  currentRollNumber?: string; // admin-editable live value — see PATCH /students/:id/roll
  currentBatchId?: Types.ObjectId; // cache, kept in sync by the enrollment service
  photoUrl?: string;

  name: string;
  phone: string;
  altPhone?: string;
  email?: string;
  dob?: string;
  gender?: (typeof GENDERS)[number];

  institution?: string;
  class?: string;

  address?: string;

  course?: string;
  section?: string;
  group?: string;
  subjects: string[];

  admissionDate: string;
  admissionType: (typeof ADMISSION_TYPES)[number];

  feeType: (typeof FEE_TYPES)[number];
  courseDuration: number;
  totalCourseFee: number;
  admissionFee: number;
  monthlyFee: number;
  discount: number;
  totalFee: number;
  paid: number;
  due: number;

  status: (typeof STUDENT_STATUS)[number];
  profileCompletion: ProfileCompletion;

  createdAt: Date;
  updatedAt: Date;
}

const profileCompletionSchema = new Schema<ProfileCompletion>(
  {
    status: { type: String, enum: ["incomplete", "complete"], default: "incomplete" },
    percent: { type: Number, default: 0 },
    missingFields: { type: [String], default: [] },
  },
  { _id: false },
);

const studentSchema = new Schema<StudentDoc>(
  {
    registrationId: { type: String, required: true, unique: true, immutable: true },
    currentRollNumber: { type: String, trim: true },
    currentBatchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    photoUrl: String,

    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    altPhone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    dob: String,
    gender: { type: String, enum: GENDERS },

    institution: { type: String, trim: true },
    class: { type: String, trim: true },

    address: { type: String, trim: true },

    course: { type: String, trim: true },
    section: { type: String, trim: true },
    group: { type: String, trim: true },
    subjects: { type: [String], default: [] },

    admissionDate: { type: String, required: true },
    admissionType: { type: String, enum: ADMISSION_TYPES, default: "নতুন" },

    feeType: { type: String, enum: FEE_TYPES, default: "এককালীন" },
    courseDuration: { type: Number, default: 0 },
    totalCourseFee: { type: Number, default: 0 },
    admissionFee: { type: Number, default: 0 },
    monthlyFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalFee: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    due: { type: Number, default: 0 },

    status: { type: String, enum: STUDENT_STATUS, default: "সক্রিয়" },
    profileCompletion: { type: profileCompletionSchema, default: () => ({ status: "incomplete", percent: 0, missingFields: [] }) },
  },
  { timestamps: true },
);

studentSchema.index({ phone: 1 });
studentSchema.index({ name: "text" });
// Default roll-number scope (Settings.rollNumberScope === "batch") — DB-level backstop;
// the service layer also checks course/global scope explicitly since those can't be a static index.
studentSchema.index(
  { currentBatchId: 1, currentRollNumber: 1 },
  { unique: true, partialFilterExpression: { currentBatchId: { $exists: true }, currentRollNumber: { $exists: true } } },
);

export const Student = model<StudentDoc>("Student", studentSchema);
