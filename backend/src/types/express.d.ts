import "express";

export interface AuthUser {
  id: string;
  roleId: string;
  role: string;
  permissions: string[];
  staffId?: string;
  studentId?: string;
  isSuperAdmin?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
      /**
       * Set only by studentEntryAuth.middleware.ts after verifying a public
       * Student Entry token (publicStudentEntry module) — deliberately never
       * `req.user`, so nothing in the real RBAC system (requirePermission/
       * requireRole/requireSelf) can ever mistake this for an authenticated
       * Admin/Staff/Student session. The one Student ID this request may act
       * on; every public-entry service function derives identity from this,
       * never from a client-supplied ID.
       */
      studentEntryId?: string;
    }
  }
}
