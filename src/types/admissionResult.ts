/**
 * Admission Result feature — mirrors the raw `/students` API document shape
 * directly (not the frontend-renamed `Student` type in types/student.ts,
 * which StudentContext produces only for its own already-loaded-in-memory
 * list). This page does real server-side pagination/search/filter instead,
 * so it talks to the API directly and needs its own light DTO.
 */
export interface AdmissionResultStudent {
  _id: string;
  name: string;
  phone: string;
  currentRollNumber?: string;
  currentBatchId?: string;
  course?: string;
  admissionRoll?: string;
}

export interface AdmissionRollStats {
  total: number;
  added: number;
  missing: number;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type AdmissionRollStatusFilter = "all" | "added" | "missing";
