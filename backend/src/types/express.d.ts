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
    }
  }
}
