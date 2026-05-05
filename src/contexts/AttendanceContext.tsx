import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AttendanceEntry, AttendanceStatus, OfflineExam, OfflineResult } from "@/types/attendance";
import { format, subDays } from "date-fns";

const KEY = "lara-attendance-v1";

interface State {
  entries: AttendanceEntry[];
  exams: OfflineExam[];
  results: OfflineResult[];
}

function seed(): State {
  // Seed last 14 days of attendance for demo batches/students
  const entries: AttendanceEntry[] = [];
  const studentIds = ["1", "2", "3", "4", "5", "6"];
  const batchMap: Record<string, string> = {
    "1": "b1", "2": "b1", "6": "b1",
    "3": "b2",
    "4": "b3",
    "5": "b4",
  };
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = format(subDays(today, i), "yyyy-MM-dd");
    const day = subDays(today, i).getDay();
    if (day === 5) continue; // Friday off
    studentIds.forEach((sid, idx) => {
      // ~85% present
      const seedRand = (i * 7 + idx * 3) % 10;
      const status: AttendanceStatus = seedRand < 8 ? "Present" : "Absent";
      entries.push({
        id: `att_${sid}_${d}`,
        studentId: sid,
        batchId: batchMap[sid] || "b1",
        date: d,
        status,
        source: "Manual",
      });
    });
  }
  return { entries, exams: [], results: [] };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch { /* ignore */ }
  return seed();
}

interface Ctx extends State {
  saveAttendance: (batchId: string, date: string, items: { studentId: string; status: AttendanceStatus }[], source?: "Manual" | "Exam", examId?: string) => void;
  getByBatchDate: (batchId: string, date: string) => AttendanceEntry[];
  getByStudent: (studentId: string) => AttendanceEntry[];
  addExam: (exam: Omit<OfflineExam, "id" | "createdAt">) => OfflineExam;
  saveResults: (examId: string, items: { studentId: string; marks: number | null }[]) => void;
  getResultsByExam: (examId: string) => OfflineResult[];
  attendancePercent: (studentId: string, from?: string, to?: string) => number;
}

const AttendanceContext = createContext<Ctx | null>(null);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => load());

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const saveAttendance = useCallback((batchId: string, date: string, items: { studentId: string; status: AttendanceStatus }[], source: "Manual" | "Exam" = "Manual", examId?: string) => {
    setState((p) => {
      // Remove existing entries for this batch + date (same source key) then re-insert
      const filtered = p.entries.filter((e) => !(e.batchId === batchId && e.date === date && e.source === source));
      const fresh: AttendanceEntry[] = items.map((it) => ({
        id: `att_${it.studentId}_${date}_${source}`,
        studentId: it.studentId,
        batchId,
        date,
        status: it.status,
        source,
        examId,
      }));
      return { ...p, entries: [...filtered, ...fresh] };
    });
  }, []);

  const getByBatchDate = useCallback((batchId: string, date: string) =>
    state.entries.filter((e) => e.batchId === batchId && e.date === date), [state.entries]);

  const getByStudent = useCallback((sid: string) =>
    state.entries.filter((e) => e.studentId === sid), [state.entries]);

  const addExam = useCallback((exam: Omit<OfflineExam, "id" | "createdAt">) => {
    const e: OfflineExam = { ...exam, id: `oe_${Date.now()}`, createdAt: new Date().toISOString() };
    setState((p) => ({ ...p, exams: [e, ...p.exams] }));
    return e;
  }, []);

  const saveResults = useCallback((examId: string, items: { studentId: string; marks: number | null }[]) => {
    setState((p) => {
      const others = p.results.filter((r) => r.examId !== examId);
      const fresh: OfflineResult[] = items.map((it) => ({
        id: `res_${examId}_${it.studentId}`,
        examId,
        studentId: it.studentId,
        marks: it.marks,
      }));
      return { ...p, results: [...others, ...fresh] };
    });
  }, []);

  const getResultsByExam = useCallback((examId: string) =>
    state.results.filter((r) => r.examId === examId), [state.results]);

  const attendancePercent = useCallback((studentId: string, from?: string, to?: string) => {
    let list = state.entries.filter((e) => e.studentId === studentId);
    if (from) list = list.filter((e) => e.date >= from);
    if (to) list = list.filter((e) => e.date <= to);
    if (list.length === 0) return 0;
    const present = list.filter((e) => e.status === "Present").length;
    return Math.round((present / list.length) * 100);
  }, [state.entries]);

  const value = useMemo<Ctx>(() => ({
    ...state,
    saveAttendance, getByBatchDate, getByStudent,
    addExam, saveResults, getResultsByExam, attendancePercent,
  }), [state, saveAttendance, getByBatchDate, getByStudent, addExam, saveResults, getResultsByExam, attendancePercent]);

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error("useAttendance must be within AttendanceProvider");
  return ctx;
}