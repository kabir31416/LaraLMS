import { Payment, AttendanceRecord, ExamResult } from "@/types/student";

let receiptCounter = 10;
export const generateReceiptNo = () => {
  receiptCounter++;
  const year = new Date().getFullYear();
  return `RCPT-${year}-${String(receiptCounter).padStart(4, "0")}`;
};

// Payments/Attendance/Results below are placeholder data for the Fee/Attendance/
// Result screens (Phase 3, Modules 15-20 — not built yet). The old seed data
// here used to reference mock student ids ("1".."6") that no longer exist now
// that Students come from the real API (Phase 3, Module 10) with real Mongo
// ids, so it's left empty rather than pointing at students that don't exist.
export const mockPayments: Payment[] = [];
export const mockAttendance: Record<string, AttendanceRecord[]> = {};
export const mockResults: Record<string, ExamResult[]> = {};
