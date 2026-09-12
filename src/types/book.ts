export interface Book {
  id: string;
  bookCode: string;
  name: string;
  subject: string;
  class: string;
  author?: string;
  price: number;
  totalStock: number; // central/main stock
  lowStockThreshold: number;
}

// Stock available at a branch for a book
export interface BranchStock {
  branchId: string;
  bookId: string;
  quantity: number;
}

// Books currently issued to students (now from main stock)
export interface StudentBookIssue {
  id: string;
  studentId: string;
  branchId?: string; // optional — issues now come from main stock
  bookId: string;
  quantity: number;
  issueDate: string;
  returnedQuantity: number;
  status: "ইস্যু" | "আংশিক ফেরত" | "ফেরত";
}

export type StockHistoryAction =
  | "স্টক যোগ"
  | "স্টক কমানো"
  | "ব্রাঞ্চে স্থানান্তর"
  | "শিক্ষার্থীকে বিতরণ"
  | "শিক্ষার্থী থেকে ফেরত";

export interface StockHistoryEntry {
  id: string;
  date: string;
  action: StockHistoryAction;
  bookId: string;
  bookName: string;
  quantity: number;
  branchId?: string;
  branchName?: string;
  studentId?: string;
  studentName?: string;
  note?: string;
}

