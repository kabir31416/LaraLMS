import { env } from "../../config/env";

/**
 * Calendar dates in the institution's own timezone (env.APP_TIMEZONE,
 * default Asia/Dhaka). Every stored date in this app is a plain
 * "yyyy-mm-dd" string entered in local time, so "today" must be computed in
 * that same timezone — `new Date().toISOString()` is UTC and is a day behind
 * Bangladesh between 00:00 and 06:00.
 */
export function localToday(timeZone = env.APP_TIMEZONE): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Pure "yyyy-mm-dd" arithmetic (UTC-based, so no DST/offset drift). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetweenInclusive(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000) + 1;
}

/** "yyyy-mm" keys for the `count` months ending with `endMonth` (oldest first). */
export function monthKeysEnding(endMonth: string, count: number): string[] {
  const [y, m] = endMonth.split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
