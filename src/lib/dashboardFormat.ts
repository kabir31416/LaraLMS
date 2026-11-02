/** Dashboard formatters + chart axis styling shared by every dashboard. */

export const BN_MONTHS = ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];

export function taka(n: number | null | undefined): string {
  return `৳${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

/** Compact axis/tick money: ৳12.5k, ৳3.2L (lakh) — Bangladeshi convention. */
export function takaShort(n: number): string {
  const v = Math.abs(n);
  if (v >= 1e7) return `৳${(n / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `৳${(n / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `৳${(n / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k`;
  return `৳${Math.round(n)}`;
}

export function monthLabel(yyyyMm: string, withYear = false): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${BN_MONTHS[(m || 1) - 1]}${withYear ? ` '${String(y).slice(2)}` : ""}`;
}

export function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${BN_MONTHS[(m || 1) - 1]}`;
}

/** Shared recharts axis styling — recessive ink, no axis lines. */
export const axisProps = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

