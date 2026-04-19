import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import {
  IncomeEntry,
  ExpenseEntry,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  ACCOUNT_BRANCHES,
} from "@/types/accounts";

interface AccountsContextType {
  incomes: IncomeEntry[];
  expenses: ExpenseEntry[];
  incomeCategories: string[];
  expenseCategories: string[];

  addIncome: (data: Omit<IncomeEntry, "id">) => IncomeEntry;
  addAutoIncome: (data: Omit<IncomeEntry, "id">) => IncomeEntry | null;
  updateIncome: (id: string, data: Partial<IncomeEntry>) => void;
  deleteIncome: (id: string) => void;

  addExpense: (data: Omit<ExpenseEntry, "id">) => ExpenseEntry;
  updateExpense: (id: string, data: Partial<ExpenseEntry>) => void;
  deleteExpense: (id: string) => void;

  addIncomeCategory: (name: string) => void;
  removeIncomeCategory: (name: string) => void;
  addExpenseCategory: (name: string) => void;
  removeExpenseCategory: (name: string) => void;
}

const AccountsContext = createContext<AccountsContextType | null>(null);

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>(DEFAULT_INCOME_CATEGORIES);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES);

  const addIncome = useCallback((data: Omit<IncomeEntry, "id">): IncomeEntry => {
    const entry: IncomeEntry = { ...data, id: `inc${Date.now()}${Math.random().toString(36).slice(2, 6)}` };
    setIncomes((prev) => [entry, ...prev]);
    return entry;
  }, []);

  const addAutoIncome = useCallback((data: Omit<IncomeEntry, "id">): IncomeEntry | null => {
    // Dedupe by source+refId
    let created: IncomeEntry | null = null;
    setIncomes((prev) => {
      if (data.refId && prev.some((p) => p.source === data.source && p.refId === data.refId)) {
        return prev;
      }
      created = { ...data, id: `inc${Date.now()}${Math.random().toString(36).slice(2, 6)}` };
      return [created, ...prev];
    });
    return created;
  }, []);

  const updateIncome = useCallback((id: string, data: Partial<IncomeEntry>) => {
    setIncomes((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)));
  }, []);

  const deleteIncome = useCallback((id: string) => {
    setIncomes((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const addExpense = useCallback((data: Omit<ExpenseEntry, "id">): ExpenseEntry => {
    const entry: ExpenseEntry = { ...data, id: `exp${Date.now()}${Math.random().toString(36).slice(2, 6)}` };
    setExpenses((prev) => [entry, ...prev]);
    return entry;
  }, []);

  const updateExpense = useCallback((id: string, data: Partial<ExpenseEntry>) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addIncomeCategory = useCallback((name: string) => {
    setIncomeCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);
  const removeIncomeCategory = useCallback((name: string) => {
    setIncomeCategories((prev) => prev.filter((c) => c !== name));
  }, []);
  const addExpenseCategory = useCallback((name: string) => {
    setExpenseCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);
  const removeExpenseCategory = useCallback((name: string) => {
    setExpenseCategories((prev) => prev.filter((c) => c !== name));
  }, []);

  const value = useMemo(
    () => ({
      incomes,
      expenses,
      incomeCategories,
      expenseCategories,
      addIncome,
      addAutoIncome,
      updateIncome,
      deleteIncome,
      addExpense,
      updateExpense,
      deleteExpense,
      addIncomeCategory,
      removeIncomeCategory,
      addExpenseCategory,
      removeExpenseCategory,
    }),
    [
      incomes,
      expenses,
      incomeCategories,
      expenseCategories,
      addIncome,
      addAutoIncome,
      updateIncome,
      deleteIncome,
      addExpense,
      updateExpense,
      deleteExpense,
      addIncomeCategory,
      removeIncomeCategory,
      addExpenseCategory,
      removeExpenseCategory,
    ]
  );

  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>;
}

export function useAccounts() {
  const ctx = useContext(AccountsContext);
  if (!ctx) throw new Error("useAccounts must be within AccountsProvider");
  return ctx;
}

export { ACCOUNT_BRANCHES };
