import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Permission-key RBAC gate — answers "can this role do this action at all."
 * Scope ("on which records") is a separate concern applied inside each
 * module's service, e.g. filtering batches by directorId — Phase 2 §14.
 */
export function requirePermission(...anyOf: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    const has = req.user.permissions.includes("*") || anyOf.some((p) => req.user!.permissions.includes(p));
    if (!has) return next(ApiError.forbidden(`Missing permission: ${anyOf.join(" or ")}`));
    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden(`Requires role: ${roles.join(" or ")}`));
    next();
  };
}

/** For self-service routes like PATCH /students/:id/self — passes if the caller IS the resource, regardless of permissions. */
export function requireSelf(paramName: string, resourceKey: "studentId" | "staffId" = "studentId") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user[resourceKey] && req.user[resourceKey] === req.params[paramName]) return next();
    return next(ApiError.forbidden("You may only access your own record"));
  };
}

/**
 * For a GET that both staff (broad permission) and the resource's own owner
 * (a narrower "self" permission) may call — e.g. GET /students/:id, where
 * Admin/Director hold STUDENTS_READ* and a Student only holds
 * STUDENTS_UPDATE_SELF. Without this, granting a student that self-service
 * permission at all would let requirePermission's OR-of-keys check pass it
 * straight through to read *any* student's record, not just their own.
 */
export function requirePermissionOrSelf(
  broadPermissions: string[],
  selfPermission: string,
  paramName: string,
  resourceKey: "studentId" | "staffId" = "studentId",
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    const perms = req.user.permissions;
    if (perms.includes("*") || broadPermissions.some((p) => perms.includes(p))) return next();
    if (perms.includes(selfPermission)) return requireSelf(paramName, resourceKey)(req, _res, next);
    return next(ApiError.forbidden("Missing permission"));
  };
}
