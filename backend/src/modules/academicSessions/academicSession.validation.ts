import { z } from "zod";

export const createAcademicSessionSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(50),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  }),
});

export const updateAcademicSessionSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    name: z.string().trim().min(2).max(50).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const listQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
