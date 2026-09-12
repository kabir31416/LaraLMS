import React, { createContext, useCallback, useContext } from "react";
import type { AttendanceEntry, AttendanceStatus, OfflineExam, OfflineResult } from "@/types/attendance";
import { api } from "@/lib/apiClient";

/**
 * Attendance/Offline-Exam/Offline-Result are now backed by the real API
 * (Phase 3, Modules 18-20). Unlike Student/Batch/Staff/Payment, this context
 * deliberately does NOT keep one global cached array in memory — attendance
 * rows accumulate daily per student and would blow past the server's
 * MAX_PAGE_SIZE (100) almost immediately for any real coaching center, so
 * every function here fetches exactly what its caller needs (one batch+day,
 * one student's history, a percentage aggregate) instead of "load everything,
 * filter client-side."
 */
interface ApiAttendanceEntry {
  _id: string;
  studentId: string;
  batchId: string;
  date: string;
  status: AttendanceStatus;
  source: "Manual" | "Exam";
  examId?: string;
}

function entryFromApi(doc: ApiAttendanceEntry): AttendanceEntry {
  return { id: doc._id, studentId: doc.studentId, batchId: doc.batchId, date: doc.date, status: doc.status, source: doc.source, examId: doc.examId };
}

interface ApiOfflineExam {
  _id: string;
  batchId: string;
  subjectId: string;
  lectureId: string;
  title: string;
  fullMarks: number;
  date: string;
  createdAt: string;
}

function examFromApi(doc: ApiOfflineExam): OfflineExam {
  return { id: doc._id, batchId: doc.batchId, subjectId: doc.subjectId, lectureId: doc.lectureId, title: doc.title, fullMarks: doc.fullMarks, date: doc.date, createdAt: doc.createdAt };
}

interface ApiOfflineResult {
  _id: string;
  examId: string;
  studentId: string;
  marks: number | null;
}

function resultFromApi(doc: ApiOfflineResult): OfflineResult {
  return { id: doc._id, examId: doc.examId, studentId: doc.studentId, marks: doc.marks };
}

interface Ctx {
  saveAttendance: (batchId: string, date: string, items: { studentId: string; status: AttendanceStatus }[], source?: "Manual" | "Exam", examId?: string) => Promise<void>;
  getByBatchDate: (batchId: string, date: string) => Promise<AttendanceEntry[]>;
  getByStudent: (studentId: string) => Promise<AttendanceEntry[]>;
  addExam: (exam: Omit<OfflineExam, "id" | "createdAt">) => Promise<OfflineExam>;
  listExams: (params?: { batchId?: string }) => Promise<OfflineExam[]>;
  saveResults: (examId: string, items: { studentId: string; marks: number | null }[]) => Promise<void>;
  getResultsByExam: (examId: string) => Promise<OfflineResult[]>;
  getResultsByExams: (examIds: string[]) => Promise<OfflineResult[]>;
  getResultsByStudent: (studentId: string) => Promise<OfflineResult[]>;
  attendancePercent: (studentId: string, from?: string, to?: string) => Promise<number>;
  attendancePercentages: (params: { studentIds?: string[]; batchId?: string; batchIds?: string[] }, from?: string, to?: string) => Promise<Record<string, number>>;
  getByStudentStats: (params: { batchId?: string; from?: string; to?: string }) => Promise<{ studentId: string; present: number; absent: number; pct: number }[]>;
  getStats: (params: { batchId?: string; batchIds?: string[]; from?: string; to?: string }) => Promise<{
    present: number;
    absent: number;
    pct: number;
    daily: { date: string; batchId: string; present: number; absent: number }[];
  }>;
}

const AttendanceContext = createContext<Ctx | null>(null);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const saveAttendance = useCallback(async (
    batchId: string,
    date: string,
    items: { studentId: string; status: AttendanceStatus }[],
    source: "Manual" | "Exam" = "Manual",
    examId?: string,
  ) => {
    await api.post("/attendance", { batchId, date, items, source, examId });
  }, []);

  const getByBatchDate = useCallback(async (batchId: string, date: string): Promise<AttendanceEntry[]> => {
    const docs = await api.get<ApiAttendanceEntry[]>(`/attendance?batchId=${batchId}&date=${date}&limit=100`);
    return docs.map(entryFromApi);
  }, []);

  const getByStudent = useCallback(async (studentId: string): Promise<AttendanceEntry[]> => {
    const docs = await api.get<ApiAttendanceEntry[]>(`/attendance?studentId=${studentId}&limit=100&sortBy=date&sortOrder=desc`);
    return docs.map(entryFromApi);
  }, []);

  const addExam = useCallback(async (exam: Omit<OfflineExam, "id" | "createdAt">): Promise<OfflineExam> => {
    return examFromApi(await api.post<ApiOfflineExam>("/exams", exam));
  }, []);

  const listExams = useCallback(async (params?: { batchId?: string }): Promise<OfflineExam[]> => {
    const qs = new URLSearchParams({ limit: "100", sortBy: "date", sortOrder: "desc" });
    if (params?.batchId) qs.set("batchId", params.batchId);
    const docs = await api.get<ApiOfflineExam[]>(`/exams?${qs.toString()}`);
    return docs.map(examFromApi);
  }, []);

  const saveResults = useCallback(async (examId: string, items: { studentId: string; marks: number | null }[]) => {
    await api.post(`/exams/${examId}/results`, { items });
  }, []);

  const getResultsByExam = useCallback(async (examId: string): Promise<OfflineResult[]> => {
    const docs = await api.get<ApiOfflineResult[]>(`/results?examId=${examId}&limit=100`);
    return docs.map(resultFromApi);
  }, []);

  const getResultsByExams = useCallback(async (examIds: string[]): Promise<OfflineResult[]> => {
    if (examIds.length === 0) return [];
    const docs = await api.get<ApiOfflineResult[]>(`/results?examIds=${examIds.join(",")}&limit=100`);
    return docs.map(resultFromApi);
  }, []);

  const getResultsByStudent = useCallback(async (studentId: string): Promise<OfflineResult[]> => {
    const docs = await api.get<ApiOfflineResult[]>(`/results?studentId=${studentId}&limit=100`);
    return docs.map(resultFromApi);
  }, []);

  const attendancePercent = useCallback(async (studentId: string, from?: string, to?: string): Promise<number> => {
    const qs = new URLSearchParams({ studentIds: studentId });
    if (from) qs.set("dateFrom", from);
    if (to) qs.set("dateTo", to);
    const data = await api.get<Record<string, number>>(`/attendance/percentages?${qs.toString()}`);
    return data[studentId] || 0;
  }, []);

  const attendancePercentages = useCallback(async (
    params: { studentIds?: string[]; batchId?: string; batchIds?: string[] },
    from?: string,
    to?: string,
  ): Promise<Record<string, number>> => {
    const qs = new URLSearchParams();
    if (params.studentIds?.length) qs.set("studentIds", params.studentIds.join(","));
    if (params.batchId) qs.set("batchId", params.batchId);
    if (params.batchIds?.length) qs.set("batchIds", params.batchIds.join(","));
    if (from) qs.set("dateFrom", from);
    if (to) qs.set("dateTo", to);
    return api.get<Record<string, number>>(`/attendance/percentages?${qs.toString()}`);
  }, []);

  const getByStudentStats = useCallback(async (params: { batchId?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params.batchId) qs.set("batchId", params.batchId);
    if (params.from) qs.set("dateFrom", params.from);
    if (params.to) qs.set("dateTo", params.to);
    return api.get<{ studentId: string; present: number; absent: number; pct: number }[]>(`/attendance/by-student?${qs.toString()}`);
  }, []);

  const getStats = useCallback(async (params: { batchId?: string; batchIds?: string[]; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params.batchId) qs.set("batchId", params.batchId);
    if (params.batchIds?.length) qs.set("batchIds", params.batchIds.join(","));
    if (params.from) qs.set("dateFrom", params.from);
    if (params.to) qs.set("dateTo", params.to);
    return api.get<{ present: number; absent: number; pct: number; daily: { date: string; batchId: string; present: number; absent: number }[] }>(
      `/attendance/stats?${qs.toString()}`,
    );
  }, []);

  const value: Ctx = {
    saveAttendance, getByBatchDate, getByStudent,
    addExam, listExams, saveResults, getResultsByExam, getResultsByExams, getResultsByStudent,
    attendancePercent, attendancePercentages, getByStudentStats, getStats,
  };

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error("useAttendance must be within AttendanceProvider");
  return ctx;
}
