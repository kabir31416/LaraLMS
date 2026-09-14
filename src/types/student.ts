export type FeeType = "এককালীন" | "মাসিক";

export interface ProfileCompletion {
  status: "incomplete" | "complete";
  percent: number;
  missingFields: string[];
}

export interface Student {
  id: string;
  studentId: string; // permanent Registration ID — immutable, Phase 1 §13
  rollNumber?: string; // admin-assigned, editable only via updateRoll — Phase 1 §13
  batchId?: string; // current batch, kept in sync by enroll/transfer/withdraw — Phase 1 §14
  name: string;
  photo?: string;
  mobile: string;
  altMobile?: string;
  email?: string;
  dob?: string;
  gender?: "পুরুষ" | "মহিলা" | "অন্যান্য";
  institution?: string;
  class?: string;
  /** Admin-controlled (Phase 4). */
  bloodGroup?: string;

  // Guardian (stored server-side in its own collection — Phase 1 §17 — but
  // still readable/writable here exactly as before; nothing else changes).
  // guardianMobile is admin-controlled; the rest are student-editable (Phase 4).
  guardianName?: string;
  guardianRelation?: string;
  guardianMobile?: string;
  guardianOccupation?: string;
  guardianAddress?: string;
  /** Legacy single field — superseded by present/permanentAddress below, kept for backward compatibility. */
  address?: string;
  /** Student-editable (Phase 4). */
  presentAddress?: string;
  permanentAddress?: string;

  // Student-editable HSC/SSC info (Phase 4)
  hscInstitution?: string;
  hscBoard?: string;
  hscPassingYear?: string;
  hscGroup?: string;
  hscGpa?: string;
  sscInstitution?: string;
  sscBoard?: string;
  sscPassingYear?: string;
  sscGroup?: string;
  sscGpa?: string;

  // Academic — courseId is the real Course reference (Phase 4); `course` stays
  // as free text for existing UI/reports that read it as a string.
  courseId?: string;
  course?: string;
  section?: string;
  group?: string;
  subjects: string[];
  admissionDate: string;
  admissionType: "নতুন" | "পুরাতন";

  // Fees
  feeType: FeeType;
  courseDuration: number; // months
  totalCourseFee: number;
  admissionFee: number;
  monthlyFee: number;
  discount: number;
  totalFee: number;
  paid: number;
  due: number;

  // Status
  status: "সক্রিয়" | "নিষ্ক্রিয়";
  profileCompletion?: ProfileCompletion;
}

export interface Payment {
  id: string;
  receiptNo: string;
  studentId: string;
  date: string;
  amount: number;
  discount: number;
  fine: number;
  paidAmount: number;
  method: string;
  feeType: FeeType;
  month?: string; // for monthly payments
  note?: string;
}

export const FEE_TYPES: FeeType[] = ["এককালীন", "মাসিক"];
export const COURSES = ["বিজ্ঞান", "বাণিজ্য", "মানবিক", "সাধারণ"];
export const BATCHES = ["ব্যাচ-২০২৬-A", "ব্যাচ-২০২৬-B", "ব্যাচ-২০২৫-A", "ব্যাচ-২০২৫-B"];
export const SECTIONS = ["সেকশন-A", "সেকশন-B", "সেকশন-C"];
export const GROUPS = ["বিজ্ঞান", "বাণিজ্য", "মানবিক"];
export const CLASSES = ["ষষ্ঠ", "সপ্তম", "অষ্টম", "নবম", "দশম", "একাদশ", "দ্বাদশ"];
export const SUBJECTS = [
  "বাংলা", "ইংরেজি", "গণিত", "পদার্থবিজ্ঞান", "রসায়ন",
  "জীববিজ্ঞান", "উচ্চতর গণিত", "হিসাববিজ্ঞান", "ব্যবসায় শিক্ষা",
  "বাংলাদেশ ও বিশ্বপরিচয়", "তথ্য ও যোগাযোগ প্রযুক্তি", "ধর্ম",
];
export const GENDERS = ["পুরুষ", "মহিলা", "অন্যান্য"] as const;
export const RELATIONS = ["পিতা", "মাতা", "ভাই", "বোন", "অন্যান্য"];
