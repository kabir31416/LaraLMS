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

interface AuthContextType {
  user: AuthUser | null;
  /** True while the app is trying to restore a session from the refresh cookie on first load. */
  initializing: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  studentLogin: (phone: string, rollNumber: string) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    api.post("/auth/logout").catch(() => {
      /* best-effort — the cookie may already be gone */
    });
  }, []);

  // Silent-refresh on first load: the access token lives only in memory, so a
  // hard reload has none — but the httpOnly refresh cookie may still be valid.
  useEffect(() => {
    onSessionExpired(() => setUser(null));

    let cancelled = false;
    (async () => {
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
   * Student Portal login: no separate password to remember or keep in
   * sync — a phone number + Roll Number match against the live Student
   * record *is* the credential (auth.service.ts's studentLogin).
   */
  const studentLogin = useCallback(async (phone: string, rollNumber: string) => {
    const res = await api.post<LoginResponse>("/auth/student-login", { phone, rollNumber });
    setAccessToken(res.accessToken);
    setUser(toAuthUser(res.user));
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
