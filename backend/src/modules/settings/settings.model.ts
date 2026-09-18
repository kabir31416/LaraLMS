import { Schema, model, Document, Types } from "mongoose";
import { DEFAULT_RESULT_SMS_TEMPLATE } from "../exams/exam.smsTemplate";

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
  /**
   * The fixed one-time Admission Fee (Settings §6) — replaces the old
   * `ADMISSION_FEE_BDT` hard-coded constant in student.constants.ts.
   * Changing this only affects *future* admissions: student.service.ts's
   * create() snapshots it onto each Student document at admission time, so
   * an already-admitted student's own `admissionFee` never moves when this
   * changes later (Settings §6/§24 historical-snapshot requirement).
   */
  admissionFeeBdt: number;
  /**
   * Student System ID prefix (Coaching Reg No / Roll vs System ID
   * clarification spec §7-§10) — generateRegistrationId() (idGenerators.ts)
   * reads this at creation time only. Changing it never touches an
   * already-issued Student.registrationId (Mongoose `immutable: true` on
   * that field already forbids it structurally); it only changes what
   * prefix the NEXT newly-created student gets. The numeric sequence itself
   * lives in a separate, prefix-independent Counter document
   * ("student_registration_id"), so changing this can never reset or
   * duplicate the sequence.
   */
  studentIdPrefix: string;
  /**
   * The fallback Result SMS template (Result Entry's "Send Result") used
   * whenever a Batch Director hasn't configured their own (Staff.
   * resultSmsTemplate) — see exam.service.ts's resolveResultSmsTemplate.
   * Admin-editable via the same GET/PATCH /exams/result-sms-template a
   * Batch Director uses for their own, branched by whether the caller has
   * a linked staff record (Settings §2 "extend, don't duplicate config").
   */
  resultSmsTemplate: string;
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
    admissionFeeBdt: { type: Number, default: 200, min: 0 },
    studentIdPrefix: { type: String, trim: true, default: "LMS" },
    resultSmsTemplate: { type: String, trim: true, default: DEFAULT_RESULT_SMS_TEMPLATE },
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

// -------------------- Public Marksheet Settings (Settings §19) --------------------

export interface PublicResultsSettingsDoc extends Document {
  enabled: boolean; // master switch for the whole /marksheet feature
  individualEnabled: boolean;
  batchEnabled: boolean;
  /** true (today's only behavior) keeps filtering to OfflineExam.isPublished; false lets every exam show up publicly regardless. */
  requirePublished: boolean;
  visibleFields: string[];
}

/** Hard, non-configurable allow-list — same discipline as PUBLIC_INFO_ALLOWED_FIELDS (Settings §18). Marks/percentage/grade are the feature's own purpose and are never gated by this list; phone/guardian/address/payment were never in the DTO to begin with and can't be added via this list either. */
export const PUBLIC_RESULTS_ALLOWED_FIELDS = ["photo", "registrationId", "course", "batch", "rank"] as const;

const publicResultsSettingsSchema = new Schema<PublicResultsSettingsDoc>(
  {
    enabled: { type: Boolean, default: true },
    individualEnabled: { type: Boolean, default: true },
    batchEnabled: { type: Boolean, default: true },
    requirePublished: { type: Boolean, default: true },
    visibleFields: {
      type: [String],
      enum: PUBLIC_RESULTS_ALLOWED_FIELDS,
      default: ["course", "batch", "rank"],
    },
  },
  { timestamps: true },
);

export const PublicResultsSettings = model<PublicResultsSettingsDoc>("PublicResultsSettings", publicResultsSettingsSchema);

// -------------------- Material Settings (Coaching Material Inventory §21) --------------------

export const DUPLICATE_DISTRIBUTION_RULES = ["allow", "warn", "block"] as const;

export interface MaterialSettingsDoc extends Document {
  /** §8 — "allow" never checks, "warn" (default) surfaces a warning but still lets an admin distribute again, "block" refuses outright. */
  duplicateDistributionRule: (typeof DUPLICATE_DISTRIBUTION_RULES)[number];
  /** Pre-filled as the suggested Minimum Stock Alert on a new Material's Add form — never applied retroactively to existing materials. */
  defaultMinimumStock: number;
}

const materialSettingsSchema = new Schema<MaterialSettingsDoc>(
  {
    duplicateDistributionRule: { type: String, enum: DUPLICATE_DISTRIBUTION_RULES, default: "warn" },
    defaultMinimumStock: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const MaterialSettings = model<MaterialSettingsDoc>("MaterialSettings", materialSettingsSchema);
