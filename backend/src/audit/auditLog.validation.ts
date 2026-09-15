import { z } from "zod";

export const listAuditLogsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    module: z.string().optional(),
    action: z.string().optional(),
    actorUserId: z.string().length(24).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
