import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { verifyShortLivedToken } from "../utils/jwt";

/** Only ever produced by publicStudentEntry.service.ts's verify(), on a successful registration/roll + phone match. */
export interface StudentEntryTokenPayload {
  purpose: "student-entry";
  studentId: string;
}

/**
 * Verifies the short-lived Student Entry token and attaches req.studentEntryId
 * — a completely separate identity channel from req.user (auth.middleware.ts),
 * so nothing in the real RBAC system can ever treat a Student Entry session
 * as an authenticated login, and this token can never be used against any
 * `requireAuth`-gated route (Public Security §15). The `purpose` claim
 * guards against a token issued for some *other* future short-lived-token
 * use case being replayed here, since both would otherwise share the same
 * signing secret (jwt.ts's signShortLivedToken/verifyShortLivedToken).
 */
export function requireStudentEntryToken(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Verification session expired — please verify again"));
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyShortLivedToken<StudentEntryTokenPayload>(token);
    if (payload.purpose !== "student-entry" || !payload.studentId) {
      throw new Error("wrong token purpose");
    }
    req.studentEntryId = payload.studentId;
    next();
  } catch {
    next(ApiError.unauthorized("Verification session expired — please verify again"));
  }
}
