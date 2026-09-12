import { z } from "zod";

export const createLectureSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(120),
    subjectId: z.string().length(24),
    lectureNumber: z.number().int().positive(),
    description: z.string().trim().max(500).optional(),
  }),
});

export const updateLectureSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    title: z.string().trim().min(2).max(120).optional(),
    subjectId: z.string().length(24).optional(),
    lectureNumber: z.number().int().positive().optional(),
    description: z.string().trim().max(500).optional(),
  }),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const listQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    subjectId: z.string().length(24).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
