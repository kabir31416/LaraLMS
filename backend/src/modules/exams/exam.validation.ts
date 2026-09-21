import { z } from "zod";

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const createExamSchema = z.object({
  body: z.object({
    batchId: z.string().length(24),
    courseSubjectId: z.string().length(24),
    /** Optional (Result Entry Lecture-optional audit §11) — matches submitResultSchema/saveResultSchema below. */
    lectureId: z.string().length(24).optional().or(z.literal("")),
    title: z.string().trim().min(1),
    fullMarks: z.number().positive(),
    date: z.string().min(1),
  }),
});

export const listExamsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    batchId: z.string().length(24).optional(),
    courseSubjectId: z.string().length(24).optional(),
    subjectId: z.string().length(24).optional(),
    lectureId: z.string().length(24).optional(),
    date: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const saveResultsSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    items: z.array(z.object({ studentId: z.string().length(24), marks: z.number().nullable() })).min(1),
  }),
});

/**
 * The unified Result Entry "Send Result" submission (Phase 5) — one call
 * that upserts the exam, saves marks + attendance together, and triggers
 * guardian SMS. Cross-field rules (Phase 5 §16):
 *   - fullMarks > 0
 *   - Absent  → marks must be null
 *   - Present → marks required, 0 <= marks <= fullMarks
 */
export const submitResultSchema = z.object({
  body: z
    .object({
      batchId: z.string().length(24),
      courseSubjectId: z.string().length(24),
      /**
       * Optional (Result Entry Lecture-optional audit §11) — a Batch
       * Director can Save/Send a result with no Lecture chosen. Accepts
       * an empty string too, since the frontend's Select's "cleared" state
       * is `""`, not `undefined`; exam.service.ts treats both the same way
       * (never passed to Lecture.findById).
       */
      lectureId: z.string().length(24).optional().or(z.literal("")),
      date: z.string().min(1),
      fullMarks: z.number().positive(),
      items: z
        .array(
          z.object({
            studentId: z.string().length(24),
            marks: z.number().nullable(),
            attendance: z.enum(["Present", "Absent"]),
          }),
        )
        .min(1),
    })
    .superRefine((v, ctx) => {
      v.items.forEach((item, i) => {
        if (item.attendance === "Absent" && item.marks !== null) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items", i, "marks"], message: "Absent students must have no marks" });
        }
        if (item.attendance === "Present") {
          if (item.marks === null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items", i, "marks"], message: "Present students require a mark" });
          } else if (item.marks < 0 || item.marks > v.fullMarks) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items", i, "marks"], message: `Mark must be between 0 and ${v.fullMarks}` });
          }
        }
      });
    }),
});

export const resendSmsSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({ studentIds: z.array(z.string().length(24)).min(1) }),
});

/** "Save Result" has the identical request shape as "Send Result" (submitResultSchema) — same fields, same cross-field mark/attendance rules — it's the same save step, just without the SMS phase. Reused as-is rather than duplicated. */
export const saveResultSchema = submitResultSchema;

export const updateResultSmsTemplateSchema = z.object({
  body: z.object({ template: z.string().trim().min(1).max(2000) }),
});

export const listResultsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    examId: z.string().length(24).optional(),
    examIds: z.string().optional(), // comma-separated
    studentId: z.string().length(24).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
