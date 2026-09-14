import { z } from "zod";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const createPaymentMethodSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(40),
    status: z.enum(MASTER_DATA_STATUS).optional(),
    displayOrder: z.number().int().optional(),
  }),
});

export const updatePaymentMethodSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    name: z.string().trim().min(1).max(40).optional(),
    status: z.enum(MASTER_DATA_STATUS).optional(),
    displayOrder: z.number().int().optional(),
  }),
});

export const listQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
