import { z } from "zod";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

export const createSubjectSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    courseId: z.string().length(24),
    status: z.enum(MASTER_DATA_STATUS).optional(),
    displayOrder: z.number().int().optional(),
  }),
});

export const updateSubjectSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    courseId: z.string().length(24).optional(),
    status: z.enum(MASTER_DATA_STATUS).optional(),
    displayOrder: z.number().int().optional(),
  }),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const listQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    courseId: z.string().length(24).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
