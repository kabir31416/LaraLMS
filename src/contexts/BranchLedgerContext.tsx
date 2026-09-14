import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BranchLedgerEntry } from "@/types/branchLedger";
import { useBranches } from "@/contexts/BranchContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";

/** Branch Ledger entries are now backed by the real API (Phase 3, Module 24). */
interface ApiBranchLedgerEntry {
  _id: string;
  date: string;
  branchId: string;
  type: BranchLedgerEntry["type"];
  itemType?: BranchLedgerEntry["itemType"];
  description?: string;
  quantity?: number;
  method?: BranchLedgerEntry["method"];
  amount: number;
  note?: string;
}

interface BranchLedgerContextType {
  entries: BranchLedgerEntry[];
  loading: boolean;
  addEntry: (data: Omit<BranchLedgerEntry, "id" | "branchName">) => Promise<BranchLedgerEntry>;
  updateEntry: (id: string, data: Partial<BranchLedgerEntry>) => Promise<BranchLedgerEntry>;
  deleteEntry: (id: string) => Promise<void>;
}

const BranchLedgerContext = createContext<BranchLedgerContextType | null>(null);

const LIST_LIMIT = "?limit=100";

export function BranchLedgerProvider({ children }: { children: React.ReactNode }) {
  const { initializing, user } = useAuth();
  const { branches } = useBranches();
  const [entries, setEntries] = useState<BranchLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const branchNameById = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  const fromApi = useCallback((doc: ApiBranchLedgerEntry): BranchLedgerEntry => ({
    id: doc._id, date: doc.date, branchId: doc.branchId, branchName: branchNameById.get(doc.branchId) || "",
    type: doc.type, itemType: doc.itemType, description: doc.description, quantity: doc.quantity,
    method: doc.method, amount: doc.amount, note: doc.note,
  }), [branchNameById]);

  const refresh = useCallback(async () => {
    const docs = await api.get<ApiBranchLedgerEntry[]>(`/branch-ledger${LIST_LIMIT}`);
    setEntries(docs.map(fromApi));
  }, [fromApi]);

  // Waits for AuthContext to settle first — see AcademicContext.tsx's
  // comment for why an un-gated fetch here races the session restore and
  // can even log a just-restored Student/Staff Portal session back out.
  useEffect(() => {
    if (initializing) return;
    if (!user) { setLoading(false); return; }
    refresh().catch(() => {}).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing, user, branches.length]);

  const addEntry = useCallback(async (data: Omit<BranchLedgerEntry, "id" | "branchName">): Promise<BranchLedgerEntry> => {
    const created = fromApi(await api.post<ApiBranchLedgerEntry>("/branch-ledger", data));
    setEntries((prev) => [created, ...prev]);
    return created;
  }, [fromApi]);

  const updateEntry = useCallback(async (id: string, data: Partial<BranchLedgerEntry>): Promise<BranchLedgerEntry> => {
    const updated = fromApi(await api.patch<ApiBranchLedgerEntry>(`/branch-ledger/${id}`, data));
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, [fromApi]);

  const deleteEntry = useCallback(async (id: string) => {
    await api.del(`/branch-ledger/${id}`);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const value = useMemo(() => ({ entries, loading, addEntry, updateEntry, deleteEntry }), [entries, loading, addEntry, updateEntry, deleteEntry]);

  return <BranchLedgerContext.Provider value={value}>{children}</BranchLedgerContext.Provider>;
}

export function useBranchLedger() {
  const ctx = useContext(BranchLedgerContext);
  if (!ctx) throw new Error("useBranchLedger must be within BranchLedgerProvider");
  return ctx;
}
