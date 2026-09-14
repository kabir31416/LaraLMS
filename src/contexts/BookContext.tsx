import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Book,
  BranchStock,
  StudentBookIssue,
  StockHistoryEntry,
} from "@/types/book";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Books/BranchStock/Issues/History are now backed by the real API (Phase 3,
 * Module 22). Branch itself is a real collection too as of Module 23 — see
 * BranchContext — this context only stores a branchId string against it.
 */
interface ApiBook {
  _id: string;
  bookCode: string;
  name: string;
  subject: string;
  class: string;
  author?: string;
  price: number;
  totalStock: number;
  lowStockThreshold: number;
}

function bookFromApi(doc: ApiBook): Book {
  return { id: doc._id, bookCode: doc.bookCode, name: doc.name, subject: doc.subject, class: doc.class, author: doc.author, price: doc.price, totalStock: doc.totalStock, lowStockThreshold: doc.lowStockThreshold };
}

interface ApiBranchStock {
  _id: string;
  branchId: string;
  bookId: string;
  quantity: number;
}

function branchStockFromApi(doc: ApiBranchStock): BranchStock {
  return { branchId: doc.branchId, bookId: doc.bookId, quantity: doc.quantity };
}

interface ApiBookIssue {
  _id: string;
  studentId: string;
  branchId?: string;
  bookId: string;
  quantity: number;
  issueDate: string;
  returnedQuantity: number;
  status: StudentBookIssue["status"];
}

function issueFromApi(doc: ApiBookIssue): StudentBookIssue {
  return { id: doc._id, studentId: doc.studentId, branchId: doc.branchId, bookId: doc.bookId, quantity: doc.quantity, issueDate: doc.issueDate, returnedQuantity: doc.returnedQuantity, status: doc.status };
}

interface ApiStockHistory {
  _id: string;
  createdAt: string;
  action: StockHistoryEntry["action"];
  bookId: string;
  bookName: string;
  quantity: number;
  branchId?: string;
  branchName?: string;
  studentId?: string;
  studentName?: string;
  note?: string;
}

function historyFromApi(doc: ApiStockHistory): StockHistoryEntry {
  return { id: doc._id, date: doc.createdAt, action: doc.action, bookId: doc.bookId, bookName: doc.bookName, quantity: doc.quantity, branchId: doc.branchId, branchName: doc.branchName, studentId: doc.studentId, studentName: doc.studentName, note: doc.note };
}

interface BookContextType {
  books: Book[];
  branchStock: BranchStock[];
  issues: StudentBookIssue[];
  history: StockHistoryEntry[];
  loading: boolean;

  addBook: (data: Omit<Book, "id" | "bookCode">) => Promise<Book>;
  updateBook: (id: string, data: Partial<Book>) => Promise<Book>;
  deleteBook: (id: string) => Promise<void>;

  addStock: (bookId: string, qty: number, note?: string) => Promise<void>;
  reduceStock: (bookId: string, qty: number, note?: string) => Promise<void>;

  transferMultipleToBranch: (
    branchId: string,
    items: { bookId: string; quantity: number }[]
  ) => Promise<{ ok: boolean; failed?: string[] }>;

  issueMultipleToStudent: (params: {
    studentId: string;
    studentName: string;
    issueDate: string;
    items: { bookId: string; quantity: number }[];
  }) => Promise<{ ok: boolean; failed?: string[] }>;

  returnFromStudent: (issueId: string, qty: number) => Promise<boolean>;

  getStudentIssues: (studentId: string) => StudentBookIssue[];
  refreshBooks: () => Promise<void>;
  refreshBranchStock: () => Promise<void>;
  refreshIssues: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

const BookContext = createContext<BookContextType | null>(null);

const LIST_LIMIT = "?limit=100";

export function BookProvider({ children }: { children: React.ReactNode }) {
  const { initializing, user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [branchStock, setBranchStock] = useState<BranchStock[]>([]);
  const [issues, setIssues] = useState<StudentBookIssue[]>([]);
  const [history, setHistory] = useState<StockHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshBooks = useCallback(async () => {
    const docs = await api.get<ApiBook[]>(`/books${LIST_LIMIT}`);
    setBooks(docs.map(bookFromApi));
  }, []);

  const refreshBranchStock = useCallback(async () => {
    const docs = await api.get<ApiBranchStock[]>(`/books/branch-stock/list${LIST_LIMIT}`);
    setBranchStock(docs.map(branchStockFromApi));
  }, []);

  const refreshIssues = useCallback(async () => {
    const docs = await api.get<ApiBookIssue[]>(`/books/issues/list${LIST_LIMIT}`);
    setIssues(docs.map(issueFromApi));
  }, []);

  const refreshHistory = useCallback(async () => {
    const docs = await api.get<ApiStockHistory[]>(`/books/history/list${LIST_LIMIT}`);
    setHistory(docs.map(historyFromApi));
  }, []);

  // Waits for AuthContext to settle first — see AcademicContext.tsx's
  // comment for why an un-gated fetch here races the session restore and
  // can even log a just-restored Student/Staff Portal session back out.
  useEffect(() => {
    if (initializing) return;
    if (!user) { setLoading(false); return; }
    Promise.all([refreshBooks(), refreshBranchStock(), refreshIssues(), refreshHistory()])
      .catch(() => { /* offline */ })
      .finally(() => setLoading(false));
  }, [initializing, user, refreshBooks, refreshBranchStock, refreshIssues, refreshHistory]);

  const addBook = useCallback(async (data: Omit<Book, "id" | "bookCode">): Promise<Book> => {
    const created = bookFromApi(await api.post<ApiBook>("/books", data));
    setBooks((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateBook = useCallback(async (id: string, data: Partial<Book>): Promise<Book> => {
    const updated = bookFromApi(await api.patch<ApiBook>(`/books/${id}`, data));
    setBooks((prev) => prev.map((b) => (b.id === id ? updated : b)));
    return updated;
  }, []);

  const deleteBook = useCallback(async (id: string) => {
    await api.del(`/books/${id}`);
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const addStock = useCallback(async (bookId: string, qty: number, note?: string) => {
    const updated = bookFromApi(await api.post<ApiBook>(`/books/${bookId}/stock`, { action: "add", quantity: qty, note }));
    setBooks((prev) => prev.map((b) => (b.id === bookId ? updated : b)));
    await refreshHistory();
  }, [refreshHistory]);

  const reduceStock = useCallback(async (bookId: string, qty: number, note?: string) => {
    const updated = bookFromApi(await api.post<ApiBook>(`/books/${bookId}/stock`, { action: "reduce", quantity: qty, note }));
    setBooks((prev) => prev.map((b) => (b.id === bookId ? updated : b)));
    await refreshHistory();
  }, [refreshHistory]);

  const transferMultipleToBranch = useCallback(async (
    branchId: string,
    items: { bookId: string; quantity: number }[],
  ): Promise<{ ok: boolean; failed?: string[] }> => {
    const res = await api.post<{ ok: boolean; failed?: string[] }>("/books/branch-stock/transfer", { branchId, items });
    await Promise.all([refreshBooks(), refreshBranchStock(), refreshHistory()]);
    return res;
  }, [refreshBooks, refreshBranchStock, refreshHistory]);

  const issueMultipleToStudent = useCallback(async (params: {
    studentId: string;
    studentName: string;
    issueDate: string;
    items: { bookId: string; quantity: number }[];
  }): Promise<{ ok: boolean; failed?: string[] }> => {
    const res = await api.post<{ ok: boolean; failed?: string[] }>("/books/issues", {
      studentId: params.studentId,
      issueDate: params.issueDate,
      items: params.items,
    });
    await Promise.all([refreshBooks(), refreshIssues(), refreshHistory()]);
    return res;
  }, [refreshBooks, refreshIssues, refreshHistory]);

  const returnFromStudent = useCallback(async (issueId: string, qty: number): Promise<boolean> => {
    try {
      await api.post(`/books/issues/${issueId}/return`, { quantity: qty });
      await Promise.all([refreshBooks(), refreshIssues(), refreshHistory()]);
      return true;
    } catch {
      return false;
    }
  }, [refreshBooks, refreshIssues, refreshHistory]);

  const getStudentIssues = useCallback(
    (studentId: string) => issues.filter((i) => i.studentId === studentId),
    [issues],
  );

  const value = useMemo(
    () => ({
      books, branchStock, issues, history, loading,
      addBook, updateBook, deleteBook,
      addStock, reduceStock,
      transferMultipleToBranch,
      issueMultipleToStudent,
      returnFromStudent,
      getStudentIssues,
      refreshBooks, refreshBranchStock, refreshIssues, refreshHistory,
    }),
    [books, branchStock, issues, history, loading,
      addBook, updateBook, deleteBook, addStock, reduceStock,
      transferMultipleToBranch, issueMultipleToStudent, returnFromStudent, getStudentIssues,
      refreshBooks, refreshBranchStock, refreshIssues, refreshHistory],
  );

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}

export function useBooks() {
  const ctx = useContext(BookContext);
  if (!ctx) throw new Error("useBooks must be within BookProvider");
  return ctx;
}
