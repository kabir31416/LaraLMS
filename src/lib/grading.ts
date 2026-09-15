import type { GradeBand } from "@/types/academic";

/**
 * Mirrors the backend's gradeFor() (publicResults.service.ts) exactly —
 * highest grade band whose minPercent the percentage clears. Used by
 * internal result views (Student Portal, Admin Student Profile) so the
 * same Settings.gradeScale drives grading everywhere, not just the public
 * marksheet (Settings §12: "do not duplicate grading logic").
 */
export function gradeFor(percent: number, gradeScale: GradeBand[]): string {
  if (!gradeScale.length) return "-";
  const sorted = [...gradeScale].sort((a, b) => b.minPercent - a.minPercent);
  return sorted.find((b) => percent >= b.minPercent)?.grade ?? "-";
}
