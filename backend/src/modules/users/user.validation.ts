import { z } from "zod";

export const createUserSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(3),
    // No lower bound beyond "non-empty": a Student login's password is
    // often set to the student's Roll Number, which can be as short as one
    // or two digits — the real defenses are bcrypt hashing + authLimiter's
    // brute-force throttling, not string length. Omit entirely for a
    // server-generated temp password (Phase 2 §13).
    password: z.string().min(1).optional(),
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
    linkedStaffId: z.string().length(24).optional(),
    linkedStudentId: z.string().length(24).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

/**
 * Admin-forced credential reset — the only way to fix a login whose
 * password no longer matches (e.g. a Student's Roll Number was changed
 * after their login was created). Distinct from self-service change-password,
 * which requires knowing the current password.
 */
export const resetCredentialsSchema = z.object({
  params: z.object({ id: z.string().length(24) }),
  body: z.object({
    identifier: z.string().trim().min(3).optional(),
    password: z.string().min(1),
  }),
});
