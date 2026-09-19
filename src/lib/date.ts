/**
 * Mirrors the Admin Student List's server-side "birthday today" match
 * (student.service.ts's buildStudentFilter: `dob` matched against a
 * `-MM-DD$` suffix of today's local month/day, any birth year) so the
 * Batch Director's client-cached student list uses the exact same
 * day-and-month-only semantics instead of a second, inconsistent
 * implementation. `dob` is stored as a plain "yyyy-mm-dd" string, so this
 * is a substring check, never Date-object arithmetic that could shift by
 * a day across timezones.
 */
export function isBirthdayToday(dob?: string): boolean {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return dob.endsWith(`-${month}-${day}`);
}
