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

export interface Branch {
  id: string;
  name: string;
  address: string;
  director: string;
  phone: string;
}

// Stock available at a branch for a book
export interface BranchStock {
  branchId: string;
  bookId: string;
  quantity: number;
}

// Books currently issued to students
export interface StudentBookIssue {
  id: string;
  studentId: string;
  branchId: string;
  bookId: string;
  quantity: number;
  issueDate: string;
  returnedQuantity: number; // partial return support
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

export const DEMO_BRANCHES: Branch[] = [
  { id: "br1", name: "ঢাকা মেইন ব্রাঞ্চ", address: "ধানমন্ডি, ঢাকা", director: "জনাব আব্দুল করিম", phone: "01711000001" },
  { id: "br2", name: "চট্টগ্রাম ব্রাঞ্চ", address: "আগ্রাবাদ, চট্টগ্রাম", director: "জনাব মোহাম্মদ আলী", phone: "01711000002" },
  { id: "br3", name: "সিলেট ব্রাঞ্চ", address: "জিন্দাবাজার, সিলেট", director: "জনাব রফিকুল ইসলাম", phone: "01711000003" },
  { id: "br4", name: "রাজশাহী ব্রাঞ্চ", address: "সাহেব বাজার, রাজশাহী", director: "জনাব হাবিবুর রহমান", phone: "01711000004" },
  { id: "br5", name: "খুলনা ব্রাঞ্চ", address: "ময়লাপোতা, খুলনা", director: "জনাব শামসুল হক", phone: "01711000005" },
  { id: "br6", name: "বরিশাল ব্রাঞ্চ", address: "সদর রোড, বরিশাল", director: "জনাব নাজমুল হাসান", phone: "01711000006" },
  { id: "br7", name: "রংপুর ব্রাঞ্চ", address: "জাহাজ কোম্পানির মোড়, রংপুর", director: "জনাব ফরিদ উদ্দিন", phone: "01711000007" },
  { id: "br8", name: "ময়মনসিংহ ব্রাঞ্চ", address: "গাঙ্গিনারপাড়, ময়মনসিংহ", director: "জনাব জহিরুল ইসলাম", phone: "01711000008" },
  { id: "br9", name: "কুমিল্লা ব্রাঞ্চ", address: "কান্দিরপাড়, কুমিল্লা", director: "জনাব সাইফুল ইসলাম", phone: "01711000009" },
  { id: "br10", name: "নারায়ণগঞ্জ ব্রাঞ্চ", address: "চাষাঢ়া, নারায়ণগঞ্জ", director: "জনাব আনিসুর রহমান", phone: "01711000010" },
];

export const DEMO_BOOKS: Book[] = [
  { id: "bk1", bookCode: "BK-0001", name: "বাংলা ব্যাকরণ", subject: "বাংলা", class: "নবম", author: "ড. মুহম্মদ শহীদুল্লাহ", price: 250, totalStock: 200, lowStockThreshold: 30 },
  { id: "bk2", bookCode: "BK-0002", name: "ইংরেজি গ্রামার", subject: "ইংরেজি", class: "নবম", author: "P.K. De Sarkar", price: 300, totalStock: 180, lowStockThreshold: 30 },
  { id: "bk3", bookCode: "BK-0003", name: "উচ্চতর গণিত", subject: "গণিত", class: "দশম", author: "মো. কেতাব উদ্দিন", price: 400, totalStock: 150, lowStockThreshold: 25 },
  { id: "bk4", bookCode: "BK-0004", name: "পদার্থবিজ্ঞান", subject: "পদার্থ", class: "একাদশ", author: "ড. আমির হোসেন খান", price: 450, totalStock: 120, lowStockThreshold: 20 },
  { id: "bk5", bookCode: "BK-0005", name: "রসায়ন", subject: "রসায়ন", class: "একাদশ", author: "হাজারী ও নাগ", price: 420, totalStock: 25, lowStockThreshold: 30 },
  { id: "bk6", bookCode: "BK-0006", name: "জীববিজ্ঞান", subject: "জীববিজ্ঞান", class: "দ্বাদশ", author: "গাজী আজমল", price: 500, totalStock: 100, lowStockThreshold: 20 },
];

let bookCounter = DEMO_BOOKS.length;
export const generateBookCode = () => {
  bookCounter += 1;
  return `BK-${String(bookCounter).padStart(4, "0")}`;
};
