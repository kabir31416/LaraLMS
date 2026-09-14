import { z } from "zod";
import { FEE_TYPES } from "../students/student.constants";

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

/**
 * paidAmount is deliberately absent — the service computes it server-side
 * (amount - discount + fine) rather than trusting whatever the client sends.
 * `method` is validated against real PaymentMethod master data in the
 * service layer (assertActiveMethod), not a hard-coded zod enum anymore.
 */
export const createPaymentSchema = z.object({
  body: z.object({
    studentId: z.string().length(24),
    date: z.string().optional(),
    amount: z.number().positive(),
    discount: z.number().min(0).default(0),
    fine: z.number().min(0).default(0),
    method: z.string().trim().min(1).max(40),
    feeType: z.enum(FEE_TYPES),
    month: z.string().trim().optional(),
    note: z.string().trim().optional(),
  }),
});

export const listPaymentsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    studentId: z.string().length(24).optional(),
    feeType: z.enum(FEE_TYPES).optional(),
    method: z.string().trim().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
