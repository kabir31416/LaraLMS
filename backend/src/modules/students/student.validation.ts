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

const guardianFields = {
  guardianName: z.string().trim().optional(),
  guardianRelation: z.enum(RELATIONS).optional(),
  guardianMobile: z.string().trim().optional(),
};

/** The existing full Admission form, unchanged field-for-field. */
export const createStudentSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    phone: z.string().trim().min(6),
    altPhone: z.string().trim().optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
    dob: z.string().optional(),
    gender: z.enum(GENDERS).optional(),
    institution: z.string().trim().optional(),
    class: z.string().trim().optional(),
    address: z.string().trim().optional(),
    course: z.string().trim().optional(),
    section: z.string().trim().optional(),
    group: z.string().trim().optional(),
    subjects: z.array(z.string()).default([]),
    admissionDate: z.string().optional(),
    admissionType: z.enum(ADMISSION_TYPES).default("নতুন"),
    feeType: z.enum(FEE_TYPES).default("এককালীন"),
    courseDuration: z.number().default(0),
    totalCourseFee: z.number().default(0),
    admissionFee: z.number().default(0),
    monthlyFee: z.number().default(0),
    discount: z.number().default(0),
    paid: z.number().default(0),
    rollNumber: z.string().trim().optional(),
    ...guardianFields,
  }),
});

export const updateStudentSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: createStudentSchema.shape.body.partial(),
});

/** Student-editable subset only — Phase 1 §13. Admin-controlled fields (roll, fees, status, enrollment) are absent by construction, not by a role check inside a shared schema. */
export const updateSelfSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z
    .object({
      photoUrl: z.string().optional(),
      dob: z.string().optional(),
      gender: z.enum(GENDERS).optional(),
      altPhone: z.string().trim().optional(),
      email: z.string().trim().email().optional().or(z.literal("")),
      institution: z.string().trim().optional(),
      address: z.string().trim().optional(),
      guardianName: z.string().trim().optional(),
      guardianRelation: z.enum(RELATIONS).optional(),
      guardianMobile: z.string().trim().optional(),
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

export const listStudentsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    course: z.string().optional(),
    section: z.string().optional(),
    batchId: z.string().optional(), // also accepts "unassigned"
    directorId: z.string().optional(),
    dueOnly: z.enum(["true", "false"]).optional(),
    profileStatus: z.enum(["incomplete", "complete"]).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
