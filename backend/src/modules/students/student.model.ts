import { Schema, model, Document, Types } from "mongoose";
import { ADMISSION_ENTRY_STATUS, ADMISSION_TYPES, FEE_TYPES, GENDERS, STUDENT_STATUS } from "./student.constants";

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
  /**
   * The Cloudinary public ID behind `photoUrl` (Student Photo Management §1)
   * — undefined for a student with no photo, or one whose `photoUrl` was set
   * some other way (e.g. Excel import/manual edit, a plain string with
   * nothing to delete from Cloudinary). Never surfaced to any client; it
   * exists only so student.service.ts can clean up the old asset when a
   * photo is replaced or removed.
   */
  photoPublicId?: string;

  name: string;
  phone: string;
  altPhone?: string;
  email?: string;
  dob?: string;
  gender?: (typeof GENDERS)[number];

  institution?: string;
  class?: string;
  /** Admin-controlled (Phase 4). */
  bloodGroup?: string;
  /** Free text, no enum — Excel Student Information Import (§5). */
  religion?: string;
  /** Distinct from the Guardian sub-collection's "primary guardian" contact (which may be neither parent) — Excel Student Information Import §5. */
  fatherName?: string;
  motherName?: string;

  /** Legacy single field — kept for backward compatibility, no longer part of the admission/self-edit flow (superseded by present/permanentAddress below). */
  address?: string;
  /** Student-editable (Phase 4). */
  presentAddress?: string;
  permanentAddress?: string;
  /** Bangladesh administrative address hierarchy — Excel Student Information Import §5, all free text (no separate master-data collection). */
  division?: string;
  district?: string;
  upazila?: string;
  postOffice?: string;
  postcode?: string;
  village?: string;

  /** Student-editable HSC info (Phase 4). */
  hscInstitution?: string;
  hscBoard?: string;
  hscPassingYear?: string;
  hscGroup?: string;
  hscGpa?: string;
  /** Excel Student Information Import §5 — kept as plain strings (identifiers), never numbers, so a leading zero is never lost. */
  hscRoll?: string;
  hscRegistrationNumber?: string;

  /** Student-editable SSC info (Phase 4). */
  sscInstitution?: string;
  sscBoard?: string;
  sscPassingYear?: string;
  sscGroup?: string;
  sscGpa?: string;
  sscRoll?: string;
  sscRegistrationNumber?: string;

  /** Real Course reference — admission's source of truth for Course Fee (Phase 4). `course` (free text) is kept in sync for existing UI/reports that read it as a string. */
  courseId?: Types.ObjectId;
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

  /**
   * The official admission-test roll number (Admission Result feature) —
   * distinct from `currentRollNumber` (this ERP's own internal roll).
   * Admin/Batch-Director-entered, foundation for the future PDF admission
   * result matching system (a student is "selected" when their
   * admissionRoll appears in a parsed official result).
   */
  admissionRoll?: string;

  /**
   * Student Entry Workflow — undefined means "not a pending application at
   * all" (Admin Admission, Bulk Import, every pre-existing student), and is
   * treated as already-approved everywhere this is checked. Only a student
   * created via /newstudententry starts as `"pending"`.
   */
  admissionStatus?: (typeof ADMISSION_ENTRY_STATUS)[number];
  /** The batch requested at pending-submission time — not yet a real enrollment (BatchEnrollment/`currentBatchId` are only set once an Admin approves). */
  requestedBatchId?: Types.ObjectId;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectedBy?: Types.ObjectId;
  rejectionReason?: string;

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
    photoPublicId: { type: String, select: false },

    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    altPhone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    dob: String,
    gender: { type: String, enum: GENDERS },

    institution: { type: String, trim: true },
    class: { type: String, trim: true },
    bloodGroup: { type: String, trim: true },
    religion: { type: String, trim: true },
    fatherName: { type: String, trim: true },
    motherName: { type: String, trim: true },

    address: { type: String, trim: true },
    presentAddress: { type: String, trim: true },
    permanentAddress: { type: String, trim: true },
    division: { type: String, trim: true },
    district: { type: String, trim: true },
    upazila: { type: String, trim: true },
    postOffice: { type: String, trim: true },
    postcode: { type: String, trim: true },
    village: { type: String, trim: true },

    hscInstitution: { type: String, trim: true },
    hscBoard: { type: String, trim: true },
    hscPassingYear: { type: String, trim: true },
    hscGroup: { type: String, trim: true },
    hscGpa: { type: String, trim: true },
    hscRoll: { type: String, trim: true },
    hscRegistrationNumber: { type: String, trim: true },

    sscInstitution: { type: String, trim: true },
    sscBoard: { type: String, trim: true },
    sscPassingYear: { type: String, trim: true },
    sscGroup: { type: String, trim: true },
    sscGpa: { type: String, trim: true },
    sscRoll: { type: String, trim: true },
    sscRegistrationNumber: { type: String, trim: true },

    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
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

    admissionRoll: { type: String, trim: true },

    admissionStatus: { type: String, enum: ADMISSION_ENTRY_STATUS },
    requestedBatchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectedAt: Date,
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String, trim: true },
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
// The compound index above only helps queries that also filter by
// currentBatchId — it can't serve a roll-number-only lookup (Mongo can only
// use a compound index's leading field(s)). The public marksheet's
// individual-result search (publicResults module) looks up by Roll Number
// alone, with no batch to narrow by, so it needs its own index.
studentSchema.index({ currentRollNumber: 1 });

// Not a unique index: an official admission-test roll is only guaranteed
// unique within one admission cycle (Course.sessionId), not globally — every
// year's exam restarts its own numbering, so the same digits can legitimately
// belong to two different real students in two different years. Uniqueness
// within the correct scope is enforced in student.service.ts's
// updateAdmissionRoll() instead, same pattern as currentRollNumber's
// scope-dependent checks (Admission Result feature §8).
studentSchema.index({ admissionRoll: 1 });

// Student List's course filter (student.service.ts's buildStudentFilter) is
// an exact-match filter used on nearly every course-scoped view (course
// tabs, reports) — a genuinely frequent query pattern, unlike the other
// list() filters (hscInstitution/division/district/gender/birthdayToday),
// which are regex/low-selectivity and not worth indexing at this scale.
studentSchema.index({ course: 1 });

export const Student = model<StudentDoc>("Student", studentSchema);
