import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Role = "Admin" | "Batch Director" | "Student";

export interface AuthUser {
  staffId: string;
  name: string;
  role: Role;
  studentId?: string; // internal student.id when role === "Student"
}

interface AuthContextType {
  user: AuthUser | null;
  loginAsAdmin: (name?: string) => void;
  loginAsDirector: (staffId: string, name: string) => void;
  loginAsStudent: (studentInternalId: string, name: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const STORAGE_KEY = "lara-auth-user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : { staffId: "s1", name: "অ্যাডমিন", role: "Admin" };
    } catch {
      return { staffId: "s1", name: "অ্যাডমিন", role: "Admin" };
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const loginAsAdmin = useCallback((name = "অ্যাডমিন") => {
    setUser({ staffId: "s1", name, role: "Admin" });
  }, []);

  const loginAsDirector = useCallback((staffId: string, name: string) => {
    setUser({ staffId, name, role: "Batch Director" });
  }, []);

  const loginAsStudent = useCallback((studentInternalId: string, name: string) => {
    setUser({ staffId: `stu-${studentInternalId}`, name, role: "Student", studentId: studentInternalId });
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const value = useMemo(() => ({ user, loginAsAdmin, loginAsDirector, loginAsStudent, logout }), [user, loginAsAdmin, loginAsDirector, loginAsStudent, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}
