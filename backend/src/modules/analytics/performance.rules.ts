import { DEFAULT_PERFORMANCE_RULES, type PerformanceRules } from "../settings/settings.model";

/**
 * Student Performance Analytics — the explainable rules, kept pure (no DB)
 * so they can be unit-tested and documented exactly as they run.
 *
 * Calculation conventions are the same as the existing marksheet
 * (publicResults.service.ts) so the analytics can never disagree with a
 * student's Result section:
 *  - a result row whose marks fall outside 0..fullMarks is "invalid" and ignored;
 *  - marks === null means "absent" — it is NOT a zero; it only counts as a missed exam;
 *  - an overall/subject percentage is Σ obtained ÷ Σ full marks (never an average of percentages);
 *  - attendance % is present ÷ total entries, rounded — the attendance service's formula.
 */

export type PerformanceBand = "excellent" | "good" | "average" | "needs_improvement" | "insufficient";
export type TrendDirection = "improving" | "declining" | "stable" | "insufficient";
export type AttendanceBand = "ok" | "low" | "no_data";
export type PerformanceStatus = PerformanceBand | "at_risk";

export interface ExamPoint {
  examId: string;
  date: string; // yyyy-mm-dd
  fullMarks: number;
  marks: number | null; // null = absent
}

export interface RiskReason {
  code: "low_attendance" | "repeated_fail" | "declining" | "repeated_absent";
  message: string;
}

export interface StudentPerformance {
  examsSat: number;
  examsAbsent: number;
  obtained: number;
  fullMarks: number;
  /** Σ obtained ÷ Σ full, 2 dp; null when no exam was sat. */
  percentage: number | null;
  highest: number | null;
  lowest: number | null;
  band: PerformanceBand;
  trend: TrendDirection;
  /** Percentage-point change between the two trend windows (null when insufficient). */
  trendChange: number | null;
  attendance: { present: number; total: number; pct: number | null; band: AttendanceBand };
  riskReasons: RiskReason[];
  status: PerformanceStatus;
}

export function mergeRules(stored?: Partial<PerformanceRules> | null): PerformanceRules {
  const out = { ...DEFAULT_PERFORMANCE_RULES };
  if (stored && typeof stored === "object") {
    for (const k of Object.keys(DEFAULT_PERFORMANCE_RULES) as (keyof PerformanceRules)[]) {
      const v = (stored as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
  }
  return out;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function isValidPoint(p: ExamPoint): boolean {
  return p.fullMarks > 0 && (p.marks === null || (p.marks >= 0 && p.marks <= p.fullMarks));
}

export function pctOf(p: ExamPoint): number | null {
  return p.marks === null ? null : round2((p.marks / p.fullMarks) * 100);
}

/** Pooled percentage of a set of sat exams (Σ obtained ÷ Σ full). */
function pooled(points: ExamPoint[]): number | null {
  const sat = points.filter((p) => p.marks !== null);
  const full = sat.reduce((s, p) => s + p.fullMarks, 0);
  return full > 0 ? round2((sat.reduce((s, p) => s + (p.marks as number), 0) / full) * 100) : null;
}

export function bandFor(percentage: number | null, examsSat: number, rules: PerformanceRules): PerformanceBand {
  if (percentage === null || examsSat < rules.minExams) return "insufficient";
  if (percentage >= rules.excellentMin) return "excellent";
  if (percentage >= rules.goodMin) return "good";
  if (percentage >= rules.averageMin) return "average";
  return "needs_improvement";
}

/**
 * Trend = pooled % of the most recent window of sat exams minus the pooled %
 * of the same-sized window just before it. The window is `trendWindow`, or
 * half the exams sat when there are fewer (4 exams → 2 vs 2); it is never
 * smaller than 2, so fewer than 4 exams sat → "insufficient".
 */
export function trendFor(satChrono: ExamPoint[], rules: PerformanceRules): { trend: TrendDirection; change: number | null } {
  const w = Math.min(rules.trendWindow, Math.floor(satChrono.length / 2));
  if (w < 2) return { trend: "insufficient", change: null };
  const recent = satChrono.slice(-w);
  const previous = satChrono.slice(-2 * w, -w);
  if (recent.length < 2 || previous.length < 2) return { trend: "insufficient", change: null };
  const a = pooled(recent);
  const b = pooled(previous);
  if (a === null || b === null) return { trend: "insufficient", change: null };
  const change = round2(a - b);
  if (change >= rules.trendDelta) return { trend: "improving", change };
  if (change <= -rules.trendDelta) return { trend: "declining", change };
  return { trend: "stable", change };
}

export function attendanceOf(present: number, total: number, rules: PerformanceRules): StudentPerformance["attendance"] {
  if (total <= 0) return { present: 0, total: 0, pct: null, band: "no_data" };
  const pct = Math.round((present / total) * 100);
  const band: AttendanceBand = total >= rules.minAttendanceEntries && pct < rules.lowAttendancePct ? "low" : "ok";
  return { present, total, pct, band };
}

/**
 * Computes one student's indicators. Marks and attendance stay separate
 * indicators; "at_risk" is only the overall status when at least one
 * explainable rule fires — and no rule fires on a single low mark:
 *  1. low_attendance  — attendance below lowAttendancePct over ≥ minAttendanceEntries days;
 *  2. repeated_fail   — ≥ riskFailCount (min 2) of the last riskLookback exams sat are below the pass mark;
 *  3. declining       — trend change ≤ −riskDeclineDelta (needs ≥ 2 exams in each window);
 *  4. repeated_absent — recorded absent (marks = null) in ≥ riskAbsentCount of the last riskLookback result entries.
 *     Only explicit absent records count; an exam with no result row (e.g. joined the batch later) is never assumed missed.
 */
export function evaluateStudent(
  rawPoints: ExamPoint[],
  attendance: { present: number; total: number },
  passingPercentage: number,
  rules: PerformanceRules,
): StudentPerformance {
  const points = rawPoints.filter(isValidPoint).sort((a, b) => a.date.localeCompare(b.date) || a.examId.localeCompare(b.examId));
  const sat = points.filter((p) => p.marks !== null);
  const pcts = sat.map((p) => pctOf(p) as number);
  const obtained = sat.reduce((s, p) => s + (p.marks as number), 0);
  const fullMarks = sat.reduce((s, p) => s + p.fullMarks, 0);
  const percentage = fullMarks > 0 ? round2((obtained / fullMarks) * 100) : null;
  const band = bandFor(percentage, sat.length, rules);
  const { trend, change } = sat.length >= rules.minExams ? trendFor(sat, rules) : { trend: "insufficient" as const, change: null };
  const att = attendanceOf(attendance.present, attendance.total, rules);

  const reasons: RiskReason[] = [];
  if (att.band === "low") {
    reasons.push({ code: "low_attendance", message: `উপস্থিতি ${att.pct}% — নির্ধারিত ${rules.lowAttendancePct}% এর কম (${att.present}/${att.total} দিন)` });
  }
  const lastSat = pcts.slice(-rules.riskLookback);
  const fails = lastSat.filter((p) => p < passingPercentage).length;
  if (fails >= Math.max(2, rules.riskFailCount)) {
    reasons.push({ code: "repeated_fail", message: `শেষ ${lastSat.length}টি পরীক্ষার ${fails}টিতে পাস নম্বরের (${passingPercentage}%) নিচে` });
  }
  if (change !== null && change <= -rules.riskDeclineDelta) {
    reasons.push({ code: "declining", message: `সাম্প্রতিক ফলাফল আগের তুলনায় ${Math.abs(change)} পয়েন্ট কমেছে` });
  }
  const lastEntries = points.slice(-rules.riskLookback);
  const absents = lastEntries.filter((p) => p.marks === null).length;
  if (absents >= rules.riskAbsentCount) {
    reasons.push({ code: "repeated_absent", message: `শেষ ${lastEntries.length}টি পরীক্ষার ${absents}টিতে অনুপস্থিত` });
  }

  return {
    examsSat: sat.length,
    examsAbsent: points.length - sat.length,
    obtained,
    fullMarks,
    percentage,
    highest: pcts.length ? Math.max(...pcts) : null,
    lowest: pcts.length ? Math.min(...pcts) : null,
    band,
    trend,
    trendChange: change,
    attendance: att,
    riskReasons: reasons,
    status: reasons.length ? "at_risk" : band,
  };
}
