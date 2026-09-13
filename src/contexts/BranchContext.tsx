import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Branch } from "@/types/branch";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Branch is now backed by the real API (Phase 3, Module 23) — the single
 * collection that unifies what used to be two separate, drifted mock lists:
 * Book Management's DEMO_BRANCHES (name/address/director/phone) and
 * Accounts' ACCOUNT_BRANCHES (id/name only).
 */
interface ApiBranch {
  _id: string;
  name: string;
  address?: string;
  director?: string;
  phone?: string;
}

function fromApi(doc: ApiBranch): Branch {
  return { id: doc._id, name: doc.name, address: doc.address, director: doc.director, phone: doc.phone };
}

interface BranchContextType {
  branches: Branch[];
  loading: boolean;
  addBranch: (data: Omit<Branch, "id">) => Promise<Branch>;
  updateBranch: (id: string, data: Partial<Branch>) => Promise<Branch>;
  deleteBranch: (id: string) => Promise<void>;
  getBranch: (id: string) => Branch | undefined;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | null>(null);

const LIST_LIMIT = "?limit=100";

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { initializing, user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshBranches = useCallback(async () => {
    const docs = await api.get<ApiBranch[]>(`/branches${LIST_LIMIT}`);
    setBranches(docs.map(fromApi));
  }, []);

  // Waits for AuthContext to settle first — see AcademicContext.tsx's
  // comment for why an un-gated fetch here races the session restore and
  // can even log a just-restored Student/Staff Portal session back out.
  useEffect(() => {
    if (initializing) return;
    if (!user) { setLoading(false); return; }
    refreshBranches().catch(() => { /* offline */ }).finally(() => setLoading(false));
  }, [initializing, user, refreshBranches]);

  const addBranch = useCallback(async (data: Omit<Branch, "id">): Promise<Branch> => {
    const created = fromApi(await api.post<ApiBranch>("/branches", data));
    setBranches((prev) => [...prev, created]);
    return created;
  }, []);

  const updateBranch = useCallback(async (id: string, data: Partial<Branch>): Promise<Branch> => {
    const updated = fromApi(await api.patch<ApiBranch>(`/branches/${id}`, data));
    setBranches((prev) => prev.map((b) => (b.id === id ? updated : b)));
    return updated;
  }, []);

  const deleteBranch = useCallback(async (id: string) => {
    await api.del(`/branches/${id}`);
    setBranches((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const getBranch = useCallback((id: string) => branches.find((b) => b.id === id), [branches]);

  const value = useMemo(
    () => ({ branches, loading, addBranch, updateBranch, deleteBranch, getBranch, refreshBranches }),
    [branches, loading, addBranch, updateBranch, deleteBranch, getBranch, refreshBranches],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranches() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranches must be within BranchProvider");
  return ctx;
}
