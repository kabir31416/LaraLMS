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
