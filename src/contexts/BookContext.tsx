import React, { createContext, useContext, useState, useCallback } from "react";
import {
  Book,
  Branch,
  BranchStock,
  StudentBookIssue,
  StockHistoryEntry,
  DEMO_BOOKS,
  DEMO_BRANCHES,
  generateBookCode,
} from "@/types/book";

interface BookContextType {
  books: Book[];
  branches: Branch[];
  branchStock: BranchStock[];
  issues: StudentBookIssue[];
  history: StockHistoryEntry[];

  addBook: (data: Omit<Book, "id" | "bookCode">) => void;
  updateBook: (id: string, data: Partial<Book>) => void;
  deleteBook: (id: string) => void;

  addStock: (bookId: string, qty: number, note?: string) => void;
  reduceStock: (bookId: string, qty: number, note?: string) => void;

  transferToBranch: (bookId: string, branchId: string, qty: number) => boolean;
  transferMultipleToBranch: (
    branchId: string,
    items: { bookId: string; quantity: number }[]
  ) => { ok: boolean; failed?: string[] };

  issueToStudent: (params: {
    studentId: string;
    studentName: string;
    branchId: string;
    bookId: string;
    quantity: number;
    issueDate: string;
  }) => boolean;

  issueMultipleToStudent: (params: {
    studentId: string;
    studentName: string;
    issueDate: string;
    items: { bookId: string; quantity: number }[];
  }) => { ok: boolean; failed?: string[] };

  returnFromStudent: (issueId: string, qty: number) => boolean;

  getBranchStock: (branchId: string, bookId: string) => number;
  getStudentIssues: (studentId: string) => StudentBookIssue[];
}

const BookContext = createContext<BookContextType | null>(null);

export function BookProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>(DEMO_BOOKS);
  const [branches] = useState<Branch[]>(DEMO_BRANCHES);
  const [branchStock, setBranchStock] = useState<BranchStock[]>([]);
  const [issues, setIssues] = useState<StudentBookIssue[]>([]);
  const [history, setHistory] = useState<StockHistoryEntry[]>([]);

  const pushHistory = useCallback((entry: Omit<StockHistoryEntry, "id" | "date">) => {
    setHistory((prev) => [
      { ...entry, id: `h${Date.now()}${Math.random()}`, date: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  const findBook = useCallback((id: string) => books.find((b) => b.id === id), [books]);
  const findBranch = useCallback((id: string) => branches.find((b) => b.id === id), [branches]);

  const addBook = useCallback((data: Omit<Book, "id" | "bookCode">) => {
    const newBook: Book = { ...data, id: `bk${Date.now()}`, bookCode: generateBookCode() };
    setBooks((prev) => [newBook, ...prev]);
  }, []);

  const updateBook = useCallback((id: string, data: Partial<Book>) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, ...data } : b)));
  }, []);

  const deleteBook = useCallback((id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const addStock = useCallback((bookId: string, qty: number, note?: string) => {
    setBooks((prev) => prev.map((b) => (b.id === bookId ? { ...b, totalStock: b.totalStock + qty } : b)));
    const book = books.find((b) => b.id === bookId);
    if (book) pushHistory({ action: "স্টক যোগ", bookId, bookName: book.name, quantity: qty, note });
  }, [books, pushHistory]);

  const reduceStock = useCallback((bookId: string, qty: number, note?: string) => {
    setBooks((prev) => prev.map((b) => (b.id === bookId ? { ...b, totalStock: Math.max(0, b.totalStock - qty) } : b)));
    const book = books.find((b) => b.id === bookId);
    if (book) pushHistory({ action: "স্টক কমানো", bookId, bookName: book.name, quantity: qty, note });
  }, [books, pushHistory]);

  const transferToBranch = useCallback((bookId: string, branchId: string, qty: number) => {
    const book = findBook(bookId);
    const branch = findBranch(branchId);
    if (!book || !branch || book.totalStock < qty) return false;

    setBooks((prev) => prev.map((b) => (b.id === bookId ? { ...b, totalStock: b.totalStock - qty } : b)));
    setBranchStock((prev) => {
      const existing = prev.find((bs) => bs.branchId === branchId && bs.bookId === bookId);
      if (existing) {
        return prev.map((bs) =>
          bs.branchId === branchId && bs.bookId === bookId ? { ...bs, quantity: bs.quantity + qty } : bs
        );
      }
      return [...prev, { branchId, bookId, quantity: qty }];
    });
    pushHistory({
      action: "ব্রাঞ্চে স্থানান্তর",
      bookId,
      bookName: book.name,
      branchId,
      branchName: branch.name,
      quantity: qty,
    });
    return true;
  }, [findBook, findBranch, pushHistory]);

  const getBranchStock = useCallback(
    (branchId: string, bookId: string) =>
      branchStock.find((bs) => bs.branchId === branchId && bs.bookId === bookId)?.quantity ?? 0,
    [branchStock]
  );

  const issueToStudent = useCallback((params: {
    studentId: string;
    studentName: string;
    branchId: string;
    bookId: string;
    quantity: number;
    issueDate: string;
  }) => {
    const available = branchStock.find(
      (bs) => bs.branchId === params.branchId && bs.bookId === params.bookId
    );
    if (!available || available.quantity < params.quantity) return false;
    const book = findBook(params.bookId);
    const branch = findBranch(params.branchId);
    if (!book || !branch) return false;

    setBranchStock((prev) =>
      prev.map((bs) =>
        bs.branchId === params.branchId && bs.bookId === params.bookId
          ? { ...bs, quantity: bs.quantity - params.quantity }
          : bs
      )
    );

    const newIssue: StudentBookIssue = {
      id: `iss${Date.now()}${Math.random()}`,
      studentId: params.studentId,
      branchId: params.branchId,
      bookId: params.bookId,
      quantity: params.quantity,
      issueDate: params.issueDate,
      returnedQuantity: 0,
      status: "ইস্যু",
    };
    setIssues((prev) => [newIssue, ...prev]);
    pushHistory({
      action: "শিক্ষার্থীকে বিতরণ",
      bookId: params.bookId,
      bookName: book.name,
      branchId: params.branchId,
      branchName: branch.name,
      studentId: params.studentId,
      studentName: params.studentName,
      quantity: params.quantity,
    });
    return true;
  }, [branchStock, findBook, findBranch, pushHistory]);

  const returnFromStudent = useCallback((issueId: string, qty: number) => {
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return false;
    const remaining = issue.quantity - issue.returnedQuantity;
    if (qty <= 0 || qty > remaining) return false;
    const book = findBook(issue.bookId);
    const branch = findBranch(issue.branchId);
    if (!book || !branch) return false;

    setIssues((prev) =>
      prev.map((i) => {
        if (i.id !== issueId) return i;
        const newReturned = i.returnedQuantity + qty;
        const status = newReturned >= i.quantity ? "ফেরত" : "আংশিক ফেরত";
        return { ...i, returnedQuantity: newReturned, status };
      })
    );

    setBranchStock((prev) => {
      const existing = prev.find((bs) => bs.branchId === issue.branchId && bs.bookId === issue.bookId);
      if (existing) {
        return prev.map((bs) =>
          bs.branchId === issue.branchId && bs.bookId === issue.bookId
            ? { ...bs, quantity: bs.quantity + qty }
            : bs
        );
      }
      return [...prev, { branchId: issue.branchId, bookId: issue.bookId, quantity: qty }];
    });

    pushHistory({
      action: "শিক্ষার্থী থেকে ফেরত",
      bookId: issue.bookId,
      bookName: book.name,
      branchId: issue.branchId,
      branchName: branch.name,
      studentId: issue.studentId,
      quantity: qty,
    });
    return true;
  }, [issues, findBook, findBranch, pushHistory]);

  const getStudentIssues = useCallback(
    (studentId: string) => issues.filter((i) => i.studentId === studentId),
    [issues]
  );

  return (
    <BookContext.Provider
      value={{
        books,
        branches,
        branchStock,
        issues,
        history,
        addBook,
        updateBook,
        deleteBook,
        addStock,
        reduceStock,
        transferToBranch,
        issueToStudent,
        returnFromStudent,
        getBranchStock,
        getStudentIssues,
      }}
    >
      {children}
    </BookContext.Provider>
  );
}

export function useBooks() {
  const ctx = useContext(BookContext);
  if (!ctx) throw new Error("useBooks must be within BookProvider");
  return ctx;
}
