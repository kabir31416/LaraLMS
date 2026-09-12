import { z } from "zod";

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const createBookSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1),
    subject: z.string().trim().min(1),
    class: z.string().trim().min(1),
    author: z.string().trim().optional(),
    price: z.number().min(0),
    totalStock: z.number().min(0).default(0),
    lowStockThreshold: z.number().min(0).default(0),
  }),
});

export const updateBookSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: createBookSchema.shape.body.partial(),
});

export const listBooksQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    subject: z.string().optional(),
    class: z.string().optional(),
    lowStockOnly: z.enum(["true", "false"]).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const stockAdjustSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    action: z.enum(["add", "reduce"]),
    quantity: z.number().positive(),
    note: z.string().trim().optional(),
  }),
});

const transferItemSchema = z.object({ bookId: z.string().length(24), quantity: z.number().positive() });

export const transferToBranchSchema = z.object({
  body: z.object({
    branchId: z.string().trim().min(1),
    items: z.array(transferItemSchema).min(1),
  }),
});

export const listBranchStockQuerySchema = z.object({
  query: z.object({
    branchId: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const issueToStudentSchema = z.object({
  body: z.object({
    studentId: z.string().length(24),
    issueDate: z.string().min(1),
    items: z.array(transferItemSchema).min(1),
  }),
});

export const listBookIssuesQuerySchema = z.object({
  query: z.object({
    studentId: z.string().length(24).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const returnBookSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({ quantity: z.number().positive() }),
});

export const listHistoryQuerySchema = z.object({
  query: z.object({
    action: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
