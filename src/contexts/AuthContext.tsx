import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiClientError, getAccessToken, onSessionExpired, setAccessToken } from "@/lib/apiClient";

export type Role = "Admin" | "Batch Director" | "Student";

export interface AuthUser {
  id: string;
  identifier: string;
  staffId?: string;
  studentId?: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
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

interface AuthContextType {
  user: AuthUser | null;
  /** True while the app is trying to restore a session from the refresh cookie (or, for a student, localStorage) on first load. */
  initializing: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  studentLogin: (phone: string, rollNumber: string) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Student sessions have no server-side refresh record (auth.service.ts's studentLogin writes nothing) — persisted here instead so a reload doesn't log them out. */
const STUDENT_SESSION_KEY = "laralms_student_session";

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
  };
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(STUDENT_SESSION_KEY);
    api.post("/auth/logout").catch(() => {
      /* best-effort — the cookie may already be gone (or never existed, for a student session) */
    });
  }, []);

  // Silent-restore on first load: the access token lives only in memory, so
  // a hard reload has none. Admin/Staff restore via the httpOnly refresh
  // cookie; a Student session has no server-side record to restore from at
  // all (studentLogin writes nothing), so it's restored from localStorage
  // instead — if the stored access token has since expired, the first
  // authenticated request 401s and onSessionExpired below logs it out.
  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      localStorage.removeItem(STUDENT_SESSION_KEY);
    });

    let cancelled = false;
    (async () => {
      const storedStudent = localStorage.getItem(STUDENT_SESSION_KEY);
      if (storedStudent) {
        try {
          const { accessToken, user: storedUser } = JSON.parse(storedStudent) as { accessToken: string; user: AuthUser };
          setAccessToken(accessToken);
          setUser(storedUser);
        } catch {
          localStorage.removeItem(STUDENT_SESSION_KEY);
        }
        setInitializing(false);
        return;
      }

      try {
        const res = await api.post<LoginResponse>("/auth/refresh");
        if (cancelled) return;
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
    setAccessToken(res.accessToken);
    const authUser = studentToAuthUser(res.student);
    setUser(authUser);
    localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify({ accessToken: res.accessToken, user: authUser }));
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post("/auth/change-password", { currentPassword, newPassword });
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, studentLogin, logout, changePassword }),
    [user, initializing, login, studentLogin, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}

export { ApiClientError, getAccessToken };
