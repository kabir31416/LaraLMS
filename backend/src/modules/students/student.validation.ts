import { z } from "zod";
import { ADMISSION_TYPES, FEE_TYPES, GENDERS, STUDENT_STATUS } from "./student.constants";
import { RELATIONS } from "./student.constants";

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
    dob: z.string().min(1),
    rollNumber: z.string().trim().min(1),
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
 * admin-controlled — registrationId, currentRollNumber, name, phone, dob,
 * guardianMobile, bloodGroup, courseId, currentBatchId/status — is absent by
 * construction, not by a role check inside a shared schema, so there is no
 * way for a student's own PATCH .../self request to ever touch them.
 */
export const updateSelfSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z
    .object({
      photoUrl: z.string().optional(),
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
      guardianName: z.string().trim().optional(),
      guardianRelation: z.enum(RELATIONS).optional(),
      guardianOccupation: z.string().trim().optional(),
      guardianAddress: z.string().trim().optional(),
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
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
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
    batchId: z.string().optional(),
    directorId: z.string().optional(),
    feeType: z.enum(FEE_TYPES).optional(),
  }),
});
