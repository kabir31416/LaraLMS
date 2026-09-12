import { z } from "zod";
import { ATTENDANCE_SOURCE, ATTENDANCE_STATUS } from "./attendance.model";

export const saveAttendanceSchema = z.object({
  body: z
    .object({
      batchId: z.string().length(24),
      date: z.string().min(1),
      items: z.array(z.object({ studentId: z.string().length(24), status: z.enum(ATTENDANCE_STATUS) })).min(1),
      source: z.enum(ATTENDANCE_SOURCE).default("Manual"),
      examId: z.string().length(24).optional(),
    })
    .refine((v) => v.source !== "Exam" || !!v.examId, { message: "examId is required when source is Exam", path: ["examId"] }),
});

export const listAttendanceQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    batchId: z.string().length(24).optional(),
    studentId: z.string().length(24).optional(),
    date: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    source: z.enum(ATTENDANCE_SOURCE).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const percentQuerySchema = z.object({
  query: z.object({
    studentId: z.string().length(24).optional(),
    studentIds: z.string().optional(), // comma-separated
    batchId: z.string().length(24).optional(),
    batchIds: z.string().optional(), // comma-separated
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
});
