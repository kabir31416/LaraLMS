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

export interface Subject {
  id: string;
  name: string;
  courseId: string;
  status: MasterDataStatus;
  displayOrder: number;
}

export interface Lecture {
  id: string;
  title: string;
  subjectId: string;
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
