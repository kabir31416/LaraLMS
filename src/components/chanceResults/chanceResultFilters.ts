import { RESULT_ROUNDS, SelectionType, SELECTION_TYPES, ResultRound } from "@/types/chanceResult";

/**
 * Shared filter shape for every Chance Result tab (student list, institute
 * summary, batch summary, stats) — kept as plain strings with an "all"
 * sentinel so it maps 1:1 onto <Select> values and onto the backend's query
 * params (buildResultFilter in admissionResult.service.ts).
 */
export interface ChanceFilters {
  search: string;
  programName: string;
  session: string;
  instituteName: string;
  batchId: string;
  resultRound: ResultRound | "all";
  selectionType: SelectionType | "all";
}

export const DEFAULT_CHANCE_FILTERS: ChanceFilters = {
  search: "",
  programName: "all",
  session: "all",
  instituteName: "all",
  batchId: "all",
  resultRound: "all",
  selectionType: "all",
};

export { RESULT_ROUNDS, SELECTION_TYPES };

/**
 * Builds the query string every list/summary/stats endpoint expects.
 * `batchId` is only ever sent for an Admin's own explicit selection — a
 * Batch Director's scope is always enforced server-side regardless, but we
 * still follow the app's convention (see AdmissionResult.tsx) of not even
 * showing/sending a batch selector for a role it can't affect.
 */
export function buildFilterQuery(filters: ChanceFilters, isAdmin: boolean, extra?: Record<string, string>): URLSearchParams {
  const qs = new URLSearchParams(extra);
  if (filters.search.trim()) qs.set("search", filters.search.trim());
  if (filters.programName !== "all") qs.set("programName", filters.programName);
  if (filters.session !== "all") qs.set("session", filters.session);
  if (filters.instituteName !== "all") qs.set("instituteName", filters.instituteName);
  if (isAdmin && filters.batchId !== "all") qs.set("batchId", filters.batchId);
  if (filters.resultRound !== "all") qs.set("resultRound", filters.resultRound);
  if (filters.selectionType !== "all") qs.set("selectionType", filters.selectionType);
  return qs;
}
