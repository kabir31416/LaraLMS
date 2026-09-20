import { z } from "zod";

export const sessionIdParamSchema = z.object({ params: z.object({ sessionId: z.string().length(24) }) });

export const rowActionParamSchema = z.object({
  params: z.object({ sessionId: z.string().length(24), rowId: z.string().length(24) }),
});

export const listRowsQuerySchema = z.object({
  params: z.object({ sessionId: z.string().length(24) }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    importStatus: z.enum(["PENDING", "PROCESSING", "APPROVED", "REJECTED", "FAILED"]).optional(),
    validationStatus: z.enum(["VALID", "WARNING", "ERROR"]).optional(),
  }),
});

export const rejectRowSchema = z.object({
  params: z.object({ sessionId: z.string().length(24), rowId: z.string().length(24) }),
  body: z.object({ reason: z.string().trim().min(1).max(300) }),
});

/** Bulk Approval — capped at MAX_IMPORT_ROWS (studentImport.excel.ts) since that's already the largest a single session can ever contain. */
export const bulkApproveSchema = z.object({
  params: z.object({ sessionId: z.string().length(24) }),
  body: z.object({ rowIds: z.array(z.string().length(24)).min(1).max(2000) }),
});

export const listSessionsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
