import { z } from "zod";
import { RESULT_ROUNDS, SELECTION_TYPES } from "./admissionResult.model";

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const uploadImportSchema = z.object({
  body: z.object({
    programId: z.string().length(24).optional(),
    sessionId: z.string().length(24),
    resultRound: z.enum(RESULT_ROUNDS),
  }),
});

export const confirmOrCancelParamSchema = z.object({ params: z.object({ importId: z.string().length(24) }) });

export const matchUnmatchedSchema = z.object({
  params: z.object({ importId: z.string().length(24), index: z.string().regex(/^\d+$/) }),
  body: z.object({ studentId: z.string().length(24) }),
});

export const listChanceStudentsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    programName: z.string().optional(),
    session: z.string().optional(),
    batchId: z.string().optional(),
    instituteName: z.string().optional(),
    resultRound: z.enum(RESULT_ROUNDS).optional(),
    selectionType: z.enum(SELECTION_TYPES).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const summaryQuerySchema = z.object({
  query: z.object({
    programName: z.string().optional(),
    session: z.string().optional(),
    batchId: z.string().optional(),
    instituteName: z.string().optional(),
    resultRound: z.enum(RESULT_ROUNDS).optional(),
    selectionType: z.enum(SELECTION_TYPES).optional(),
  }),
});

export const listImportsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const studentIdParamSchema = z.object({ params: z.object({ studentId: z.string().length(24) }) });
