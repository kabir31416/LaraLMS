import { useEffect, useRef } from "react";
import { useAccounts } from "@/contexts/AccountsContext";
import { useStudents } from "@/contexts/StudentContext";
import { ACCOUNT_BRANCHES } from "@/types/accounts";
import type { PaymentMethod } from "@/types/accounts";

// Bridges student payments → income entries (auto)
export function AccountsAutoBridge() {
  const { payments, students } = useStudents();
  const { addAutoIncome } = useAccounts();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    payments.forEach((p) => {
      if (seenRef.current.has(p.id)) return;
      seenRef.current.add(p.id);
      const student = students.find((s) => s.id === p.studentId);
      const isAdmission = (p.note || "").includes("ভর্তি") || p.feeType === "এককালীন";
      addAutoIncome({
        date: p.date,
        category: isAdmission ? "ভর্তি ফি" : "কোর্স ফি",
        amount: p.paidAmount,
        branchId: ACCOUNT_BRANCHES[0].id,
        branchName: ACCOUNT_BRANCHES[0].name,
        method: (p.method as PaymentMethod) || "নগদ",
        studentId: student?.id,
        studentName: student?.name,
        note: `রসিদ: ${p.receiptNo}${p.month ? ` (${p.month})` : ""}`,
        source: isAdmission ? "admission_fee" : "student_fee",
        refId: p.id,
      });
    });
  }, [payments, students, addAutoIncome]);

  return null;
}
