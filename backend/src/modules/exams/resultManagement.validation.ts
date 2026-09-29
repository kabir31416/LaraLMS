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

/** Shared by both the preview and the actual "Delete Results by Date" call so they can never validate the filter differently. */
export const deleteResultsByDateSchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ অবশ্যই YYYY-MM-DD ফরম্যাটে হতে হবে"),
    courseId: z.string().length(24).optional(),
    batchId: z.string().length(24).optional(),
    subjectId: z.string().length(24).optional(),
    examId: z.string().length(24).optional(),
  }),
});
