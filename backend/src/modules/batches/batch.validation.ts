import { z } from "zod";
import { WEEK_DAYS } from "./batch.model";

export const createBatchSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    courseId: z.string().length(24),
    batchTime: z.string().trim().min(1),
    days: z.array(z.enum(WEEK_DAYS)).default([]),
    roomNumber: z.string().trim().optional(),
    directorId: z.string().length(24).optional(),
    startDate: z.string().min(1),
  }),
});

export const updateBatchSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: createBatchSchema.shape.body.partial(),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const listBatchesQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    courseId: z.string().length(24).optional(),
    directorId: z.string().length(24).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const enrollBulkSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({ studentIds: z.array(z.string().length(24)).min(1) }),
});
