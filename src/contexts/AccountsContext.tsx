import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { IncomeEntry, ExpenseEntry, PaymentMethod, TransactionSource } from "@/types/accounts";
import { useBranches } from "@/contexts/BranchContext";
import { api } from "@/lib/apiClient";

/**
 * Income/Expense/Categories are now backed by the real API (Phase 3, Module
 * 24). There's no more client-side AccountsAutoBridge — a payment is
 * mirrored into the ledger server-side, at the moment it's created
 * (payment.service.ts), not by a component watching the payments array.
 */
interface ApiIncomeEntry {
  _id: string;
  date: string;
  category: string;
  amount: number;
  branchId: string;
  method: PaymentMethod;
  studentId?: string;
  studentName?: string;
  note?: string;
  source: TransactionSource;
  refId?: string;
}

interface ApiExpenseEntry {
  _id: string;
  date: string;
  category: string;
  amount: number;
  branchId: string;
  method: PaymentMethod;
  note?: string;
}

interface AccountsContextType {
  incomes: IncomeEntry[];
  expenses: ExpenseEntry[];
  incomeCategories: string[];
  expenseCategories: string[];
  loading: boolean;

  addIncome: (data: Omit<IncomeEntry, "id" | "branchName">) => Promise<IncomeEntry>;
  updateIncome: (id: string, data: Partial<IncomeEntry>) => Promise<IncomeEntry>;
  deleteIncome: (id: string) => Promise<void>;

  addExpense: (data: Omit<ExpenseEntry, "id" | "branchName">) => Promise<ExpenseEntry>;
  updateExpense: (id: string, data: Partial<ExpenseEntry>) => Promise<ExpenseEntry>;
  deleteExpense: (id: string) => Promise<void>;

  addIncomeCategory: (name: string) => Promise<void>;
  removeIncomeCategory: (name: string) => Promise<void>;
  addExpenseCategory: (name: string) => Promise<void>;
  removeExpenseCategory: (name: string) => Promise<void>;
}

const AccountsContext = createContext<AccountsContextType | null>(null);

const LIST_LIMIT = "?limit=100";

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const { branches } = useBranches();
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const branchNameById = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  const incomeFromApi = useCallback((doc: ApiIncomeEntry): IncomeEntry => ({
    id: doc._id, date: doc.date, category: doc.category, amount: doc.amount,
    branchId: doc.branchId, branchName: branchNameById.get(doc.branchId) || "",
    method: doc.method, studentId: doc.studentId, studentName: doc.studentName,
    note: doc.note, source: doc.source, refId: doc.refId,
  }), [branchNameById]);

  const expenseFromApi = useCallback((doc: ApiExpenseEntry): ExpenseEntry => ({
    id: doc._id, date: doc.date, category: doc.category, amount: doc.amount,
    branchId: doc.branchId, branchName: branchNameById.get(doc.branchId) || "",
    method: doc.method, note: doc.note,
  }), [branchNameById]);

  const refreshIncomes = useCallback(async () => {
    const docs = await api.get<ApiIncomeEntry[]>(`/accounts/income${LIST_LIMIT}`);
    setIncomes(docs.map(incomeFromApi));
  }, [incomeFromApi]);

  const refreshExpenses = useCallback(async () => {
    const docs = await api.get<ApiExpenseEntry[]>(`/accounts/expense${LIST_LIMIT}`);
    setExpenses(docs.map(expenseFromApi));
  }, [expenseFromApi]);

  const refreshCategories = useCallback(async () => {
    const doc = await api.get<{ incomeCategories: string[]; expenseCategories: string[] }>("/accounts/categories");
    setIncomeCategories(doc.incomeCategories);
    setExpenseCategories(doc.expenseCategories);
  }, []);

  useEffect(() => {
    Promise.all([refreshIncomes(), refreshExpenses(), refreshCategories()])
      .catch(() => { /* not logged in yet, offline, or not an admin */ })
      .finally(() => setLoading(false));
    // Re-fetch once branches load so branchName can be resolved on entries fetched before they arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches.length]);

  const addIncome = useCallback(async (data: Omit<IncomeEntry, "id" | "branchName">): Promise<IncomeEntry> => {
    const created = incomeFromApi(await api.post<ApiIncomeEntry>("/accounts/income", data));
    setIncomes((prev) => [created, ...prev]);
    return created;
  }, [incomeFromApi]);

  const updateIncome = useCallback(async (id: string, data: Partial<IncomeEntry>): Promise<IncomeEntry> => {
    const updated = incomeFromApi(await api.patch<ApiIncomeEntry>(`/accounts/income/${id}`, data));
    setIncomes((prev) => prev.map((i) => (i.id === id ? updated : i)));
    return updated;
  }, [incomeFromApi]);

  const deleteIncome = useCallback(async (id: string) => {
    await api.del(`/accounts/income/${id}`);
    setIncomes((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const addExpense = useCallback(async (data: Omit<ExpenseEntry, "id" | "branchName">): Promise<ExpenseEntry> => {
    const created = expenseFromApi(await api.post<ApiExpenseEntry>("/accounts/expense", data));
    setExpenses((prev) => [created, ...prev]);
    return created;
  }, [expenseFromApi]);

  const updateExpense = useCallback(async (id: string, data: Partial<ExpenseEntry>): Promise<ExpenseEntry> => {
    const updated = expenseFromApi(await api.patch<ApiExpenseEntry>(`/accounts/expense/${id}`, data));
    setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, [expenseFromApi]);

  const deleteExpense = useCallback(async (id: string) => {
    await api.del(`/accounts/expense/${id}`);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addIncomeCategory = useCallback(async (name: string) => {
    const next = incomeCategories.includes(name) ? incomeCategories : [...incomeCategories, name];
    const doc = await api.patch<{ incomeCategories: string[] }>("/accounts/categories", { incomeCategories: next });
    setIncomeCategories(doc.incomeCategories);
  }, [incomeCategories]);

  const removeIncomeCategory = useCallback(async (name: string) => {
    const next = incomeCategories.filter((c) => c !== name);
    const doc = await api.patch<{ incomeCategories: string[] }>("/accounts/categories", { incomeCategories: next });
    setIncomeCategories(doc.incomeCategories);
  }, [incomeCategories]);

  const addExpenseCategory = useCallback(async (name: string) => {
    const next = expenseCategories.includes(name) ? expenseCategories : [...expenseCategories, name];
    const doc = await api.patch<{ expenseCategories: string[] }>("/accounts/categories", { expenseCategories: next });
    setExpenseCategories(doc.expenseCategories);
  }, [expenseCategories]);

  const removeExpenseCategory = useCallback(async (name: string) => {
    const next = expenseCategories.filter((c) => c !== name);
    const doc = await api.patch<{ expenseCategories: string[] }>("/accounts/categories", { expenseCategories: next });
    setExpenseCategories(doc.expenseCategories);
  }, [expenseCategories]);

  const value = useMemo(
    () => ({
      incomes, expenses, incomeCategories, expenseCategories, loading,
      addIncome, updateIncome, deleteIncome,
      addExpense, updateExpense, deleteExpense,
      addIncomeCategory, removeIncomeCategory, addExpenseCategory, removeExpenseCategory,
    }),
    [incomes, expenses, incomeCategories, expenseCategories, loading,
      addIncome, updateIncome, deleteIncome, addExpense, updateExpense, deleteExpense,
      addIncomeCategory, removeIncomeCategory, addExpenseCategory, removeExpenseCategory],
  );

  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>;
}

export function useAccounts() {
  const ctx = useContext(AccountsContext);
  if (!ctx) throw new Error("useAccounts must be within AccountsProvider");
  return ctx;
}
