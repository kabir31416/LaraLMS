export interface Student {
  id: string;
  studentId: string;
  name: string;
  photo?: string;
  mobile: string;
  altMobile?: string;
  email?: string;
  dob: string;
  gender: "পুরুষ" | "মহিলা" | "অন্যান্য";
  institution: string;
  class: string;

  // Guardian
  guardianName: string;
  guardianRelation: string;
  guardianMobile: string;
  address: string;

  // Academic
  course: string;
  batch: string;
  section: string;
  group: string;
  subjects: string[];
  admissionDate: string;
  admissionType: "নতুন" | "পুরাতন";

  // Fees
  admissionFee: number;
  monthlyFee: number;
  discount: number;
  totalFee: number;
  paid: number;
  due: number;

  // Status
  status: "সক্রিয়" | "নিষ্ক্রিয়";
}

export interface Payment {
  id: string;
  studentId: string;
  date: string;
  amount: number;
  method: string;
  note?: string;
}

export interface AttendanceRecord {
  date: string;
  status: "উপস্থিত" | "অনুপস্থিত" | "দেরি";
}

export interface ExamResult {
  exam: string;
  subject: string;
  totalMarks: number;
  obtained: number;
  grade: string;
}

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
