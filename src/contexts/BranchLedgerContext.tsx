import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { BranchLedgerEntry } from "@/types/branchLedger";

interface BranchLedgerContextType {
  entries: BranchLedgerEntry[];
  addEntry: (data: Omit<BranchLedgerEntry, "id">) => BranchLedgerEntry;
  updateEntry: (id: string, data: Partial<BranchLedgerEntry>) => void;
  deleteEntry: (id: string) => void;
}

const BranchLedgerContext = createContext<BranchLedgerContextType | null>(null);

export function BranchLedgerProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<BranchLedgerEntry[]>([]);

  const addEntry = useCallback((data: Omit<BranchLedgerEntry, "id">): BranchLedgerEntry => {
    const entry: BranchLedgerEntry = { ...data, id: `bl${Date.now()}${Math.random().toString(36).slice(2, 6)}` };
    setEntries((prev) => [entry, ...prev]);
    return entry;
  }, []);

  const updateEntry = useCallback((id: string, data: Partial<BranchLedgerEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const value = useMemo(() => ({ entries, addEntry, updateEntry, deleteEntry }), [entries, addEntry, updateEntry, deleteEntry]);

  return <BranchLedgerContext.Provider value={value}>{children}</BranchLedgerContext.Provider>;
}

export function useBranchLedger() {
  const ctx = useContext(BranchLedgerContext);
  if (!ctx) throw new Error("useBranchLedger must be within BranchLedgerProvider");
  return ctx;
}
