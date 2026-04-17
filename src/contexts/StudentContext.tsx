import React, { createContext, useContext, useState, useCallback } from "react";
import { Student } from "@/types/student";
import { mockStudents, mockPayments, mockAttendance, mockResults, generateStudentId, generateReceiptNo } from "@/data/students";
import type { Payment, AttendanceRecord, ExamResult } from "@/types/student";

interface StudentContextType {
  students: Student[];
  payments: Payment[];
  addStudent: (student: Omit<Student, "id" | "studentId" | "status">) => void;
  updateStudent: (id: string, data: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  getStudent: (id: string) => Student | undefined;
  getPayments: (studentId: string) => Payment[];
  addPayment: (payment: Omit<Payment, "id" | "receiptNo">) => Payment;
  getAttendance: (studentId: string) => AttendanceRecord[];
  getResults: (studentId: string) => ExamResult[];
}

const StudentContext = createContext<StudentContextType | null>(null);

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [payments, setPayments] = useState<Payment[]>(mockPayments);

  const addStudent = useCallback((data: Omit<Student, "id" | "studentId" | "status">) => {
    const newStudent: Student = {
      ...data,
      id: String(Date.now()),
      studentId: generateStudentId(),
      status: "সক্রিয়",
    };
    setStudents((prev) => [newStudent, ...prev]);
  }, []);

  const updateStudent = useCallback((id: string, data: Partial<Student>) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
  }, []);

  const deleteStudent = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const getStudent = useCallback(
    (id: string) => students.find((s) => s.id === id),
    [students]
  );

  const getPayments = useCallback(
    (studentId: string) => payments.filter((p) => p.studentId === studentId),
    [payments]
  );

  const addPayment = useCallback((payment: Omit<Payment, "id" | "receiptNo">): Payment => {
    const newPayment: Payment = {
      ...payment,
      id: `p${Date.now()}`,
      receiptNo: generateReceiptNo(),
    };
    setPayments((prev) => [newPayment, ...prev]);
    // Update student paid/due
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === payment.studentId) {
          const newPaid = s.paid + payment.paidAmount;
          return { ...s, paid: newPaid, due: s.totalFee - newPaid };
        }
        return s;
      })
    );
    return newPayment;
  }, []);

  const getAttendance = useCallback(
    (studentId: string) => mockAttendance[studentId] || [],
    []
  );

  const getResults = useCallback(
    (studentId: string) => mockResults[studentId] || [],
    []
  );

  return (
    <StudentContext.Provider
      value={{ students, payments, addStudent, updateStudent, deleteStudent, getStudent, getPayments, addPayment, getAttendance, getResults }}
    >
      {children}
    </StudentContext.Provider>
  );
}

export function useStudents() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudents must be within StudentProvider");
  return ctx;
}
