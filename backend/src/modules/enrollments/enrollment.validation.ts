import { z } from "zod";

export const enrollSchema = z.object({
  params: z.object({ id: z.string().length(24) }), // studentId
  body: z.object({ batchId: z.string().length(24) }),
});

export const transferSchema = z.object({
  params: z.object({ id: z.string().length(24) }), // studentId
  body: z.object({
    toBatchId: z.string().length(24),
    reason: z.string().trim().min(1),
    newRollNumber: z.string().trim().optional(),
  }),
});

export const withdrawSchema = z.object({
  params: z.object({ id: z.string().length(24) }), // studentId
  body: z.object({ reason: z.string().trim().optional() }),
});

export const studentIdParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });
export const batchIdParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });
