/** Mirrors backend/src/modules/cards — ID cards, scheduled exams, assignments and admit cards. */

export interface CardInstitution {
  name: string;
  shortName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  signatureLabel: string;
  showLogo: boolean;
}

export interface CardSettings {
  primaryColor: string;
  idCardLayout: "landscape" | "portrait";
  idCardShowBack: boolean;
  validityMode: "session" | "date" | "none";
  validUntil?: string;
  idCardRules: string;
  idCardShowEmergencyContact: boolean;
  idCardShowQr: boolean;
  admitShowQr: boolean;
  admitDefaultInstructions: string;
  admitCardsPerPage: 1 | 2;
}

/** `studentId` = permanent system Student ID (registrationId); `registrationNumber` = academic registration number. */
export interface CardStudent {
  id: string;
  name: string;
  studentId: string;
  registrationNumber: string | null;
  photo: string | null;
  phone: string | null;
  bloodGroup: string | null;
  courseId: string | null;
  course: string | null;
  batchId: string | null;
  batch: string | null;
  session: string | null;
  sessionEnd: string | null;
  emergencyContact: string | null;
  status: string;
}

export interface IdCardMeta {
  version: number;
  verifyCode: string;
  generatedAt: string;
  firstIssuedAt: string;
  outdated: boolean;
}

export interface IdCardItem {
  student: CardStudent;
  validUntil?: string | null;
  card: IdCardMeta | null;
}

export interface IdCardPayload {
  institution: CardInstitution;
  settings: CardSettings;
  cards: IdCardItem[];
}

export interface IdCardStats {
  totalStudents: number;
  issued: number;
  withoutCard: number;
  outdated: number;
  issuedToday: number;
  recent: { studentId: string; name: string; code: string; batch: string | null; version: number; generatedAt: string }[];
}

export type IdCardSelector = { studentIds?: string[]; batchId?: string; courseId?: string; all?: boolean };
export type GenerateMode = "missing" | "changed" | "all";

export const EXAM_TYPES = ["model_test", "weekly", "monthly", "final", "admission_test", "other"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];
export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  model_test: "মডেল টেস্ট",
  weekly: "সাপ্তাহিক পরীক্ষা",
  monthly: "মাসিক পরীক্ষা",
  final: "ফাইনাল পরীক্ষা",
  admission_test: "ভর্তি পরীক্ষা",
  other: "অন্যান্য",
};
export type ExamStatus = "draft" | "published" | "completed" | "cancelled";
export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = { draft: "খসড়া", published: "প্রকাশিত", completed: "সম্পন্ন", cancelled: "বাতিল" };

type Ref = { id: string; name: string } | null;
export interface ExamSchedule {
  id: string;
  code: string;
  name: string;
  examType: ExamType;
  course: Ref;
  batch: Ref;
  allowCrossBatch: boolean;
  session: Ref;
  subject: Ref;
  date: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  venue: string | null;
  instructions: string | null;
  status: ExamStatus;
  version: number;
  publishedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  counts?: { assigned: number; generated: number; outdated: number };
}

export interface ExamDetail extends ExamSchedule {
  counts: { assigned: number; generated: number; outdated: number };
  batches: { batchId: string | null; batch: string; assigned: number; generated: number }[];
  canManage: boolean;
}

export interface ExamOverview {
  totalExams: number;
  upcoming: number;
  published: number;
  drafts: number;
  cancelled: number;
  totalAssigned: number;
  generatedAdmitCards: number;
  pendingAdmitCards: number;
  outdatedAdmitCards: number;
  nextExams: { id: string; code: string; name: string; date: string; startTime: string | null; status: ExamStatus; assigned: number; generated: number; outdated: number }[];
}

export interface AdmitMeta {
  cardNo: string;
  verifyCode: string;
  generatedAt: string;
  count: number;
  examVersion: number;
  outdated: boolean;
}

export interface ExamAssignmentRow {
  assignmentId: string;
  studentId: string;
  name: string;
  code: string;
  registrationNumber: string | null;
  photo: string | null;
  phone: string | null;
  batchId: string | null;
  batch: string | null;
  method: "batch" | "student";
  status: "active" | "removed";
  assignedAt: string;
  removedAt: string | null;
  removeReason: string | null;
  admit: AdmitMeta | null;
}

export interface EligibleStudent {
  id: string;
  name: string;
  studentId: string;
  registrationNumber: string | null;
  phone: string | null;
  photo: string | null;
  batchId: string | null;
  batch: string | null;
  assignment: "active" | "removed" | null;
}

export interface AdmitPayload {
  institution: CardInstitution;
  settings: CardSettings;
  exam: ExamSchedule;
  cards: { student: CardStudent; assignmentId: string; admit: AdmitMeta | null }[];
}

export type AdmitSelector = { scope: "all" | "batch" | "students"; batchId?: string; studentIds?: string[] };

export interface MyExam {
  exam: ExamSchedule;
  admit: { cardNo: string; generatedAt: string } | null;
  canView: boolean;
}

export const formatTime12 = (t: string | null | undefined): string => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const formatDuration = (min: number | null | undefined): string => {
  if (!min) return "";
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h.toLocaleString("bn-BD")} ঘণ্টা` : "", m ? `${m.toLocaleString("bn-BD")} মিনিট` : ""].filter(Boolean).join(" ");
};

const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const BN_DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
/** "2026-05-10" → "১০ মে ২০২৬, রবিবার" */
export const formatDateBn = (d: string | null | undefined, withDay = false): string => {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return d;
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return `${day.toLocaleString("bn-BD")} ${BN_MONTHS[m - 1]} ${y.toLocaleString("bn-BD", { useGrouping: false })}${withDay ? `, ${BN_DAYS[wd]}` : ""}`;
};
