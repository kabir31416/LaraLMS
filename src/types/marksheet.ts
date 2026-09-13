/** Mirrors publicResults.service.ts's IndividualResultView exactly — the public Marksheet's one response shape. */
export interface MarksheetSubjectSummary {
  subject: string;
  fullMarks: number;
  obtained: number;
  percentage: number;
  grade: string;
}

export interface MarksheetDetailRow {
  date: string;
  subject: string;
  examTitle: string;
  batch: string;
  fullMarks: number;
  obtained: number | null;
  percentage: number | null;
  status: "উত্তীর্ণ" | "অনুত্তীর্ণ" | "অনুপস্থিত";
}

export interface IndividualResultView {
  student: { name: string; rollNumber: string; course: string | null; batch: string | null };
  dateRange: { start: string; end: string };
  subjects: MarksheetSubjectSummary[];
  overall: { fullMarks: number; obtained: number; percentage: number; grade: string; status: "উত্তীর্ণ" | "অনুত্তীর্ণ" };
  details: MarksheetDetailRow[];
}

export interface PublicBatchOption {
  name: string;
  courseName: string | null;
}
