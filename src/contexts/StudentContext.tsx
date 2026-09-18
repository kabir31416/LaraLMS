import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { Student, ProfileCompletion } from "@/types/student";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Students are now backed by the real API (Phase 3, Modules 10-12).
 * Payments moved to their own PaymentContext (Modules 15-17). Attendance/
 * Offline-Exam/Offline-Result are backed by the real API too (Modules
 * 18-20) — read them via AttendanceContext's getByStudent/getResultsByStudent
 * (see StudentAttendance.tsx/StudentResults.tsx/StudentProfile.tsx), not
 * through this context.
 *
 * Field names are translated at this boundary (phone <-> mobile, photoUrl <->
 * photo, registrationId <-> studentId, currentRollNumber <-> rollNumber,
 * currentBatchId <-> batchId) so every existing page keeps reading the same
 * property names it always has.
 */
export interface ApiStudent {
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
  bloodGroup?: string;
  religion?: string;
  fatherName?: string;
  motherName?: string;
  address?: string;
  presentAddress?: string;
  permanentAddress?: string;
  division?: string;
  district?: string;
  upazila?: string;
  postOffice?: string;
  postcode?: string;
  village?: string;
  hscInstitution?: string;
  hscBoard?: string;
  hscPassingYear?: string;
  hscGroup?: string;
  hscGpa?: string;
  hscRoll?: string;
  hscRegistrationNumber?: string;
  sscInstitution?: string;
  sscBoard?: string;
  sscPassingYear?: string;
  sscGroup?: string;
  sscGpa?: string;
  sscRoll?: string;
  sscRegistrationNumber?: string;
  courseId?: string;
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
  guardianOccupation?: string;
  guardianAddress?: string;
}

/** Exported so the Student List page (Students.tsx) can map its own server-paginated/filtered fetch through the exact same field translation, without duplicating it or routing that fetch through this context's own 100-row-capped global list. */
export function fromApi(doc: ApiStudent): Student {
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
    bloodGroup: doc.bloodGroup,
    religion: doc.religion,
    fatherName: doc.fatherName,
    motherName: doc.motherName,
    address: doc.address,
    presentAddress: doc.presentAddress,
    permanentAddress: doc.permanentAddress,
    division: doc.division,
    district: doc.district,
    upazila: doc.upazila,
    postOffice: doc.postOffice,
    postcode: doc.postcode,
    village: doc.village,
    hscInstitution: doc.hscInstitution,
    hscBoard: doc.hscBoard,
    hscPassingYear: doc.hscPassingYear,
    hscGroup: doc.hscGroup,
    hscGpa: doc.hscGpa,
    hscRoll: doc.hscRoll,
    hscRegistrationNumber: doc.hscRegistrationNumber,
    sscInstitution: doc.sscInstitution,
    sscBoard: doc.sscBoard,
    sscPassingYear: doc.sscPassingYear,
    sscGroup: doc.sscGroup,
    sscGpa: doc.sscGpa,
    sscRoll: doc.sscRoll,
    sscRegistrationNumber: doc.sscRegistrationNumber,
    courseId: doc.courseId,
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
    guardianOccupation: doc.guardianOccupation,
    guardianAddress: doc.guardianAddress,
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
  loading: boolean;
  addStudent: (student: Omit<Student, "id" | "studentId" | "status">) => Promise<Student>;
  addStudentQuick: (data: { rollNumber: string; name: string; mobile: string }) => Promise<Student>;
  updateStudent: (id: string, data: Partial<Student>) => Promise<Student>;
  updateRoll: (id: string, rollNumber: string) => Promise<Student>;
  deleteStudent: (id: string) => Promise<void>;
  getStudent: (id: string) => Student | undefined;
  // Batch enrollment — Phase 1 §14
  enrollStudent: (studentId: string, batchId: string) => Promise<void>;
  transferStudent: (studentId: string, toBatchId: string, reason: string, newRollNumber?: string) => Promise<void>;
  withdrawStudent: (studentId: string, reason?: string) => Promise<void>;
  refreshStudents: () => Promise<void>;
}

const StudentContext = createContext<StudentContextType | null>(null);

const LIST_LIMIT = "?limit=100";

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const { initializing, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshStudents = useCallback(async () => {
    const docs = await api.get<ApiStudent[]>(`/students${LIST_LIMIT}`);
    setStudents(docs.map(fromApi));
  }, []);

  // Waits for AuthContext to settle first — see AcademicContext.tsx's
  // comment for why an un-gated fetch here races the session restore and
  // can even log a just-restored Student/Staff Portal session back out.
  useEffect(() => {
    if (initializing) return;
    if (!user) { setLoading(false); return; }
    refreshStudents().catch(() => { /* offline */ }).finally(() => setLoading(false));
  }, [initializing, user, refreshStudents]);

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
      students, loading,
      addStudent, addStudentQuick, updateStudent, updateRoll, deleteStudent, getStudent,
      enrollStudent, transferStudent, withdrawStudent, refreshStudents,
    }),
    [students, loading, addStudent, addStudentQuick, updateStudent, updateRoll, deleteStudent, getStudent,
      enrollStudent, transferStudent, withdrawStudent, refreshStudents],
  );

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudents() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudents must be within StudentProvider");
  return ctx;
}
