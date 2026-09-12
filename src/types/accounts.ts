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

export const PAYMENT_METHODS_LIST: PaymentMethod[] = ["নগদ", "বিকাশ", "নগদ (মোবাইল)", "রকেট", "ব্যাংক", "অন্যান্য"];
