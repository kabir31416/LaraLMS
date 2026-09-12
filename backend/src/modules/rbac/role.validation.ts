import { z } from "zod";
import { ALL_PERMISSION_KEYS } from "./permissions";

const permissionValue = z.string().refine((v) => v === "*" || ALL_PERMISSION_KEYS.includes(v), {
  message: "Unknown permission key",
});

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(50),
    permissions: z.array(permissionValue).default([]),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    permissions: z.array(permissionValue).optional(),
  }),
});

export const roleIdParamSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
});
