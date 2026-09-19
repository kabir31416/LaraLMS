import { z } from "zod";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";
import { STOCK_ADJUSTMENT_REASONS } from "./stockMovement.model";

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

const materialBodyBase = z.object({
  name: z.string().trim().min(1).max(150),
  materialType: z.string().trim().min(1),
  courseId: z.string().length(24),
  subjectId: z.string().length(24).optional(),
  isPaid: z.boolean(),
  price: z.number().min(0).default(0),
  openingStock: z.number().min(0).default(0),
  minimumStock: z.number().min(0).default(0),
  status: z.enum(MASTER_DATA_STATUS).optional(),
  description: z.string().trim().max(500).optional(),
});

/** §1: Free ⇒ price must be 0; Paid ⇒ price required and > 0 — enforced here, not just on the frontend. */
function checkPriceRule<T extends { isPaid: boolean; price: number }>(data: T, ctx: z.RefinementCtx) {
  if (data.isPaid && data.price <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "পেইড ম্যাটেরিয়ালের জন্য মূল্য অবশ্যই শূন্যের বেশি হতে হবে" });
  }
}

export const createMaterialSchema = z.object({
  body: materialBodyBase.superRefine(checkPriceRule),
});

export const updateMaterialSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: materialBodyBase.partial().superRefine((data, ctx) => {
    if (data.isPaid !== undefined && data.price !== undefined) checkPriceRule({ isPaid: data.isPaid, price: data.price }, ctx);
  }),
});

export const listMaterialsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    materialType: z.string().optional(),
    courseId: z.string().length(24).optional(),
    subjectId: z.string().length(24).optional(),
    isPaid: z.enum(["true", "false"]).optional(),
    stockStatus: z.enum(["low", "out"]).optional(),
    status: z.enum(MASTER_DATA_STATUS).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const deactivateMaterialSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({ status: z.enum(MASTER_DATA_STATUS) }),
});

export const addStockSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    quantity: z.number().positive(),
    reason: z.string().trim().max(300).optional(),
  }),
});

export const adjustStockSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    quantity: z.number().int().refine((v) => v !== 0, "quantity must not be zero"), // signed delta — negative for a shortage, positive for a found surplus
    reason: z.enum(STOCK_ADJUSTMENT_REASONS),
    note: z.string().trim().max(300).optional(),
  }),
});

export const listMovementsQuerySchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

const distributionItemSchema = z.object({ materialId: z.string().length(24), quantity: z.number().int().positive() });

export const checkDuplicateSchema = z.object({
  body: z.object({
    studentId: z.string().length(24),
    materialIds: z.array(z.string().length(24)).min(1),
  }),
});

export const createDistributionSchema = z.object({
  body: z.object({
    studentId: z.string().length(24),
    items: z.array(distributionItemSchema).min(1),
    distributionDate: z.string().optional(),
    note: z.string().trim().max(300).optional(),
    collectPayment: z.object({ method: z.string().trim().min(1) }).optional(),
  }),
});

export const listDistributionsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    studentId: z.string().length(24).optional(),
    batchId: z.string().optional(),
    courseId: z.string().length(24).optional(),
    materialId: z.string().length(24).optional(),
    status: z.enum(["ACTIVE", "REVERSED"]).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const reverseDistributionSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({ reason: z.string().trim().min(1).max(300) }),
});

export const studentIdParamSchema = z.object({ params: z.object({ studentId: z.string().length(24) }) });

export const dashboardQuerySchema = z.object({ query: z.object({}) });

export const reportQuerySchema = z.object({
  query: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    courseId: z.string().length(24).optional(),
    batchId: z.string().optional(),
    materialId: z.string().length(24).optional(),
    materialType: z.string().optional(),
    isPaid: z.enum(["true", "false"]).optional(),
    studentId: z.string().length(24).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
