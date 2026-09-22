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
  bloodGroup?: string;
  address?: string;
  presentAddress?: string;
  permanentAddress?: string;
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
  batch: SelfBatch | null;
  directors: SelfDirector[];
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
    bloodGroup: doc.bloodGroup,
    address: doc.address,
    presentAddress: doc.presentAddress,
    permanentAddress: doc.permanentAddress,
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

/**
 * Exactly the student-editable allow-list the backend's updateSelfSchema
 * accepts — see student.validation.ts (Phase 4). `guardianOccupation`/
 * `guardianAddress` were removed here (Guardian পেশা/ঠিকানা audit §9) — the
 * backend schema no longer accepts them on this route either, though any
 * value a student previously saved stays in the database untouched.
 */
export interface SelfEditableFields {
  photoUrl?: string;
  presentAddress?: string;
  permanentAddress?: string;
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
  guardianName?: string;
  guardianRelation?: string;
}

interface StudentSelfContextType {
  student: Student | undefined;
  batch: SelfBatch | undefined;
  directors: SelfDirector[];
  loading: boolean;
  refresh: () => Promise<void>;
  updateProfile: (patch: SelfEditableFields) => Promise<void>;
  uploadPhoto: (photo: Blob) => Promise<void>;
  removePhoto: () => Promise<void>;
}

const StudentSelfContext = createContext<StudentSelfContextType | null>(null);

export function StudentSelfProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | undefined>(undefined);
  const [batch, setBatch] = useState<SelfBatch | undefined>(undefined);
  const [directors, setDirectors] = useState<SelfDirector[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const doc = await api.get<ApiMyProfile>("/students/me");
    setStudent(studentFromApi(doc));
    setBatch(doc.batch ?? undefined);
    setDirectors(doc.directors ?? []);
  }, []);

  /**
   * PATCH /students/:id/self — the backend allow-list (updateSelfSchema) is
   * what actually enforces field-level ownership; this just calls it and
   * updates local state. The response has no batch/director (that
   * denormalization only happens on GET /students/me), so batch/director
   * stay untouched here.
   */
  const updateProfile = useCallback(async (patch: SelfEditableFields) => {
    if (!student) throw new Error("No student profile loaded yet");
    const doc = await api.patch<Omit<ApiMyProfile, "batch" | "directors">>(`/students/${student.id}/self`, patch);
    setStudent(studentFromApi({ ...doc, batch: null, directors: [] }));
  }, [student]);

  /** POST /students/me/photo — identity comes from the session token server-side, never the URL, so there's no student id to pass here at all. */
  const uploadPhoto = useCallback(async (photo: Blob) => {
    const formData = new FormData();
    formData.append("photo", photo, "photo.jpg");
    const doc = await api.postForm<Omit<ApiMyProfile, "batch" | "directors">>("/students/me/photo", formData);
    setStudent(studentFromApi({ ...doc, batch: null, directors: [] }));
  }, []);

  const removePhoto = useCallback(async () => {
    const doc = await api.del<Omit<ApiMyProfile, "batch" | "directors">>("/students/me/photo");
    setStudent(studentFromApi({ ...doc, batch: null, directors: [] }));
  }, []);

  useEffect(() => {
    if (!user?.studentId) {
      setLoading(false);
      return;
    }
    refresh().catch(() => { /* not a student session, or offline */ }).finally(() => setLoading(false));
  }, [user?.studentId, refresh]);

  const value = useMemo(
    () => ({ student, batch, directors, loading, refresh, updateProfile, uploadPhoto, removePhoto }),
    [student, batch, directors, loading, refresh, updateProfile, uploadPhoto, removePhoto],
  );

  return <StudentSelfContext.Provider value={value}>{children}</StudentSelfContext.Provider>;
}

export function useStudentSelfContext() {
  const ctx = useContext(StudentSelfContext);
  if (!ctx) throw new Error("useStudentSelfContext must be within StudentSelfProvider");
  return ctx;
}
