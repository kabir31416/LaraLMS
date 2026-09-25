import { z } from "zod";
import { ADMISSION_ENTRY_STATUS, ADMISSION_TYPES, FEE_TYPES, GENDERS, HSC_SSC_GROUPS, STUDENT_STATUS } from "./student.constants";
import { RELATIONS } from "./student.constants";

/** ০.০০–৫.০০ (Bangladesh GPA scale) — the only existing convention to reuse is "GPA is a free-text string field," so this is a new-but-minimal format/range check, not a reinterpretation of stored data. Blank stays valid (GPA is the one HSC/SSC field that stays optional — HSC/SSC required-fields audit §6). */
const GPA_REGEX = /^[0-5](\.\d{1,2})?$/;
const gpaField = z
  .string()
  .trim()
  .regex(GPA_REGEX, "GPA সঠিকভাবে দিন (০.০০ থেকে ৫.০০ এর মধ্যে)")
  .optional()
  .or(z.literal(""));

/**
 * Shared by updateSelfSchema below and publicStudentEntry.validation.ts's
 * updatePublicProfileSchema — HSC/SSC required-fields + বিভাগ audit §5-§8:
 * every HSC/SSC field is mandatory except GPA, and বিভাগ (renamed from
 * গ্রুপ) is now a closed 3-value enum rather than free text. Kept as one
 * shared object (not copy-pasted into both `.strict()` schemas separately)
 * so the two public/portal self-edit surfaces can never drift out of sync
 * with each other again.
 */
export const hscSscEducationFields = {
  hscInstitution: z.string().trim().min(1, "HSC প্রতিষ্ঠানের নাম আবশ্যক"),
  hscBoard: z.string().trim().min(1, "HSC বোর্ড আবশ্যক"),
  hscPassingYear: z.string().trim().min(1, "HSC পাসের সাল আবশ্যক"),
  hscGroup: z.enum(HSC_SSC_GROUPS, { errorMap: () => ({ message: "HSC বিভাগ নির্বাচন করুন (বিজ্ঞান/মানবিক/ব্যবসায়)" }) }),
  hscGpa: gpaField,
  hscRoll: z.string().trim().min(1, "HSC রোল নম্বর আবশ্যক"),
  /** HSC/SSC "রেজিস্ট্রেশন নম্বর" (board registration number — unrelated to Student.currentRollNumber) is now optional, not every board issues one before results are out. */
  hscRegistrationNumber: z.string().trim().optional().or(z.literal("")),
  sscInstitution: z.string().trim().min(1, "SSC প্রতিষ্ঠানের নাম আবশ্যক"),
  sscBoard: z.string().trim().min(1, "SSC বোর্ড আবশ্যক"),
  sscPassingYear: z.string().trim().min(1, "SSC পাসের সাল আবশ্যক"),
  sscGroup: z.enum(HSC_SSC_GROUPS, { errorMap: () => ({ message: "SSC বিভাগ নির্বাচন করুন (বিজ্ঞান/মানবিক/ব্যবসায়)" }) }),
  sscGpa: gpaField,
  sscRoll: z.string().trim().min(1, "SSC রোল নম্বর আবশ্যক"),
  sscRegistrationNumber: z.string().trim().optional().or(z.literal("")),
};

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

/** The 3 fields Quick Admission requires — Phase 1 §2/§13. Everything else is filled in later. */
export const quickCreateStudentSchema = z.object({
  body: z.object({
    rollNumber: z.string().trim().min(1),
    name: z.string().trim().min(2),
    phone: z.string().trim().min(6),
  }),
});

/**
 * The Admission form's minimum required fields (Phase 4): Registration
 * Number/previous Roll Number, Name, DOB, Student Mobile, Guardian Mobile
 * and Course. Everything else stays optional — Admin can submit an
 * admission with just these six.
 *
 * totalCourseFee and admissionFee are deliberately ABSENT: the server always
 * resolves totalCourseFee from the selected Course's own `fee` field (never
 * trusts a client-typed value) and always applies Settings.admissionFeeBdt,
 * so neither can be typed or accidentally changed from this form
 * (student.service.ts's create).
 */
export const createStudentSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    phone: z.string().trim().min(6),
    /** DOB and Registration Number (রেজিস্ট্রেশন নম্বর, the coaching center's own currentRollNumber) are both optional on the main Admission form now — a student who doesn't have either yet can still be admitted and completes them later. */
    dob: z.string().min(1).optional(),
    rollNumber: z.string().trim().min(1).optional(),
    courseId: z.string().length(24),
    guardianMobile: z.string().trim().min(6),

    altPhone: z.string().trim().optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
    gender: z.enum(GENDERS).optional(),
    institution: z.string().trim().optional(),
    class: z.string().trim().optional(),
    bloodGroup: z.string().trim().optional(),
    religion: z.string().trim().optional(),
    fatherName: z.string().trim().optional(),
    motherName: z.string().trim().optional(),
    address: z.string().trim().optional(),
    presentAddress: z.string().trim().optional(),
    permanentAddress: z.string().trim().optional(),
    division: z.string().trim().optional(),
    district: z.string().trim().optional(),
    upazila: z.string().trim().optional(),
    postOffice: z.string().trim().optional(),
    postcode: z.string().trim().optional(),
    village: z.string().trim().optional(),
    hscInstitution: z.string().trim().optional(),
    hscBoard: z.string().trim().optional(),
    hscPassingYear: z.string().trim().optional(),
    hscGroup: z.string().trim().optional(),
    hscGpa: z.string().trim().optional(),
    hscRoll: z.string().trim().optional(),
    hscRegistrationNumber: z.string().trim().optional(),
    sscInstitution: z.string().trim().optional(),
    sscBoard: z.string().trim().optional(),
    sscPassingYear: z.string().trim().optional(),
    sscGroup: z.string().trim().optional(),
    sscGpa: z.string().trim().optional(),
    sscRoll: z.string().trim().optional(),
    sscRegistrationNumber: z.string().trim().optional(),
    section: z.string().trim().optional(),
    group: z.string().trim().optional(),
    subjects: z.array(z.string()).default([]),
    admissionDate: z.string().optional(),
    admissionType: z.enum(ADMISSION_TYPES).default("নতুন"),
    feeType: z.enum(FEE_TYPES).default("এককালীন"),
    courseDuration: z.number().default(0),
    monthlyFee: z.number().default(0),
    discount: z.number().min(0).default(0),
    /**
     * The admin's "the student actually agreed to pay this much for the
     * course" figure (Fees/Payment audit §1) — when present, the service
     * layer DERIVES `discount` from Course Fee minus this instead of using
     * the raw `discount` above, so the client never sends a discount value
     * directly through the Admission/Edit form anymore. Optional so every
     * other existing caller (bulk import, quickCreate, publicNewStudentEntry)
     * that never sends it is completely unaffected.
     */
    totalFee: z.number().min(0).optional(),
    paid: z.number().min(0).default(0),
    /** Only meaningful when paid > 0 — the admission-time Payment record's method (Phase 4). Validated against real PaymentMethod master data server-side, not a hard-coded enum. */
    paymentMethod: z.string().trim().min(1).max(40).optional(),

    guardianName: z.string().trim().optional(),
    guardianRelation: z.enum(RELATIONS).optional(),
    guardianOccupation: z.string().trim().optional(),
    guardianAddress: z.string().trim().optional(),
  }),
});

export const updateStudentSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: createStudentSchema.shape.body.partial(),
});

/**
 * Student-editable subset only (Phase 4 field-ownership split). Everything
 * admin-controlled — registrationId, currentRollNumber, name, phone,
 * guardianMobile, bloodGroup, courseId, currentBatchId/status — is absent by
 * construction, not by a role check inside a shared schema, so there is no
 * way for a student's own PATCH .../self request to ever touch them.
 * `dob` WAS on that admin-only list too, but is now student-editable here
 * (DOB self-edit audit §3) — the Student model already stores it as a plain
 * optional string (student.model.ts), so no schema/model change was needed,
 * only removing it from this exclusion list.
 *
 * `guardianOccupation`/`guardianAddress` were REMOVED from here (Guardian
 * পেশা/ঠিকানা audit §9) — neither StudentEntry.tsx nor student/StudentProfile.tsx
 * sends them anymore; `.strict()` below now rejects them outright rather
 * than silently accepting a value nothing in the UI can produce. A
 * student's previously-saved value stays in the database untouched — this
 * only closes the write path, it never reads or deletes anything.
 */
export const updateSelfSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z
    .object({
      photoUrl: z.string().optional(),
      dob: z.string().trim().min(1).optional(),
      presentAddress: z.string().trim().optional(),
      permanentAddress: z.string().trim().optional(),
      division: z.string().trim().optional(),
      district: z.string().trim().optional(),
      upazila: z.string().trim().optional(),
      postOffice: z.string().trim().optional(),
      postcode: z.string().trim().optional(),
      village: z.string().trim().optional(),
      ...hscSscEducationFields,
      guardianName: z.string().trim().optional(),
      guardianRelation: z.enum(RELATIONS).optional(),
    })
    .strict(),
});

export const updateRollSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({ rollNumber: z.string().trim().min(1) }),
});

export const updateStatusSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({ status: z.enum(STUDENT_STATUS) }),
});

/**
 * Admission Result feature. Loose shape validation only (trim, length) —
 * the numeric-digits business rule and the scoped-uniqueness check both
 * live in student.service.ts's updateAdmissionRoll (Bengali-digit input is
 * normalized there via toAsciiDigits before either check runs, same as
 * Roll Number elsewhere in this module).
 */
export const updateAdmissionRollSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({ admissionRoll: z.string().trim().min(1).max(20) }),
});

export const listStudentsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    ids: z.string().optional(), // comma-separated _ids — batched "these exact students" lookup
    course: z.string().optional(),
    courseId: z.string().optional(), // real Course _id — scopes Batch Assignment to the Batch's own Course

    section: z.string().optional(),
    batchId: z.string().optional(), // also accepts "unassigned"
    directorId: z.string().optional(),
    dueOnly: z.enum(["true", "false"]).optional(),
    dueStatus: z.enum(["all", "has", "none"]).optional(),
    hscInstitution: z.string().optional(),
    division: z.string().optional(),
    district: z.string().optional(),
    guardianMobile: z.string().optional(),
    gender: z.enum(GENDERS).optional(),
    birthdayToday: z.enum(["true", "false"]).optional(),
    profileStatus: z.enum(["incomplete", "complete"]).optional(),
    admissionRollStatus: z.enum(["added", "missing"]).optional(),
    feeType: z.enum(FEE_TYPES).optional(),
    /** Student Entry Workflow — omitted means "exclude pending/rejected" (student.service.ts's buildStudentFilter); the Admin Pending page is the one caller that sends this explicitly. */
    admissionStatus: z.enum(ADMISSION_ENTRY_STATUS).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const rejectEntrySchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({ reason: z.string().trim().max(500).optional() }),
});

export const admissionRollStatsQuerySchema = z.object({
  query: z.object({
    course: z.string().optional(),
    batchId: z.string().optional(),
    directorId: z.string().optional(),
  }),
});

export const dueStatsQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    course: z.string().optional(),
    /** The Due List's course filter (Fees/Payment audit §6) sends the real Course ref, matching listStudentsQuerySchema's own courseId — the legacy `course` (free-text name) param above is unrelated and still supported separately. */
    courseId: z.string().optional(),
    batchId: z.string().optional(),
    directorId: z.string().optional(),
    feeType: z.enum(FEE_TYPES).optional(),
    dueStatus: z.enum(["all", "has", "none"]).optional(),
  }),
});
