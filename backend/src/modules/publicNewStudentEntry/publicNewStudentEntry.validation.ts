import { z } from "zod";

/**
 * The public /newstudententry quick-admission form — EXACTLY the 5 fields
 * the form collects, nothing else. Deliberately its own schema, not
 * `createStudentSchema` (student.validation.ts) — that one requires `dob`
 * for the full Admin Admission form, which this page must never ask for.
 * Every other Student field this student will ever have is filled in later
 * through the existing Student Profile (Admin edit / Student Portal), the
 * same as any Excel-imported student who also starts with only a subset of
 * fields set.
 */
export const registerNewStudentSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    rollNumber: z.string().trim().min(1),
    phone: z.string().trim().min(6),
    guardianMobile: z.string().trim().min(6),
    courseId: z.string().length(24),
  }),
});
