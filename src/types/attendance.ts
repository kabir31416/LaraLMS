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
  /** The Course's assignment of the Subject this exam is under (Course → CourseSubject → Subject → Lecture) — the canonical link, required when creating/saving a result. */
  courseSubjectId: string;
  /** The underlying global Subject, denormalized by the backend — safe to read directly for display (e.g. via useAcademic().getSubject) without resolving through courseSubjectId. */
  subjectId: string;
  /** Optional (Result Entry Lecture-optional audit §11) — a result can be saved/sent with no Lecture chosen. */
  lectureId?: string;
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