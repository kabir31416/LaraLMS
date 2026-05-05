export type AttendanceStatus = "Present" | "Absent";

export interface AttendanceEntry {
  id: string;
  batchId: string;
  studentId: string;
  date: string; // yyyy-MM-dd
  status: AttendanceStatus;
  source: "Manual" | "Exam";
  examId?: string;
}

export interface OfflineExam {
  id: string;
  batchId: string;
  subjectId: string;
  lectureId: string;
  title: string;
  fullMarks: number;
  date: string;
  createdAt: string;
}

export interface OfflineResult {
  id: string;
  examId: string;
  studentId: string;
  marks: number | null; // null = absent
}