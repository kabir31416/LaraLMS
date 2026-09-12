import { z } from "zod";
import { STAFF_STATUS, STAFF_TYPES } from "./staff.model";

export const createStaffSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    phone: z.string().trim().min(6),
    email: z.string().trim().email().optional().or(z.literal("")),
    address: z.string().trim().optional(),
    photoUrl: z.string().optional(),
    staffType: z.enum(STAFF_TYPES),
    salary: z.number().min(0).default(0),
    joinDate: z.string().min(1),
  }),
});

export const updateStaffSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: createStaffSchema.shape.body.partial().extend({
    status: z.enum(STAFF_STATUS).optional(),
  }),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const listStaffQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    staffType: z.enum(STAFF_TYPES).optional(),
    status: z.enum(STAFF_STATUS).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
