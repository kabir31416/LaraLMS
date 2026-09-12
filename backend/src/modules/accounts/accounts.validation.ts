import { z } from "zod";
import { PAYMENT_METHODS, TRANSACTION_SOURCES } from "./income.model";
import { BRANCH_ITEM_TYPES, BRANCH_LEDGER_TYPES } from "./branchLedger.model";

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const createIncomeSchema = z.object({
  body: z.object({
    date: z.string().min(1),
    category: z.string().trim().min(1),
    amount: z.number().positive(),
    branchId: z.string().length(24),
    method: z.enum(PAYMENT_METHODS),
    studentId: z.string().length(24).optional(),
    note: z.string().trim().optional(),
    source: z.enum(TRANSACTION_SOURCES).default("manual"),
    refId: z.string().optional(),
  }),
});

export const updateIncomeSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: createIncomeSchema.shape.body.partial(),
});

export const listIncomeQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    branchId: z.string().length(24).optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const createExpenseSchema = z.object({
  body: z.object({
    date: z.string().min(1),
    category: z.string().trim().min(1),
    amount: z.number().positive(),
    branchId: z.string().length(24),
    method: z.enum(PAYMENT_METHODS),
    note: z.string().trim().optional(),
  }),
});

export const updateExpenseSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: createExpenseSchema.shape.body.partial(),
});

export const listExpenseQuerySchema = listIncomeQuerySchema;

export const updateCategoriesSchema = z.object({
  body: z.object({
    incomeCategories: z.array(z.string().trim().min(1)).optional(),
    expenseCategories: z.array(z.string().trim().min(1)).optional(),
  }),
});

const branchLedgerBodySchema = z.object({
  date: z.string().min(1),
  branchId: z.string().length(24),
  type: z.enum(BRANCH_LEDGER_TYPES),
  itemType: z.enum(BRANCH_ITEM_TYPES).optional(),
  description: z.string().trim().optional(),
  quantity: z.number().min(0).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  amount: z.number().positive(),
  note: z.string().trim().optional(),
});

export const createBranchLedgerSchema = z.object({
  body: branchLedgerBodySchema.refine((v) => v.type !== "income" || !!v.method, {
    message: "method is required for income entries",
    path: ["method"],
  }),
});

export const updateBranchLedgerSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: branchLedgerBodySchema.partial(),
});

export const listBranchLedgerQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    branchId: z.string().length(24).optional(),
    date: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
