import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(3),
    password: z.string().min(1),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
  }),
});
