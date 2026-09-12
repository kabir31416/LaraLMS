import { AttendanceRecord, ExamResult } from "@/types/student";

// Attendance/Results below are placeholder data for the Attendance/Result
// screens (Phase 3, Modules 18-20 — not built yet; Payments moved to the
// real API in Modules 15-17). The old seed data here used to reference mock
// student ids ("1".."6") that no longer exist now that Students come from
// the real API (Phase 3, Module 10) with real Mongo ids, so it's left empty
// rather than pointing at students that don't exist.
export const mockAttendance: Record<string, AttendanceRecord[]> = {};
export const mockResults: Record<string, ExamResult[]> = {};
