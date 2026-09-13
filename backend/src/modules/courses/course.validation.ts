import { z } from "zod";

export const createCourseSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    sessionId: z.string().length(24),
    duration: z.number().int().positive(),
    fee: z.number().min(0).default(0),
  }),
});

export const updateCourseSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    sessionId: z.string().length(24).optional(),
    duration: z.number().int().positive().optional(),
    fee: z.number().min(0).optional(),
  }),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const listQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    sessionId: z.string().length(24).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
