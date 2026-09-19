import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiClientError, getAccessToken, onSessionExpired, setAccessToken, setHasRefreshCapability } from "@/lib/apiClient";

export type Role = "Admin" | "Batch Director" | "Student";

export interface AuthUser {
  id: string;
  identifier: string;
  staffId?: string;
  studentId?: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
  /**
   * Only meaningfully populated for an Admin login (see toAuthUser) — the
   * same permission-key array the backend computes for the access token
   * (auth.service.ts's resolvePermissions), surfaced here purely so the
   * Admin UI can conditionally show/hide something (e.g. the Admission
   * Result nav item for an individually-restricted Admin) without decoding
   * the JWT. Never the actual enforcement — every sensitive action is still
   * checked server-side regardless of what this array says.
   */
  permissions?: string[];
  /**
   * True only for the original seeded root Admin account (backend's
   * User.isSuperAdmin) — surfaced purely so the Admin UI can hide/disable
   * editing another Admin's staff record or resetting their password for
   * anyone else. The backend enforces this regardless (staff.service.ts's
   * update()/remove(), user.service.ts's updateUser()/resetCredentials()/
   * deleteUser() all reject it server-side) — this is just to avoid
   * showing an action that would 403 anyway.
   */
  isSuperAdmin?: boolean;
}

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    identifier: string;
    role: string;
    mustChangePassword: boolean;
    staffId?: string;
    studentId?: string;
    permissions?: string[];
    isSuperAdmin?: boolean;
  };
}

interface StudentLoginResponse {
  accessToken: string;
  student: {
    id: string;
    name: string;
    phone: string;
    currentRollNumber?: string;
  };
}

interface StaffLoginResponse {
  accessToken: string;
  staff: {
    id: string;
    name: string;
    phone: string;
    staffId?: string;
    staffType: string;
    role: string;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  /** True while the app is trying to restore a session from the refresh cookie (or, for a student/staff, localStorage) on first load. */
  initializing: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  studentLogin: (phone: string, rollNumber: string) => Promise<void>;
  staffLogin: (phone: string, staffId: string) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Student sessions have no server-side refresh record (auth.service.ts's studentLogin writes nothing) — persisted here instead so a reload doesn't log them out. */
const STUDENT_SESSION_KEY = "laralms_student_session";
/** Same reasoning as STUDENT_SESSION_KEY, for a Staff Portal (phone + Staff ID) session — see auth.service.ts's staffLogin. */
const STAFF_SESSION_KEY = "laralms_staff_session";

/**
 * Backend role names (Phase 2 §14, "module:action" / lowercase-snake convention)
 * mapped to the display Role type every existing page/component already expects —
 * this is the only place that mapping needs to live.
 */
function toDisplayRole(backendRole: string): Role {
  if (backendRole === "batch_director") return "Batch Director";
  if (backendRole === "student") return "Student";
  return "Admin";
}

function toAuthUser(u: LoginResponse["user"]): AuthUser {
  return {
    id: u.id,
    identifier: u.identifier,
    staffId: u.staffId,
    studentId: u.studentId,
    // Staff/Student modules (Phase 3, Modules 10-14) will enrich this with a
    // real display name once a user record is linked to one; until then the
    // login identifier is shown, which is always at least correct.
    name: u.identifier,
    role: toDisplayRole(u.role),
    mustChangePassword: u.mustChangePassword,
    permissions: u.permissions,
    isSuperAdmin: u.isSuperAdmin,
  };
}

/** "*" (unrestricted) or an explicit inclusion — mirrors the backend's own requirePermission check (rbac.middleware.ts) so the frontend's "should I show/allow this" logic never drifts from what the server will actually enforce. */
export function hasPermission(user: AuthUser | null, permission: string): boolean {
  if (!user?.permissions) return false;
  return user.permissions.includes("*") || user.permissions.includes(permission);
}

function studentToAuthUser(s: StudentLoginResponse["student"]): AuthUser {
  return {
    id: s.id,
    identifier: s.phone,
    studentId: s.id,
    name: s.name,
    role: "Student",
    mustChangePassword: false,
  };
}

function staffToAuthUser(s: StaffLoginResponse["staff"]): AuthUser {
  return {
    id: s.id,
    identifier: s.phone,
    staffId: s.id,
    name: s.name,
    role: toDisplayRole(s.role),
    mustChangePassword: false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(STUDENT_SESSION_KEY);
    localStorage.removeItem(STAFF_SESSION_KEY);
    api.post("/auth/logout").catch(() => {
      /* best-effort — the cookie may already be gone (or never existed, for a student/staff session) */
    });
  }, []);

  // Silent-restore on first load: the access token lives only in memory, so
  // a hard reload has none. Admin restores via the httpOnly refresh cookie;
  // a Student or Staff-Portal session has no server-side record to restore
  // from at all (studentLogin/staffLogin write nothing), so those are
  // restored from localStorage instead — if the stored access token has
  // since expired, the first authenticated request 401s and
  // onSessionExpired below logs it out.
  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      localStorage.removeItem(STUDENT_SESSION_KEY);
      localStorage.removeItem(STAFF_SESSION_KEY);
    });

    let cancelled = false;
    (async () => {
      const storedLocal = localStorage.getItem(STUDENT_SESSION_KEY) || localStorage.getItem(STAFF_SESSION_KEY);
      if (storedLocal) {
        try {
          const { accessToken, user: storedUser } = JSON.parse(storedLocal) as { accessToken: string; user: AuthUser };
          setHasRefreshCapability(false); // no cookie exists for this session — a 401 must fail fast, not wait on a doomed /auth/refresh
          setAccessToken(accessToken);
          setUser(storedUser);
        } catch {
          localStorage.removeItem(STUDENT_SESSION_KEY);
          localStorage.removeItem(STAFF_SESSION_KEY);
        }
        setInitializing(false);
        return;
      }

      try {
        const res = await api.post<LoginResponse>("/auth/refresh");
        if (cancelled) return;
        setHasRefreshCapability(true);
        setAccessToken(res.accessToken);
        setUser(toAuthUser(res.user));
      } catch {
        // No valid session — that's the normal logged-out state, not an error to surface.
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api.post<LoginResponse>("/auth/login", { identifier, password });
    setHasRefreshCapability(true);
    setAccessToken(res.accessToken);
    setUser(toAuthUser(res.user));
  }, []);

  /**
   * Student Portal login: a phone number + Roll Number match against the
   * student's own record *is* the credential — no password, no login
   * account (auth.service.ts's studentLogin is a pure read-only lookup).
   */
  const studentLogin = useCallback(async (phone: string, rollNumber: string) => {
    const res = await api.post<StudentLoginResponse>("/auth/student-login", { phone, rollNumber });
    setHasRefreshCapability(false);
    setAccessToken(res.accessToken);
    const authUser = studentToAuthUser(res.student);
    setUser(authUser);
    localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify({ accessToken: res.accessToken, user: authUser }));
  }, []);

  /**
   * Staff Portal login: a phone number + Staff ID match against the staff
   * member's own record *is* the credential — no password, no login
   * account (auth.service.ts's staffLogin is a pure read-only lookup).
   * Admin keeps using login() above, unaffected.
   */
  const staffLogin = useCallback(async (phone: string, staffId: string) => {
    const res = await api.post<StaffLoginResponse>("/auth/staff-login", { phone, staffId });
    setHasRefreshCapability(false);
    setAccessToken(res.accessToken);
    const authUser = staffToAuthUser(res.staff);
    setUser(authUser);
    localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify({ accessToken: res.accessToken, user: authUser }));
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post("/auth/change-password", { currentPassword, newPassword });
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, studentLogin, staffLogin, logout, changePassword }),
    [user, initializing, login, studentLogin, staffLogin, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}

export { ApiClientError, getAccessToken };
