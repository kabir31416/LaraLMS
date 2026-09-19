import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";

/**
 * Verifies the access JWT and attaches req.user (Phase 2 §13/§14).
 * Every route requires this except the two /public/* endpoints, which never
 * mount it at all rather than mounting-and-skipping — see modules/publicInfo.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing or malformed Authorization header"));
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      roleId: payload.roleId,
      role: payload.role,
      permissions: payload.permissions,
      staffId: payload.staffId,
      studentId: payload.studentId,
      isSuperAdmin: payload.isSuperAdmin,
    };
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired access token"));
  }
}
