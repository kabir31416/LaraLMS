import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Payment } from "@/types/student";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Payments are now backed by the real API (Phase 3, Modules 15-17). Receipt
 * numbers are generated server-side (idGenerators.ts) and a payment updates
 * the student's paid/due there too — this context just mirrors the result,
 * it never computes fee totals itself.
 */
interface ApiPayment {
  _id: string;
  receiptNo: string;
  studentId: string;
  date: string;
  amount: number;
  discount: number;
  fine: number;
  paidAmount: number;
  method: string;
  feeType: Payment["feeType"];
  month?: string;
  note?: string;
}

function fromApi(doc: ApiPayment): Payment {
  return {
    id: doc._id,
    receiptNo: doc.receiptNo,
    studentId: doc.studentId,
    date: doc.date,
    amount: doc.amount,
    discount: doc.discount,
    fine: doc.fine,
    paidAmount: doc.paidAmount,
    method: doc.method,
    feeType: doc.feeType,
    month: doc.month,
    note: doc.note,
  };
}

interface PaymentContextType {
  payments: Payment[];
  loading: boolean;
  getPayments: (studentId: string) => Payment[];
  addPayment: (payment: Omit<Payment, "id" | "receiptNo">) => Promise<Payment>;
  refreshPayments: () => Promise<void>;
}

const PaymentContext = createContext<PaymentContextType | null>(null);

const LIST_LIMIT = "?limit=100&sortBy=date&sortOrder=desc";

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const { initializing, user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPayments = useCallback(async () => {
    const docs = await api.get<ApiPayment[]>(`/payments${LIST_LIMIT}`);
    setPayments(docs.map(fromApi));
  }, []);

  // Waits for AuthContext to settle first — see AcademicContext.tsx's
  // comment for why an un-gated fetch here races the session restore and
  // can even log a just-restored Student/Staff Portal session back out.
  useEffect(() => {
    if (initializing) return;
    if (!user) { setLoading(false); return; }
    // A Batch Director holds neither payments:read nor payments:read:own by
    // default, so this 403s for them — silently ignored, same as offline.
    refreshPayments().catch(() => {}).finally(() => setLoading(false));
  }, [initializing, user, refreshPayments]);

  const getPayments = useCallback((studentId: string) => payments.filter((p) => p.studentId === studentId), [payments]);

  const addPayment = useCallback(async (payment: Omit<Payment, "id" | "receiptNo">): Promise<Payment> => {
    const created = fromApi(
      await api.post<ApiPayment>("/payments", {
        studentId: payment.studentId,
        date: payment.date,
        amount: payment.amount,
        discount: payment.discount,
        fine: payment.fine,
        method: payment.method,
        feeType: payment.feeType,
        month: payment.month,
        note: payment.note,
      }),
    );
    setPayments((prev) => [created, ...prev]);
    return created;
  }, []);

  const value = useMemo(
    () => ({ payments, loading, getPayments, addPayment, refreshPayments }),
    [payments, loading, getPayments, addPayment, refreshPayments],
  );

  return <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>;
}

export function usePayments() {
  const ctx = useContext(PaymentContext);
  if (!ctx) throw new Error("usePayments must be within PaymentProvider");
  return ctx;
}
