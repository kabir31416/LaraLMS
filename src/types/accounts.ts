export type PaymentMethod = "নগদ" | "বিকাশ" | "নগদ (মোবাইল)" | "রকেট" | "ব্যাংক" | "অন্যান্য";

export type TransactionSource = "manual" | "student_fee" | "admission_fee" | "book_sale" | "book_issue" | "exam_fee";

export interface IncomeEntry {
  id: string;
  date: string; // ISO
  category: string;
  amount: number;
  branchId: string;
  branchName: string;
  method: PaymentMethod;
  studentId?: string;
  studentName?: string;
  note?: string;
  source: TransactionSource;
  refId?: string; // payment id / issue id
}

export interface ExpenseEntry {
  id: string;
  date: string;
  category: string;
  amount: number;
  branchId: string;
  branchName: string;
  method: PaymentMethod;
  note?: string;
}

export interface AccountBranch {
  id: string;
  name: string;
}

export const DEFAULT_INCOME_CATEGORIES = [
  "ভর্তি ফি",
  "কোর্স ফি",
  "বই বিক্রি",
  "পরীক্ষা ফি",
  "অন্যান্য",
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "শিক্ষক বেতন",
  "ভাড়া",
  "বিদ্যুৎ",
  "স্টাফ",
  "মার্কেটিং",
  "অন্যান্য",
];

export const ACCOUNT_BRANCHES: AccountBranch[] = [
  { id: "main", name: "প্রধান শাখা" },
  { id: "uttara", name: "উত্তরা শাখা" },
  { id: "mirpur", name: "মিরপুর শাখা" },
  { id: "dhanmondi", name: "ধানমন্ডি শাখা" },
  { id: "mohammadpur", name: "মোহাম্মদপুর শাখা" },
];

export const PAYMENT_METHODS_LIST: PaymentMethod[] = ["নগদ", "বিকাশ", "নগদ (মোবাইল)", "রকেট", "ব্যাংক", "অন্যান্য"];
