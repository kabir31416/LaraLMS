export type MasterDataStatus = "সক্রিয়" | "নিষ্ক্রিয়";

export interface Session {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: MasterDataStatus;
}

export interface Course {
  id: string;
  name: string;
  sessionId: string;
  duration: number; // months
  /** Source of truth for admission-time Course Fee — never hard-coded in the admission form. */
  fee: number;
  status: MasterDataStatus;
  displayOrder: number;
}

/** Global, reusable catalog entry — no courseId. Create once ("বাংলা"), assign to as many Courses as needed via CourseSubject. */
export interface Subject {
  id: string;
  name: string;
  code?: string;
  status: MasterDataStatus;
  displayOrder: number;
}

/** The Course → Subject assignment (Course → CourseSubject → Subject → Lecture). The same Subject can have a separate CourseSubject row — and therefore separate Lectures — in every Course it's assigned to. */
export interface CourseSubject {
  id: string;
  courseId: string;
  subjectId: string;
  /** Display order of this Subject within its Course. */
  order: number;
  status: MasterDataStatus;
}

export interface Lecture {
  id: string;
  title: string;
  /** References CourseSubject, never the global Subject directly — this is what keeps the same Subject's Lectures independent between Courses. */
  courseSubjectId: string;
  lectureNumber: number;
  description?: string;
  status: MasterDataStatus;
}

export interface PaymentMethod {
  id: string;
  name: string;
  status: MasterDataStatus;
  displayOrder: number;
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

export interface GradeBand {
  minPercent: number;
  grade: string;
}

export interface AcademicSettings {
  defaultSessionId?: string;
  defaultExamDuration: number; // minutes
  passingPercentage: number;
  shuffleQuestions: boolean;
  publishResults: boolean;
  gradeScale: GradeBand[];
  rollNumberScope: "batch" | "course" | "global";
  /** The fixed one-time Admission Fee — configurable in Settings, snapshotted onto each Student at admission time (never retroactive). */
  admissionFeeBdt: number;
  /** Prefix for newly-generated Student System IDs (e.g. "LMS" -> LMS-01247). Changing it never affects already-issued IDs. */
  studentIdPrefix: string;
}

export interface InstitutionSettings {
  name: string;
  shortName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  facebookUrl?: string;
  currencySymbol: string;
  dateFormat: string;
  timezone: string;
  registrationInfo?: string;
  defaultBranchId?: string;
  receipt: { prefix: string; numberPadding: number; resetYearly: boolean };
  print: { footerText?: string; signatureLabel: string; paperSize: "A4" | "Letter"; showLogoOnDocuments: boolean };
}

export interface PublicInstitutionInfo {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  currencySymbol: string;
}

export interface PublicResultsSettings {
  enabled: boolean;
  individualEnabled: boolean;
  batchEnabled: boolean;
  requirePublished: boolean;
  visibleFields: string[];
}

export interface AuditLogEntry {
  id: string;
  actorUserId?: string;
  actorRole?: string;
  action: string;
  module: string;
  targetCollection?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  timestamp: string;
}
