import { z } from "zod";
import { RELATIONS } from "../students/student.constants";

export const createGuardianSchema = z.object({
  params: z.object({ studentId: z.string().length(24) }),
  body: z.object({
    name: z.string().trim().min(2),
    relation: z.enum(RELATIONS),
    phone: z.string().trim().min(6),
    occupation: z.string().trim().optional(),
    address: z.string().trim().optional(),
    isPrimary: z.boolean().default(false),
  }),
});

export const updateGuardianSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    name: z.string().trim().min(2).optional(),
    relation: z.enum(RELATIONS).optional(),
    phone: z.string().trim().min(6).optional(),
    occupation: z.string().trim().optional(),
    address: z.string().trim().optional(),
    isPrimary: z.boolean().optional(),
  }),
});

export const guardianIdParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });
export const studentIdParamSchema = z.object({ params: z.object({ studentId: z.string().length(24) }) });
