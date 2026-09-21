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
  // directorId alone also accepts `null` here (create's own schema doesn't
  // need this — a brand-new batch has no prior director to clear) so an
  // admin can explicitly unassign a Batch Director; omitting the key still
  // means "leave it untouched", exactly as .partial() already gives every
  // other field (Batch Director unassignment audit §10).
  body: createBatchSchema.shape.body.partial().extend({
    directorId: z.union([z.string().length(24), z.null()]).optional(),
  }),
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
