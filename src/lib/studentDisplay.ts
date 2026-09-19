/**
 * Shared student identity display — Coaching Reg No / Roll vs System ID
 * spec §4/§5/§26. A student's Roll (`rollNumber`/`currentRollNumber`) is
 * optional and may be empty, especially for a freshly bulk-imported
 * student — the System ID (`studentId`/`registrationId`) is always
 * present, so every search result/dropdown/list row that identifies a
 * student must show the Roll when it exists and fall back to the System ID
 * when it doesn't, never a blank/dash where an identifier should be.
 */
export interface StudentIdentity {
  name: string;
  rollNumber?: string;
  systemId: string;
}

/** "250123" or, when Roll is empty, "NEU-000152" — never blank. */
export function studentIdentifierLabel(s: Pick<StudentIdentity, "rollNumber" | "systemId">): string {
  return s.rollNumber || s.systemId;
}

/** "Rahim Ahmed — 250123" or, when Roll is empty, "Rahim Ahmed — NEU-000152". */
export function formatStudentLabel(s: StudentIdentity): string {
  return `${s.name} — ${studentIdentifierLabel(s)}`;
}

/**
 * Client-side search predicate for a student picker's already-loaded list
 * (name/roll/system-ID/mobile) — mirrors the backend's buildSearchFilterWithGuardian
 * field set (student.service.ts) for the fields available on a plain
 * Student object (guardian mobile isn't included here since these client-side
 * lists don't carry it).
 */
export function matchesStudentQuery(query: string, s: { name: string; rollNumber?: string; systemId: string; mobile?: string }): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${s.name} ${s.rollNumber || ""} ${s.systemId} ${s.mobile || ""}`.toLowerCase();
  return haystack.includes(q);
}

const MISSING_ROLL_SORT_KEY = Number.MAX_SAFE_INTEGER;

/**
 * Numeric-aware ascending Roll Number comparator for every student roster in
 * the app (Student List, Batch roster, Result Entry, Fee due list, etc.) —
 * `rollNumber` is admin-entered/Excel-imported free text, so a plain string
 * sort would put "10" before "2". Missing/non-numeric rolls always sort
 * last, regardless of direction; `name` is the tiebreaker. This sorts by
 * Roll ONLY — never by Registration ID (`systemId`/`studentId`), which is a
 * separate, permanent identity field.
 */
export function compareByRoll(a: { rollNumber?: string; name: string }, b: { rollNumber?: string; name: string }): number {
  const parse = (v?: string): number => {
    if (!v || !v.trim()) return MISSING_ROLL_SORT_KEY;
    const n = Number(v);
    return Number.isFinite(n) ? n : MISSING_ROLL_SORT_KEY;
  };
  const diff = parse(a.rollNumber) - parse(b.rollNumber);
  return diff !== 0 ? diff : a.name.localeCompare(b.name);
}
