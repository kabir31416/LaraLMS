import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { Student, ProfileCompletion } from "@/types/student";
import { mockPayments, mockAttendance, mockResults, generateReceiptNo } from "@/data/students";
import type { Payment, AttendanceRecord, ExamResult } from "@/types/student";
import { api } from "@/lib/apiClient";

/**
 * Students are now backed by the real API (Phase 3, Modules 10-12).
 * Payments/Attendance/Results stay on the old mock data until their own
 * modules (15-20) exist — this is the same phased approach already used for
 * Academic's classExams/videos.
 *
 * Field names are translated at this boundary (phone <-> mobile, photoUrl <->
 * photo, registrationId <-> studentId, currentRollNumber <-> rollNumber,
 * currentBatchId <-> batchId) so every existing page keeps reading the same
 * property names it always has.
 */
interface ApiStudent {
  _id: string;
  registrationId: string;
  currentRollNumber?: string;
  currentBatchId?: string;
  name: string;
  photoUrl?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  dob?: string;
  gender?: Student["gender"];
  institution?: string;
  class?: string;
  address?: string;
  course?: string;
  section?: string;
  group?: string;
  subjects: string[];
  admissionDate: string;
  admissionType: Student["admissionType"];
  feeType: Student["feeType"];
  courseDuration: number;
  totalCourseFee: number;
  admissionFee: number;
  monthlyFee: number;
  discount: number;
  totalFee: number;
  paid: number;
  due: number;
  status: Student["status"];
  profileCompletion?: ProfileCompletion;
  guardianName?: string;
  guardianRelation?: string;
  guardianMobile?: string;
}

function fromApi(doc: ApiStudent): Student {
  return {
    id: doc._id,
    studentId: doc.registrationId,
    rollNumber: doc.currentRollNumber,
    batchId: doc.currentBatchId,
    name: doc.name,
    photo: doc.photoUrl,
    mobile: doc.phone,
    altMobile: doc.altPhone,
    email: doc.email,
    dob: doc.dob,
    gender: doc.gender,
    institution: doc.institution,
    class: doc.class,
    address: doc.address,
    course: doc.course,
    section: doc.section,
    group: doc.group,
    subjects: doc.subjects || [],
    admissionDate: doc.admissionDate,
    admissionType: doc.admissionType,
    feeType: doc.feeType,
    courseDuration: doc.courseDuration,
    totalCourseFee: doc.totalCourseFee,
    admissionFee: doc.admissionFee,
    monthlyFee: doc.monthlyFee,
    discount: doc.discount,
    totalFee: doc.totalFee,
    paid: doc.paid,
    due: doc.due,
    status: doc.status,
    profileCompletion: doc.profileCompletion,
    guardianName: doc.guardianName,
    guardianRelation: doc.guardianRelation,
    guardianMobile: doc.guardianMobile,
  };
}

/** The reverse of fromApi, for the subset of fields a form actually sends. */
function toApiBody(data: Partial<Student> & { rollNumber?: string }): Record<string, unknown> {
  const body: Record<string, unknown> = { ...data };
  if ("mobile" in data) { body.phone = data.mobile; delete body.mobile; }
  if ("altMobile" in data) { body.altPhone = data.altMobile; delete body.altMobile; }
  if ("photo" in data) { body.photoUrl = data.photo; delete body.photo; }
  delete body.id;
  delete body.studentId; // registrationId is immutable
  delete body.batchId; // only the enrollment endpoints may change this
  delete body.totalFee; // server-computed
  delete body.due; // server-computed
  delete body.profileCompletion; // server-computed
  return body;
}

interface StudentContextType {
  students: Student[];
  payments: Payment[];
  loading: boolean;
  addStudent: (student: Omit<Student, "id" | "studentId" | "status">) => Promise<Student>;
  addStudentQuick: (data: { rollNumber: string; name: string; mobile: string }) => Promise<Student>;
  updateStudent: (id: string, data: Partial<Student>) => Promise<Student>;
  updateRoll: (id: string, rollNumber: string) => Promise<Student>;
  deleteStudent: (id: string) => Promise<void>;
  getStudent: (id: string) => Student | undefined;
  getPayments: (studentId: string) => Payment[];
  addPayment: (payment: Omit<Payment, "id" | "receiptNo">) => Payment;
  getAttendance: (studentId: string) => AttendanceRecord[];
  getResults: (studentId: string) => ExamResult[];
  // Batch enrollment — Phase 1 §14
  enrollStudent: (studentId: string, batchId: string) => Promise<void>;
  transferStudent: (studentId: string, toBatchId: string, reason: string, newRollNumber?: string) => Promise<void>;
  withdrawStudent: (studentId: string, reason?: string) => Promise<void>;
  refreshStudents: () => Promise<void>;
}

const StudentContext = createContext<StudentContextType | null>(null);

const LIST_LIMIT = "?limit=100";

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>(mockPayments);
  const [loading, setLoading] = useState(true);

  const refreshStudents = useCallback(async () => {
    const docs = await api.get<ApiStudent[]>(`/students${LIST_LIMIT}`);
    setStudents(docs.map(fromApi));
  }, []);

  useEffect(() => {
    refreshStudents().catch(() => { /* not logged in yet, or offline */ }).finally(() => setLoading(false));
  }, [refreshStudents]);

  const upsertLocal = useCallback((student: Student) => {
    setStudents((prev) => (prev.some((s) => s.id === student.id) ? prev.map((s) => (s.id === student.id ? student : s)) : [student, ...prev]));
  }, []);

  const addStudent = useCallback(async (data: Omit<Student, "id" | "studentId" | "status">): Promise<Student> => {
    const created = fromApi(await api.post<ApiStudent>("/students", toApiBody(data)));
    upsertLocal(created);
    return created;
  }, [upsertLocal]);

  const addStudentQuick = useCallback(async (data: { rollNumber: string; name: string; mobile: string }): Promise<Student> => {
    const created = fromApi(await api.post<ApiStudent>("/students/quick", { rollNumber: data.rollNumber, name: data.name, phone: data.mobile }));
    upsertLocal(created);
    return created;
  }, [upsertLocal]);

  const updateStudent = useCallback(async (id: string, data: Partial<Student>): Promise<Student> => {
    const updated = fromApi(await api.patch<ApiStudent>(`/students/${id}`, toApiBody(data)));
    upsertLocal(updated);
    return updated;
  }, [upsertLocal]);

  const updateRoll = useCallback(async (id: string, rollNumber: string): Promise<Student> => {
    const updated = fromApi(await api.patch<ApiStudent>(`/students/${id}/roll`, { rollNumber }));
    upsertLocal(updated);
    return updated;
  }, [upsertLocal]);

  const deleteStudent = useCallback(async (id: string) => {
    await api.del(`/students/${id}`);
    setStudents((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const getStudent = useCallback((id: string) => students.find((s) => s.id === id), [students]);

  const getPayments = useCallback((studentId: string) => payments.filter((p) => p.studentId === studentId), [payments]);

  const addPayment = useCallback((payment: Omit<Payment, "id" | "receiptNo">): Payment => {
    const newPayment: Payment = { ...payment, id: `p${Date.now()}`, receiptNo: generateReceiptNo() };
    setPayments((prev) => [newPayment, ...prev]);
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === payment.studentId) {
          const newPaid = s.paid + payment.paidAmount;
          return { ...s, paid: newPaid, due: s.totalFee - newPaid };
        }
        return s;
      }),
    );
    return newPayment;
  }, []);

  const getAttendance = useCallback((studentId: string) => mockAttendance[studentId] || [], []);
  const getResults = useCallback((studentId: string) => mockResults[studentId] || [], []);

  const enrollStudent = useCallback(async (studentId: string, batchId: string) => {
    await api.post(`/students/${studentId}/enroll`, { batchId });
    await refreshStudents();
  }, [refreshStudents]);

  const transferStudent = useCallback(async (studentId: string, toBatchId: string, reason: string, newRollNumber?: string) => {
    await api.post(`/students/${studentId}/transfer`, { toBatchId, reason, newRollNumber });
    await refreshStudents();
  }, [refreshStudents]);

  const withdrawStudent = useCallback(async (studentId: string, reason?: string) => {
    await api.post(`/students/${studentId}/withdraw`, { reason });
    await refreshStudents();
  }, [refreshStudents]);

  const value = useMemo(
    () => ({
      students, payments, loading,
      addStudent, addStudentQuick, updateStudent, updateRoll, deleteStudent, getStudent,
      getPayments, addPayment, getAttendance, getResults,
      enrollStudent, transferStudent, withdrawStudent, refreshStudents,
    }),
    [students, payments, loading, addStudent, addStudentQuick, updateStudent, updateRoll, deleteStudent, getStudent,
      getPayments, addPayment, getAttendance, getResults, enrollStudent, transferStudent, withdrawStudent, refreshStudents],
  );

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudents() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudents must be within StudentProvider");
  return ctx;
}
