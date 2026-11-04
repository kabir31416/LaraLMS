/** Mirrors backend/src/modules/analytics/performance.{rules,service}.ts response shapes. */

export type PerformanceBand = "excellent" | "good" | "average" | "needs_improvement" | "insufficient";
export type TrendDirection = "improving" | "declining" | "stable" | "insufficient";
export type AttendanceBand = "ok" | "low" | "no_data";
export type PerformanceStatus = PerformanceBand | "at_risk";

export interface RiskReason {
  code: "low_attendance" | "repeated_fail" | "declining" | "repeated_absent";
  message: string;
}

export interface PerformanceRules {
  excellentMin: number;
  goodMin: number;
  averageMin: number;
  minExams: number;
  lowAttendancePct: number;
  minAttendanceEntries: number;
  trendWindow: number;
  trendDelta: number;
  riskDeclineDelta: number;
  riskFailCount: number;
  riskAbsentCount: number;
  riskLookback: number;
}

export const DEFAULT_PERFORMANCE_RULES: PerformanceRules = {
  excellentMin: 80,
  goodMin: 60,
  averageMin: 40,
  minExams: 2,
  lowAttendancePct: 75,
  minAttendanceEntries: 5,
  trendWindow: 3,
  trendDelta: 5,
  riskDeclineDelta: 10,
  riskFailCount: 2,
  riskAbsentCount: 2,
  riskLookback: 5,
};

export interface PerformanceRow {
  studentId: string;
  name: string;
  registrationId: string;
  rollNumber: string | null;
  batchId: string | null;
  batchName: string | null;
  courseName: string | null;
  photoUrl: string | null;
  percentage: number | null;
  grade: string | null;
  examsSat: number;
  examsAbsent: number;
  highest: number | null;
  lowest: number | null;
  band: PerformanceBand;
  trend: TrendDirection;
  trendChange: number | null;
  attendancePct: number | null;
  attendanceEntries: number;
  attendanceBand: AttendanceBand;
  status: PerformanceStatus;
  riskReasons: RiskReason[];
}

export interface PerformanceResponse {
  generatedAt: string;
  scope: { director: boolean };
  rules: PerformanceRules;
  passingPercentage: number;
  summary: {
    totalStudents: number;
    withResults: number;
    withAttendance: number;
    avgPercentage: number | null;
    avgAttendance: number | null;
    improving: number;
    declining: number;
    lowAttendance: number;
    atRisk: number;
    exams: number;
  };
  charts: {
    examTrend: { examId: string; title: string; date: string; batchName: string; percentage: number; students: number }[];
    subjects: { subjectId: string; name: string; percentage: number; results: number }[];
    attendanceMonthly: { month: string; pct: number; entries: number }[];
    batches: { batchId: string; name: string; students: number; percentage: number | null; attendancePct: number | null; atRisk: number }[];
    trendSplit: { improving: number; stable: number; declining: number; insufficient: number };
    bands: Record<PerformanceBand, number>;
  };
  items: PerformanceRow[];
}

export interface PerformanceOptions {
  director: boolean;
  sessions: { id: string; name: string }[];
  courses: { id: string; name: string; sessionId: string }[];
  batches: { id: string; name: string; courseId: string }[];
  subjects: { id: string; name: string }[];
  exams: { id: string; title: string; date: string; batchId: string; subjectId: string }[];
}

export interface StudentPerformanceProfile {
  student: { id: string; name: string; registrationId: string; rollNumber: string | null; course: string | null; batch: string | null; batchId: string | null; photoUrl: string | null };
  passingPercentage: number;
  overall: {
    percentage: number | null;
    grade: string | null;
    obtained: number;
    fullMarks: number;
    examsSat: number;
    examsAbsent: number;
    highest: number | null;
    lowest: number | null;
    result: "উত্তীর্ণ" | "অনুত্তীর্ণ" | null;
  };
  trend: { direction: TrendDirection; change: number | null; window: number };
  attendance: { present: number; absent: number; total: number; pct: number | null; monthly: { month: string; present: number; total: number; pct: number }[]; band?: AttendanceBand };
  exams: {
    examId: string;
    title: string;
    date: string;
    subject: string;
    subjectId: string;
    batch: string;
    fullMarks: number;
    marks: number | null;
    percentage: number | null;
    grade: string | null;
    status: "উত্তীর্ণ" | "অনুত্তীর্ণ" | "অনুপস্থিত";
  }[];
  subjects: { subjectId: string; name: string; exams: number; absent: number; obtained: number; fullMarks: number; percentage: number | null; grade: string | null }[];
  /** Staff views only — never present on the student's own /me response. */
  band?: PerformanceBand;
  status?: PerformanceStatus;
  riskReasons?: RiskReason[];
  rules?: PerformanceRules;
}

export const BAND_LABELS: Record<PerformanceBand, string> = {
  excellent: "চমৎকার",
  good: "ভালো",
  average: "মোটামুটি",
  needs_improvement: "উন্নতি প্রয়োজন",
  insufficient: "পর্যাপ্ত তথ্য নেই",
};

export const STATUS_LABELS: Record<PerformanceStatus, string> = { ...BAND_LABELS, at_risk: "ঝুঁকিতে" };

export const TREND_LABELS: Record<TrendDirection, string> = {
  improving: "উন্নতি হচ্ছে",
  declining: "অবনতি হচ্ছে",
  stable: "স্থিতিশীল",
  insufficient: "পর্যাপ্ত তথ্য নেই",
};
