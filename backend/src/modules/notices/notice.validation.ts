import { z } from "zod";
import { NOTICE_PRIORITIES, NOTICE_TYPES } from "./notice.model";

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const createNoticeSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    type: z.enum(NOTICE_TYPES).default("All"),
    targetId: z.string().trim().optional(),
    publishDate: z.string().min(1),
    expiryDate: z.string().optional(),
    priority: z.enum(NOTICE_PRIORITIES).default("Normal"),
    pinned: z.boolean().default(false),
  }),
});

export const updateNoticeSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: createNoticeSchema.shape.body.partial(),
});

export const listNoticesQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    type: z.enum(NOTICE_TYPES).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
