import { z } from "zod";

export const createUserSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(3),
    password: z.string().min(6).optional(), // if omitted, a temp password is generated (Phase 2 §13)
    roleId: z.string().length(24),
    linkedStaffId: z.string().length(24).optional(),
    linkedStudentId: z.string().length(24).optional(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    roleId: z.string().length(24).optional(),
    status: z.enum(["active", "locked"]).optional(),
    overridePermissions: z.array(z.string()).optional(),
  }),
});

export const userIdParamSchema = z.object({ params: z.object({ id: z.string().length(24) }) });

export const listUsersQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    roleId: z.string().length(24).optional(),
    status: z.enum(["active", "locked"]).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});
