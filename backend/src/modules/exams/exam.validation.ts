import { z } from "zod";

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const createExamSchema = z.object({
  body: z.object({
    batchId: z.string().length(24),
    subjectId: z.string().length(24),
    lectureId: z.string().length(24),
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
    subjectId: z.string().length(24).optional(),
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
