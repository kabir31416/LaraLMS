import { z } from "zod";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd");
const pct = z.coerce.number().min(0).max(100);

export const performanceQuerySchema = z.object({
  query: z
    .object({
      sessionId: objectId.optional(),
      courseId: objectId.optional(),
      batchId: objectId.optional(),
      studentId: objectId.optional(),
      q: z.string().trim().max(60).optional(),
      examId: objectId.optional(),
      subjectId: objectId.optional(),
      dateFrom: ymd.optional(),
      dateTo: ymd.optional(),
      attendanceMin: pct.optional(),
      attendanceMax: pct.optional(),
      status: z.enum(["excellent", "good", "average", "needs_improvement", "insufficient", "at_risk", "improving", "declining", "low_attendance"]).optional(),
      sort: z.enum(["risk", "percentage_desc", "percentage_asc", "attendance_asc", "attendance_desc", "trend", "name"]).optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      fresh: z.enum(["0", "1"]).optional(),
      export: z.enum(["0", "1"]).optional(),
    })
    .refine((q) => !q.dateFrom || !q.dateTo || q.dateFrom <= q.dateTo, { message: "dateFrom must be on or before dateTo" })
    .refine((q) => q.attendanceMin === undefined || q.attendanceMax === undefined || q.attendanceMin <= q.attendanceMax, { message: "attendanceMin must be ≤ attendanceMax" }),
});

export const optionsQuerySchema = z.object({
  query: z.object({ courseId: objectId.optional(), batchId: objectId.optional() }),
});

export const studentProfileSchema = z.object({
  params: z.object({ id: objectId }),
  query: z.object({ dateFrom: ymd.optional(), dateTo: ymd.optional(), subjectId: objectId.optional() }),
});

export const myPerformanceSchema = z.object({
  query: z.object({ dateFrom: ymd.optional(), dateTo: ymd.optional(), subjectId: objectId.optional() }),
});
