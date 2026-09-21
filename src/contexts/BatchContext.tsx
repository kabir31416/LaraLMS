import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Batch } from "@/types/batch";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Batches are now backed by the real API (Phase 3, Module 12). There is no
 * `studentIds` here anymore — a batch's roster is simply "students whose
 * `batchId` equals this batch's id" (see StudentContext), kept in sync
 * server-side by the enroll/transfer/withdraw endpoints (Phase 1 §14).
 */
function withId<T extends { _id: string }>(doc: T): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

interface BatchContextType {
  batches: Batch[];
  loading: boolean;
  addBatch: (data: Omit<Batch, "id"> & { directorId?: string | null }) => Promise<Batch>;
  /** `directorId: null` is the explicit "unassign the Batch Director" signal the backend's update route accepts (Batch Director unassignment audit §10) — distinct from omitting the key, which leaves it untouched. A fetched/stored Batch never has `directorId: null` itself (an unassigned batch simply has no `directorId` key), so this widening is scoped to the write-time payload only. */
  updateBatch: (id: string, data: Partial<Batch> & { directorId?: string | null }) => Promise<Batch>;
  deleteBatch: (id: string) => Promise<void>;
  getBatch: (id: string) => Batch | undefined;
  getBatchesByDirector: (directorId: string) => Batch[];
  refreshBatches: () => Promise<void>;
  enrollBulk: (batchId: string, studentIds: string[]) => Promise<{ succeeded: string[]; failed: { studentId: string; reason: string }[] }>;
}

const BatchContext = createContext<BatchContextType | null>(null);

const LIST_LIMIT = "?limit=100";

export function BatchProvider({ children }: { children: React.ReactNode }) {
  const { initializing, user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshBatches = useCallback(async () => {
    const docs = await api.get<{ _id: string }[]>(`/batches${LIST_LIMIT}`);
    setBatches(docs.map(withId) as Batch[]);
  }, []);

  // Waits for AuthContext to settle first — see AcademicContext.tsx's
  // comment for why an un-gated fetch here races the session restore and
  // can even log a just-restored Student/Staff Portal session back out.
  useEffect(() => {
    if (initializing) return;
    if (!user) { setLoading(false); return; }
    refreshBatches().catch(() => { /* offline */ }).finally(() => setLoading(false));
  }, [initializing, user, refreshBatches]);

  const addBatch = useCallback(async (data: Omit<Batch, "id"> & { directorId?: string | null }): Promise<Batch> => {
    const created = withId(await api.post<{ _id: string }>("/batches", data)) as Batch;
    setBatches((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateBatch = useCallback(async (id: string, data: Partial<Batch> & { directorId?: string | null }): Promise<Batch> => {
    const updated = withId(await api.patch<{ _id: string }>(`/batches/${id}`, data)) as Batch;
    setBatches((prev) => prev.map((b) => (b.id === id ? updated : b)));
    return updated;
  }, []);

  const deleteBatch = useCallback(async (id: string) => {
    await api.del(`/batches/${id}`);
    setBatches((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const getBatch = useCallback((id: string) => batches.find((b) => b.id === id), [batches]);

  const getBatchesByDirector = useCallback(
    (directorId: string) => batches.filter((b) => b.directorId === directorId),
    [batches],
  );

  /** Bulk-enroll (Phase 1 §14) — backs AssignStudentsDialog; the Student list's batchId is refreshed by the caller afterwards. */
  const enrollBulk = useCallback(async (batchId: string, studentIds: string[]) => {
    return api.post<{ succeeded: string[]; failed: { studentId: string; reason: string }[] }>(`/batches/${batchId}/enroll-bulk`, { studentIds });
  }, []);

  const value = useMemo(
    () => ({ batches, loading, addBatch, updateBatch, deleteBatch, getBatch, getBatchesByDirector, refreshBatches, enrollBulk }),
    [batches, loading, addBatch, updateBatch, deleteBatch, getBatch, getBatchesByDirector, refreshBatches, enrollBulk],
  );

  return <BatchContext.Provider value={value}>{children}</BatchContext.Provider>;
}

export function useBatches() {
  const ctx = useContext(BatchContext);
  if (!ctx) throw new Error("useBatches must be within BatchProvider");
  return ctx;
}
