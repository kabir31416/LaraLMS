import { z } from "zod";

/**
 * The public /newstudententry quick-admission form — EXACTLY the 6 fields
 * the form collects (name/roll/phone/guardianMobile/course/batch), plus an
 * OPTIONAL photo handled separately via multer (never part of this JSON/
 * form-field schema — see publicNewStudentEntry.routes.ts's photoUpload
 * middleware). Deliberately its own schema, not `createStudentSchema`
 * (student.validation.ts) — that one requires `dob` for the full Admin
 * Admission form, which this page must never ask for. Every other Student
 * field this student will ever have is filled in later through the existing
 * Student Profile (Admin edit / Student Portal), the same as any
 * Excel-imported student who also starts with only a subset of fields set.
 *
 * Student Entry Workflow — `batchId` is now required (it wasn't before):
 * this submission creates a `"pending"` application requesting a specific
 * batch, not an immediately-active, unenrolled student.
 */
export const registerNewStudentSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    rollNumber: z.string().trim().min(1),
    phone: z.string().trim().min(6),
    guardianMobile: z.string().trim().min(6),
    courseId: z.string().length(24),
    batchId: z.string().length(24),
  }),
});

export const listBatchesQuerySchema = z.object({
  query: z.object({ courseId: z.string().length(24) }),
});
