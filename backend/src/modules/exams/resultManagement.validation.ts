import { z } from "zod";

export const studentIdParamSchema = z.object({ params: z.object({ studentId: z.string().length(24) }) });

export const listStudentResultsQuerySchema = z.object({
  query: z.object({
    batchId: z.string().length(24).optional(),
    search: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const topStudentsQuerySchema = z.object({
  query: z.object({
    batchId: z.string().length(24).optional(),
    limit: z.string().optional(),
  }),
});

export const batchResultsQuerySchema = z.object({
  query: z.object({
    batchId: z.string().length(24),
    subjectId: z.string().length(24).optional(),
    lectureId: z.string().length(24).optional(),
    examId: z.string().length(24).optional(),
  }),
});

export const updateResultMarkSchema = z.object({
  params: z.object({ resultId: z.string().length(24) }),
  body: z.object({ marks: z.number().min(0).nullable() }),
});
