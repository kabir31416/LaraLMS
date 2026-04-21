export interface Session {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Course {
  id: string;
  name: string;
  sessionId: string;
  duration: number; // months
}

export interface Subject {
  id: string;
  name: string;
  courseId: string;
}

export interface Lecture {
  id: string;
  title: string;
  subjectId: string;
  lectureNumber: number;
  description?: string;
}

export type ClassExamType = "Class" | "Exam";

export interface ClassExam {
  id: string;
  type: ClassExamType;
  lectureId: string;
  title: string;
  date: string;
  time: string;
  duration: number; // minutes
  // Exam-specific
  totalMarks?: number;
  passMarks?: number;
  status?: "Open" | "Locked";
  batchId?: string;
  questions?: Question[];
}

export interface Question {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: "A" | "B" | "C" | "D";
}

export interface VideoClass {
  id: string;
  title: string;
  youtubeLink: string;
  description?: string;
  duration: string;
  lectureId: string;
  batchId?: string;
}

export interface AcademicSettings {
  defaultSessionId?: string;
  defaultExamDuration: number; // minutes
  passingPercentage: number;
  shuffleQuestions: boolean;
  publishResults: boolean;
}
