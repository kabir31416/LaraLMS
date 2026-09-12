import { Schema, model, Document, Types } from "mongoose";

export interface GradeBand {
  minPercent: number;
  grade: string;
}

export interface SettingsDoc extends Document {
  defaultSessionId?: Types.ObjectId;
  defaultExamDuration: number; // minutes
  passingPercentage: number;
  shuffleQuestions: boolean;
  publishResults: boolean;
  gradeScale: GradeBand[];
  rollNumberScope: "batch" | "course" | "global";
}

const gradeBandSchema = new Schema<GradeBand>(
  { minPercent: { type: Number, required: true }, grade: { type: String, required: true } },
  { _id: false },
);

const settingsSchema = new Schema<SettingsDoc>(
  {
    defaultSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
    defaultExamDuration: { type: Number, default: 60 },
    passingPercentage: { type: Number, default: 33 },
    shuffleQuestions: { type: Boolean, default: false },
    publishResults: { type: Boolean, default: true },
    gradeScale: {
      type: [gradeBandSchema],
      default: [
        { minPercent: 80, grade: "A+" },
        { minPercent: 70, grade: "A" },
        { minPercent: 60, grade: "A-" },
        { minPercent: 50, grade: "B" },
        { minPercent: 40, grade: "C" },
        { minPercent: 33, grade: "D" },
        { minPercent: 0, grade: "F" },
      ],
    },
    rollNumberScope: { type: String, enum: ["batch", "course", "global"], default: "batch" },
  },
  { timestamps: true },
);

export const Settings = model<SettingsDoc>("Settings", settingsSchema);

// -------------------- Public Info Settings (Phase 1 §16) --------------------

export interface PublicInfoSettingsDoc extends Document {
  enabled: boolean;
  searchMethods: { registrationId: boolean; phone: boolean; name: boolean };
  visibleFields: string[];
  rateLimits: { exactMatchPerMin: number; nameSearchPerMin: number; captchaAfter: number };
}

/** Hard, non-configurable allow-list — never let a PATCH slip a private field into visibleFields (Phase 1 §16). */
export const PUBLIC_INFO_ALLOWED_FIELDS = [
  "name",
  "registrationId",
  "rollNumber",
  "course",
  "currentBatch",
  "batchDirector",
  "admissionStatus",
  "resultSummary",
  "attendanceSummary",
  "photo",
] as const;

const publicInfoSettingsSchema = new Schema<PublicInfoSettingsDoc>(
  {
    enabled: { type: Boolean, default: false },
    searchMethods: {
      registrationId: { type: Boolean, default: true },
      phone: { type: Boolean, default: true },
      name: { type: Boolean, default: false },
    },
    visibleFields: {
      type: [String],
      enum: PUBLIC_INFO_ALLOWED_FIELDS,
      default: ["name", "registrationId", "rollNumber", "course", "currentBatch", "admissionStatus"],
    },
    rateLimits: {
      exactMatchPerMin: { type: Number, default: 20 },
      nameSearchPerMin: { type: Number, default: 5 },
      captchaAfter: { type: Number, default: 10 },
    },
  },
  { timestamps: true },
);

export const PublicInfoSettings = model<PublicInfoSettingsDoc>("PublicInfoSettings", publicInfoSettingsSchema);
