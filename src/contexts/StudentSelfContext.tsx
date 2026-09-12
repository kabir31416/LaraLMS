import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Student, ProfileCompletion } from "@/types/student";
import type { WeekDay } from "@/types/batch";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * A logged-in Student holds neither STUDENTS_READ, BATCHES_READ_OWN, nor
 * STAFF_MANAGE, so it can't resolve its own record via the admin/director
 * list contexts (StudentContext/BatchContext/StaffContext) the way those
 * roles do — those requests 403 and their arrays stay empty (Phase 3,
 * Module 27). `GET /students/me` is the one call a Student is authorized
 * to make, and the server denormalizes batch/director onto it so this is
 * the only fetch the whole Student Portal needs.
 */
export interface SelfBatch {
  id: string;
  name: string;
  batchTime: string;
  roomNumber?: string;
  days: WeekDay[];
}

export interface SelfDirector {
  id: string;
  name: string;
}

interface ApiMyProfile {
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
  batch: SelfBatch | null;
  director: SelfDirector | null;
}

function studentFromApi(doc: ApiMyProfile): Student {
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

interface StudentSelfContextType {
  student: Student | undefined;
  batch: SelfBatch | undefined;
  director: SelfDirector | undefined;
  loading: boolean;
  refresh: () => Promise<void>;
}

const StudentSelfContext = createContext<StudentSelfContextType | null>(null);

export function StudentSelfProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | undefined>(undefined);
  const [batch, setBatch] = useState<SelfBatch | undefined>(undefined);
  const [director, setDirector] = useState<SelfDirector | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const doc = await api.get<ApiMyProfile>("/students/me");
    setStudent(studentFromApi(doc));
    setBatch(doc.batch ?? undefined);
    setDirector(doc.director ?? undefined);
  }, []);

  useEffect(() => {
    if (!user?.studentId) {
      setLoading(false);
      return;
    }
    refresh().catch(() => { /* not a student session, or offline */ }).finally(() => setLoading(false));
  }, [user?.studentId, refresh]);

  const value = useMemo(() => ({ student, batch, director, loading, refresh }), [student, batch, director, loading, refresh]);

  return <StudentSelfContext.Provider value={value}>{children}</StudentSelfContext.Provider>;
}

export function useStudentSelfContext() {
  const ctx = useContext(StudentSelfContext);
  if (!ctx) throw new Error("useStudentSelfContext must be within StudentSelfProvider");
  return ctx;
}
