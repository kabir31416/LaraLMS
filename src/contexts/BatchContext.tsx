import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Batch } from "@/types/batch";
import { mockStudents } from "@/data/students";

// Auto-build initial batches from existing students' static `batch` strings
function buildInitialBatches(): Batch[] {
  const map = new Map<string, string[]>();
  for (const s of mockStudents) {
    if (!s.batch) continue;
    if (!map.has(s.batch)) map.set(s.batch, []);
    map.get(s.batch)!.push(s.id);
  }
  const directorIds = ["s4", "s5"]; // demo directors from StaffContext
  return Array.from(map.entries()).map(([name, studentIds], idx) => ({
    id: `b${idx + 1}`,
    name,
    course: "বিজ্ঞান",
    batchTime: idx % 2 === 0 ? "৫:০০ PM - ৭:০০ PM" : "৩:০০ PM - ৫:০০ PM",
    days: ["শনিবার", "সোমবার", "বুধবার"],
    roomNumber: `${101 + idx}`,
    startDate: "2026-01-01",
    directorId: directorIds[idx % directorIds.length],
    studentIds,
  }));
}

interface BatchContextType {
  batches: Batch[];
  addBatch: (data: Omit<Batch, "id" | "studentIds"> & { studentIds?: string[] }) => Batch;
  updateBatch: (id: string, data: Partial<Batch>) => void;
  deleteBatch: (id: string) => void;
  getBatch: (id: string) => Batch | undefined;
  assignStudents: (batchId: string, studentIds: string[]) => void;
  removeStudent: (batchId: string, studentId: string) => void;
  getBatchByStudent: (studentId: string) => Batch | undefined;
  getBatchesByDirector: (directorId: string) => Batch[];
}

const BatchContext = createContext<BatchContextType | null>(null);

export function BatchProvider({ children }: { children: React.ReactNode }) {
  const [batches, setBatches] = useState<Batch[]>(() => buildInitialBatches());

  const addBatch = useCallback((data: Omit<Batch, "id" | "studentIds"> & { studentIds?: string[] }): Batch => {
    const b: Batch = { ...data, id: `b${Date.now()}`, studentIds: data.studentIds ?? [] };
    setBatches((prev) => [b, ...prev]);
    return b;
  }, []);

  const updateBatch = useCallback((id: string, data: Partial<Batch>) => {
    setBatches((prev) => prev.map((b) => (b.id === id ? { ...b, ...data } : b)));
  }, []);

  const deleteBatch = useCallback((id: string) => {
    setBatches((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const getBatch = useCallback((id: string) => batches.find((b) => b.id === id), [batches]);

  const assignStudents = useCallback((batchId: string, studentIds: string[]) => {
    setBatches((prev) =>
      prev.map((b) => {
        // Remove these students from any other batch (one batch per student)
        if (b.id !== batchId) {
          return { ...b, studentIds: b.studentIds.filter((id) => !studentIds.includes(id)) };
        }
        const merged = Array.from(new Set([...b.studentIds, ...studentIds]));
        return { ...b, studentIds: merged };
      }),
    );
  }, []);

  const removeStudent = useCallback((batchId: string, studentId: string) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, studentIds: b.studentIds.filter((id) => id !== studentId) } : b)),
    );
  }, []);

  const getBatchByStudent = useCallback(
    (studentId: string) => batches.find((b) => b.studentIds.includes(studentId)),
    [batches],
  );

  const getBatchesByDirector = useCallback(
    (directorId: string) => batches.filter((b) => b.directorId === directorId),
    [batches],
  );

  const value = useMemo(
    () => ({
      batches,
      addBatch,
      updateBatch,
      deleteBatch,
      getBatch,
      assignStudents,
      removeStudent,
      getBatchByStudent,
      getBatchesByDirector,
    }),
    [batches, addBatch, updateBatch, deleteBatch, getBatch, assignStudents, removeStudent, getBatchByStudent, getBatchesByDirector],
  );

  return <BatchContext.Provider value={value}>{children}</BatchContext.Provider>;
}

export function useBatches() {
  const ctx = useContext(BatchContext);
  if (!ctx) throw new Error("useBatches must be within BatchProvider");
  return ctx;
}
