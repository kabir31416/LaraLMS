import { z } from "zod";

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1),
    address: z.string().trim().optional(),
    director: z.string().trim().optional(),
    phone: z.string().trim().optional(),
  }),
});

export const updateBranchSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: createBranchSchema.shape.body.partial(),
});

export const listBranchesQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
  }),
});
