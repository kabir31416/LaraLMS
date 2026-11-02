import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasPermission, useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import type { Mess, MessSettings } from "@/lib/mess";
import {
  MESS_BILLING_MANAGE,
  MESS_COMPLAINTS_MANAGE,
  MESS_EXPENSES_APPROVE,
  MESS_EXPENSES_MANAGE,
  MESS_NOTICES_MANAGE,
  MESS_PAYMENTS_COLLECT,
  MESS_REPORTS_READ,
  MESS_SETTINGS_MANAGE,
  MESS_VIEW,
} from "@/lib/permissions";

/**
 * Shared frame for every Mess page: the normal DashboardLayout, a section
 * tab bar (filtered by the user's own permissions — the backend still
 * enforces every call), and one Mess selector whose choice is remembered
 * per browser so moving between sections keeps the same Mess in view.
 */
interface MessScope {
  messes: Mess[];
  messesLoading: boolean;
  /** "all" = every Mess this user can access. */
  messId: string;
  setMessId: (id: string) => void;
  reloadMesses: () => Promise<void>;
  settings: MessSettings | null;
  reloadSettings: () => Promise<void>;
  can: (permission: string) => boolean;
}

const MessScopeContext = createContext<MessScope | null>(null);
const STORAGE_KEY = "laralms_mess_selected";

export const MESS_SECTIONS: { url: string; label: string; permission: string | string[] }[] = [
  { url: "/mess", label: "ড্যাশবোর্ড", permission: MESS_VIEW },
  { url: "/mess/setup", label: "মেস ও রুম/সিট", permission: MESS_VIEW },
  { url: "/mess/members", label: "সদস্য ও ভর্তি", permission: MESS_VIEW },
  { url: "/mess/billing", label: "বিলিং", permission: [MESS_BILLING_MANAGE, MESS_VIEW] },
  { url: "/mess/payments", label: "পেমেন্ট", permission: [MESS_PAYMENTS_COLLECT, MESS_VIEW] },
  { url: "/mess/deposits", label: "জামানত ও নিষ্পত্তি", permission: MESS_VIEW },
  { url: "/mess/expenses", label: "খরচ", permission: [MESS_EXPENSES_MANAGE, MESS_EXPENSES_APPROVE] },
  { url: "/mess/complaints", label: "অভিযোগ ও রক্ষণাবেক্ষণ", permission: [MESS_COMPLAINTS_MANAGE] },
  { url: "/mess/notices", label: "নোটিশ", permission: [MESS_NOTICES_MANAGE] },
  { url: "/mess/reports", label: "রিপোর্ট", permission: MESS_REPORTS_READ },
  { url: "/mess/settings", label: "মেস সেটিংস", permission: MESS_SETTINGS_MANAGE },
];

export function sectionVisible(user: Parameters<typeof hasPermission>[0], permission: string | string[]): boolean {
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((p) => hasPermission(user, p));
}

export function MessScopeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [messes, setMesses] = useState<Mess[]>([]);
  const [messesLoading, setMessesLoading] = useState(true);
  const [settings, setSettings] = useState<MessSettings | null>(null);
  const [messId, setMessIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "all";
    } catch {
      return "all";
    }
  });
  const can = useCallback((p: string) => hasPermission(user, p), [user]);

  const reloadMesses = useCallback(async () => {
    setMessesLoading(true);
    try {
      setMesses(await api.get<Mess[]>("/mess/messes"));
    } catch {
      setMesses([]);
    } finally {
      setMessesLoading(false);
    }
  }, []);
  const reloadSettings = useCallback(async () => {
    try {
      setSettings(await api.get<MessSettings>("/mess/settings"));
    } catch {
      setSettings(null);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void reloadMesses();
    void reloadSettings();
  }, [user, reloadMesses, reloadSettings]);

  // A remembered Mess the user can no longer access falls back to "all".
  useEffect(() => {
    if (!messesLoading && messId !== "all" && !messes.some((m) => m._id === messId)) setMessIdState("all");
  }, [messes, messesLoading, messId]);

  const setMessId = useCallback((id: string) => {
    setMessIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* private mode — selection just isn't remembered */
    }
  }, []);

  const value = useMemo(
    () => ({ messes, messesLoading, messId, setMessId, reloadMesses, settings, reloadSettings, can }),
    [messes, messesLoading, messId, setMessId, reloadMesses, settings, reloadSettings, can],
  );
  return <MessScopeContext.Provider value={value}>{children}</MessScopeContext.Provider>;
}

export function useMessScope(): MessScope {
  const ctx = useContext(MessScopeContext);
  if (!ctx) throw new Error("useMessScope must be used inside MessScopeProvider");
  return ctx;
}

/** Mess picker used inside forms (a concrete Mess is required there, never "all"). */
export function MessSelect({ value, onChange, includeAll, activeOnly, className }: { value: string; onChange: (v: string) => void; includeAll?: boolean; activeOnly?: boolean; className?: string }) {
  const { messes } = useMessScope();
  const list = activeOnly ? messes.filter((m) => m.status === "active") : messes;
  return (
    <Select value={value || (includeAll ? "all" : "")} onValueChange={onChange}>
      <SelectTrigger className={className}><SelectValue placeholder="মেস নির্বাচন করুন" /></SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">সব মেস</SelectItem>}
        {list.length === 0 ? <SelectItem value="__none" disabled>কোনো মেস নেই</SelectItem> : list.map((m) => (
          <SelectItem key={m._id} value={m._id}>{m.name} ({m.code}){m.status === "inactive" ? " — নিষ্ক্রিয়" : ""}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MessPage({ title, subtitle, actions, children, hideMessFilter }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; hideMessFilter?: boolean }) {
  const { user } = useAuth();
  const location = useLocation();
  const { messId, setMessId, messes } = useMessScope();
  const sections = MESS_SECTIONS.filter((s) => sectionVisible(user, s.permission));
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="overflow-x-auto -mx-1 px-1">
          <nav className="flex gap-1 border-b min-w-max">
            {sections.map((s) => {
              const active = s.url === "/mess" ? location.pathname === "/mess" : location.pathname.startsWith(s.url);
              return (
                <NavLink
                  key={s.url}
                  to={s.url}
                  className={cn(
                    "px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
                    active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!hideMessFilter && messes.length > 0 && <MessSelect value={messId} onChange={setMessId} includeAll className="w-56" />}
            {actions}
          </div>
        </div>
        {children}
      </div>
    </DashboardLayout>
  );
}

