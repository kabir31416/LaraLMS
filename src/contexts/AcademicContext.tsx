import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  Session, Course, Subject, CourseSubject, Lecture, ClassExam, VideoClass, Question, AcademicSettings, PaymentMethod,
} from "@/types/academic";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sessions/Courses/Subjects/Lectures/Settings are now backed by the real API
 * (Phase 3, Modules 5-9) — this is the single source of truth, replacing the
 * `lara-academic-v1` localStorage blob for those fields.
 *
 * ClassExams and VideoClasses are NOT part of this module yet (Modules 18-21)
 * and stay exactly as they were: local state seeded once and persisted to a
 * smaller localStorage key, so nothing about the Exam/Video screens changes
 * until their own backend modules land.
 */
const MOCK_KEY = "lara-academic-mock-v1"; // classExams + videos only, until Modules 18-21

interface MockState {
  classExams: ClassExam[];
  videos: VideoClass[];
}

function loadMock(): MockState {
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    if (raw) return JSON.parse(raw) as MockState;
  } catch { /* ignore */ }
  return { classExams: [], videos: [] };
}

const DEFAULT_SETTINGS: AcademicSettings = {
  defaultExamDuration: 60,
  passingPercentage: 33,
  shuffleQuestions: false,
  publishResults: true,
  gradeScale: [],
  rollNumberScope: "batch",
  admissionFeeBdt: 200,
  studentIdPrefix: "LMS",
};

/** Backend documents come back as { _id, ... }; every existing page reads `.id`. */
function withId<T extends { _id: string }>(doc: T): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

interface Ctx extends MockState {
  sessions: Session[];
  courses: Course[];
  /** GLOBAL Subject catalog — no courseId. Which Courses a Subject belongs to is `courseSubjects`, not this list. */
  subjects: Subject[];
  /** Raw Course↔Subject assignment rows (Course → CourseSubject → Subject → Lecture). */
  courseSubjects: CourseSubject[];
  lectures: Lecture[];
  paymentMethods: PaymentMethod[];
  /** Same lists, filtered to status "সক্রিয়" (plus whatever is currently selected, so an edit form never blanks out an inactive value) — use these for every "pick one to admit/assign/create" dropdown (Settings §25). */
  activeSessions: Session[];
  activeCourses: Course[];
  activeSubjects: Subject[];
  activeCourseSubjects: CourseSubject[];
  activePaymentMethods: PaymentMethod[];
  settings: AcademicSettings;
  loading: boolean;
  // Sessions
  addSession: (s: Omit<Session, "id">) => Promise<Session>;
  updateSession: (id: string, s: Partial<Session>) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  // Courses
  addCourse: (c: Omit<Course, "id">) => Promise<Course>;
  updateCourse: (id: string, c: Partial<Course>) => Promise<Course>;
  deleteCourse: (id: string) => Promise<void>;
  // Subjects (global catalog — create/edit/deactivate/delete never touches any Course assignment)
  addSubject: (s: Omit<Subject, "id">) => Promise<Subject>;
  updateSubject: (id: string, s: Partial<Subject>) => Promise<Subject>;
  deleteSubject: (id: string) => Promise<void>;
  // Course ↔ Subject assignment
  addCourseSubject: (courseId: string, subjectId: string, order?: number) => Promise<CourseSubject>;
  updateCourseSubject: (courseId: string, id: string, patch: Partial<Pick<CourseSubject, "order" | "status">>) => Promise<CourseSubject>;
  removeCourseSubject: (courseId: string, id: string) => Promise<void>;
  // Lectures (each belongs to a CourseSubject, never directly to a Subject)
  addLecture: (l: Omit<Lecture, "id">) => Promise<Lecture>;
  updateLecture: (id: string, l: Partial<Lecture>) => Promise<Lecture>;
  deleteLecture: (id: string) => Promise<void>;
  // Payment Methods
  addPaymentMethod: (p: Omit<PaymentMethod, "id">) => Promise<PaymentMethod>;
  updatePaymentMethod: (id: string, p: Partial<PaymentMethod>) => Promise<PaymentMethod>;
  deletePaymentMethod: (id: string) => Promise<void>;
  // Class/Exam (still local — Modules 18-21)
  addClassExam: (c: Omit<ClassExam, "id">) => ClassExam;
  updateClassExam: (id: string, c: Partial<ClassExam>) => void;
  deleteClassExam: (id: string) => void;
  addQuestions: (examId: string, qs: Omit<Question, "id">[]) => void;
  updateQuestion: (examId: string, qid: string, q: Partial<Question>) => void;
  deleteQuestion: (examId: string, qid: string) => void;
  // Video Classes (still local — Modules 18-21)
  addVideo: (v: Omit<VideoClass, "id">) => void;
  updateVideo: (id: string, v: Partial<VideoClass>) => void;
  deleteVideo: (id: string) => void;
  // Settings
  updateSettings: (s: Partial<AcademicSettings>) => Promise<void>;
  // Helpers
  getCoursesBySession: (sessionId: string) => Course[];
  /** The GLOBAL Subjects assigned to this Course (joined through courseSubjects), in Course-specific display order. */
  getSubjectsByCourse: (courseId: string) => Subject[];
  /** Raw CourseSubject rows for one Course, in display order — used by the Course management UI (reorder/remove/manage-lectures). */
  getCourseSubjectsForCourse: (courseId: string) => CourseSubject[];
  getCourseSubject: (id: string) => CourseSubject | undefined;
  /** The specific CourseSubject row for (courseId, subjectId), if that Subject is assigned to that Course — the id Lectures/Exams key off. */
  getCourseSubjectId: (courseId: string, subjectId: string) => string | undefined;
  /** A Lecture's underlying global Subject (resolved through its CourseSubject) — for display only. */
  getSubjectForCourseSubject: (courseSubjectId: string) => Subject | undefined;
  /** Lectures under one specific (course, subject) combination — resolves the CourseSubject internally, so lectures never leak across Courses even when they share the same global Subject. */
  getLecturesBySubject: (courseId: string, subjectId: string) => Lecture[];
  getClassExamsByLecture: (lectureId: string) => ClassExam[];
  getVideosByLecture: (lectureId: string) => VideoClass[];
  getCourse: (id: string) => Course | undefined;
  getSubject: (id: string) => Subject | undefined;
  getLecture: (id: string) => Lecture | undefined;
}

const AcademicContext = createContext<Ctx | null>(null);

// Master data lists are expected to stay well under 100 rows for a single
// coaching centre; the Reports module gets real pagination separately.
const LIST_LIMIT = "?limit=100";

export function AcademicProvider({ children }: { children: React.ReactNode }) {
  const { initializing, user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courseSubjects, setCourseSubjects] = useState<CourseSubject[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [settings, setSettings] = useState<AcademicSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const [mock, setMock] = useState<MockState>(() => loadMock());
  useEffect(() => {
    try { localStorage.setItem(MOCK_KEY, JSON.stringify(mock)); } catch { /* ignore */ }
  }, [mock]);

  const refreshAll = useCallback(async () => {
    const [s, c, sub, cs, lec, pm, set] = await Promise.all([
      api.get<{ _id: string }[]>(`/sessions${LIST_LIMIT}`),
      api.get<{ _id: string }[]>(`/courses${LIST_LIMIT}`),
      api.get<{ _id: string }[]>(`/subjects${LIST_LIMIT}`),
      api.get<{ _id: string }[]>(`/course-subjects`),
      api.get<{ _id: string }[]>(`/lectures${LIST_LIMIT}`),
      api.get<{ _id: string }[]>(`/payment-methods${LIST_LIMIT}`),
      api.get<AcademicSettings>("/settings"),
    ]);
    setSessions(s.map(withId) as Session[]);
    setCourses(c.map(withId) as Course[]);
    setSubjects(sub.map(withId) as Subject[]);
    setCourseSubjects(cs.map(withId) as CourseSubject[]);
    setLectures(lec.map(withId) as Lecture[]);
    setPaymentMethods(pm.map(withId) as PaymentMethod[]);
    setSettings(set);
  }, []);

  // Every provider here is mounted inside AuthProvider (see AppProviders.tsx),
  // and React fires child effects before parent effects on mount — so
  // without this gate, this fired its one-shot fetch with no access token at
  // all *every single load*, before AuthContext had restored one from
  // localStorage or the refresh cookie. For Admin that raced with apiClient's
  // own 401-retry-refresh and usually self-healed (invisible, but a wasted
  // round trip); for a Student/Staff Portal session (no refresh cookie) it
  // couldn't self-heal, and worse, the stale 401 arriving back *after*
  // AuthContext had already restored a valid session would wipe it out and
  // log the user straight back out. Waiting for `initializing` to clear
  // before ever fetching removes the race entirely.
  useEffect(() => {
    if (initializing) return;
    if (!user) { setLoading(false); return; }
    refreshAll().catch(() => { /* offline, or this role lacks access */ }).finally(() => setLoading(false));
  }, [initializing, user, refreshAll]);

  // -------------------- Sessions --------------------
  const addSession = useCallback(async (s: Omit<Session, "id">) => {
    const created = withId(await api.post<{ _id: string }>("/sessions", s)) as Session;
    setSessions((p) => [created, ...p]);
    return created;
  }, []);
  const updateSession = useCallback(async (id: string, s: Partial<Session>) => {
    const updated = withId(await api.patch<{ _id: string }>(`/sessions/${id}`, s)) as Session;
    setSessions((p) => p.map((x) => (x.id === id ? updated : x)));
    return updated;
  }, []);
  const deleteSession = useCallback(async (id: string) => {
    await api.del(`/sessions/${id}`);
    setSessions((p) => p.filter((x) => x.id !== id));
  }, []);

  // -------------------- Courses --------------------
  const addCourse = useCallback(async (c: Omit<Course, "id">) => {
    const created = withId(await api.post<{ _id: string }>("/courses", c)) as Course;
    setCourses((p) => [created, ...p]);
    return created;
  }, []);
  const updateCourse = useCallback(async (id: string, c: Partial<Course>) => {
    const updated = withId(await api.patch<{ _id: string }>(`/courses/${id}`, c)) as Course;
    setCourses((p) => p.map((x) => (x.id === id ? updated : x)));
    return updated;
  }, []);
  const deleteCourse = useCallback(async (id: string) => {
    await api.del(`/courses/${id}`);
    setCourses((p) => p.filter((x) => x.id !== id));
  }, []);

  // -------------------- Subjects --------------------
  const addSubject = useCallback(async (s: Omit<Subject, "id">) => {
    const created = withId(await api.post<{ _id: string }>("/subjects", s)) as Subject;
    setSubjects((p) => [created, ...p]);
    return created;
  }, []);
  const updateSubject = useCallback(async (id: string, s: Partial<Subject>) => {
    const updated = withId(await api.patch<{ _id: string }>(`/subjects/${id}`, s)) as Subject;
    setSubjects((p) => p.map((x) => (x.id === id ? updated : x)));
    return updated;
  }, []);
  const deleteSubject = useCallback(async (id: string) => {
    await api.del(`/subjects/${id}`);
    setSubjects((p) => p.filter((x) => x.id !== id));
  }, []);

  // -------------------- Course ↔ Subject assignment --------------------
  const addCourseSubject = useCallback(async (courseId: string, subjectId: string, order?: number) => {
    const created = withId(await api.post<{ _id: string }>(`/courses/${courseId}/subjects`, { subjectId, order })) as CourseSubject;
    setCourseSubjects((p) => [...p, created]);
    return created;
  }, []);
  const updateCourseSubject = useCallback(async (courseId: string, id: string, patch: Partial<Pick<CourseSubject, "order" | "status">>) => {
    const updated = withId(await api.patch<{ _id: string }>(`/courses/${courseId}/subjects/${id}`, patch)) as CourseSubject;
    setCourseSubjects((p) => p.map((x) => (x.id === id ? updated : x)));
    return updated;
  }, []);
  const removeCourseSubject = useCallback(async (courseId: string, id: string) => {
    await api.del(`/courses/${courseId}/subjects/${id}`);
    setCourseSubjects((p) => p.filter((x) => x.id !== id));
  }, []);

  // -------------------- Lectures --------------------
  const addLecture = useCallback(async (l: Omit<Lecture, "id">) => {
    const created = withId(await api.post<{ _id: string }>("/lectures", l)) as Lecture;
    setLectures((p) => [created, ...p]);
    return created;
  }, []);
  const updateLecture = useCallback(async (id: string, l: Partial<Lecture>) => {
    const updated = withId(await api.patch<{ _id: string }>(`/lectures/${id}`, l)) as Lecture;
    setLectures((p) => p.map((x) => (x.id === id ? updated : x)));
    return updated;
  }, []);
  const deleteLecture = useCallback(async (id: string) => {
    await api.del(`/lectures/${id}`);
    setLectures((p) => p.filter((x) => x.id !== id));
  }, []);

  // -------------------- Payment Methods --------------------
  const addPaymentMethod = useCallback(async (p: Omit<PaymentMethod, "id">) => {
    const created = withId(await api.post<{ _id: string }>("/payment-methods", p)) as PaymentMethod;
    setPaymentMethods((prev) => [...prev, created]);
    return created;
  }, []);
  const updatePaymentMethod = useCallback(async (id: string, p: Partial<PaymentMethod>) => {
    const updated = withId(await api.patch<{ _id: string }>(`/payment-methods/${id}`, p)) as PaymentMethod;
    setPaymentMethods((prev) => prev.map((x) => (x.id === id ? updated : x)));
    return updated;
  }, []);
  const deletePaymentMethod = useCallback(async (id: string) => {
    await api.del(`/payment-methods/${id}`);
    setPaymentMethods((prev) => prev.filter((x) => x.id !== id));
  }, []);

  // -------------------- Settings --------------------
  const updateSettings = useCallback(async (s: Partial<AcademicSettings>) => {
    const updated = await api.patch<AcademicSettings>("/settings", s);
    setSettings(updated);
  }, []);

  // -------------------- Class/Exam + Video (unchanged local mock) --------------------
  const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const addClassExam = useCallback((c: Omit<ClassExam, "id">) => {
    const item: ClassExam = { ...c, id: uid("ce"), questions: c.questions || [] };
    setMock((p) => ({ ...p, classExams: [item, ...p.classExams] }));
    return item;
  }, []);
  const updateClassExam = useCallback((id: string, c: Partial<ClassExam>) =>
    setMock((p) => ({ ...p, classExams: p.classExams.map((x) => x.id === id ? { ...x, ...c } : x) })), []);
  const deleteClassExam = useCallback((id: string) =>
    setMock((p) => ({ ...p, classExams: p.classExams.filter((x) => x.id !== id) })), []);

  const addQuestions = useCallback((examId: string, qs: Omit<Question, "id">[]) => {
    const withIds: Question[] = qs.map((q) => ({ ...q, id: uid("q") }));
    setMock((p) => ({
      ...p,
      classExams: p.classExams.map((x) =>
        x.id === examId ? { ...x, questions: [...(x.questions || []), ...withIds] } : x,
      ),
    }));
  }, []);
  const updateQuestion = useCallback((examId: string, qid: string, q: Partial<Question>) =>
    setMock((p) => ({
      ...p,
      classExams: p.classExams.map((x) =>
        x.id === examId
          ? { ...x, questions: (x.questions || []).map((qq) => qq.id === qid ? { ...qq, ...q } : qq) }
          : x,
      ),
    })), []);
  const deleteQuestion = useCallback((examId: string, qid: string) =>
    setMock((p) => ({
      ...p,
      classExams: p.classExams.map((x) =>
        x.id === examId ? { ...x, questions: (x.questions || []).filter((qq) => qq.id !== qid) } : x,
      ),
    })), []);

  const addVideo = useCallback((v: Omit<VideoClass, "id">) =>
    setMock((p) => ({ ...p, videos: [{ ...v, id: uid("vid") }, ...p.videos] })), []);
  const updateVideo = useCallback((id: string, v: Partial<VideoClass>) =>
    setMock((p) => ({ ...p, videos: p.videos.map((x) => x.id === id ? { ...x, ...v } : x) })), []);
  const deleteVideo = useCallback((id: string) =>
    setMock((p) => ({ ...p, videos: p.videos.filter((x) => x.id !== id) })), []);

  // -------------------- Active-only derived lists (Settings §25) --------------------
  const activeSessions = useMemo(() => sessions.filter((s) => s.status !== "নিষ্ক্রিয়"), [sessions]);
  const activeCourses = useMemo(() => courses.filter((c) => c.status !== "নিষ্ক্রিয়"), [courses]);
  const activeSubjects = useMemo(() => subjects.filter((s) => s.status !== "নিষ্ক্রিয়"), [subjects]);
  const activeCourseSubjects = useMemo(() => courseSubjects.filter((cs) => cs.status !== "নিষ্ক্রিয়"), [courseSubjects]);
  const activePaymentMethods = useMemo(() => paymentMethods.filter((p) => p.status !== "নিষ্ক্রিয়"), [paymentMethods]);

  // -------------------- Helpers --------------------
  const getCoursesBySession = useCallback((sid: string) => courses.filter((c) => c.sessionId === sid), [courses]);
  const getSubject = useCallback((id: string) => subjects.find((s) => s.id === id), [subjects]);
  const getCourseSubject = useCallback((id: string) => courseSubjects.find((cs) => cs.id === id), [courseSubjects]);
  const getCourseSubjectsForCourse = useCallback(
    (cid: string) => courseSubjects.filter((cs) => cs.courseId === cid).sort((a, b) => a.order - b.order),
    [courseSubjects],
  );
  const getCourseSubjectId = useCallback(
    (cid: string, subjectId: string) => courseSubjects.find((cs) => cs.courseId === cid && cs.subjectId === subjectId)?.id,
    [courseSubjects],
  );
  const getSubjectForCourseSubject = useCallback(
    (courseSubjectId: string) => {
      const cs = courseSubjects.find((x) => x.id === courseSubjectId);
      return cs ? subjects.find((s) => s.id === cs.subjectId) : undefined;
    },
    [courseSubjects, subjects],
  );
  const getSubjectsByCourse = useCallback(
    (cid: string) =>
      getCourseSubjectsForCourse(cid)
        .map((cs) => subjects.find((s) => s.id === cs.subjectId))
        .filter((s): s is Subject => Boolean(s)),
    [getCourseSubjectsForCourse, subjects],
  );
  const getLecturesBySubject = useCallback(
    (cid: string, subjectId: string) => {
      const courseSubjectId = getCourseSubjectId(cid, subjectId);
      if (!courseSubjectId) return [];
      return lectures.filter((l) => l.courseSubjectId === courseSubjectId).sort((a, b) => a.lectureNumber - b.lectureNumber);
    },
    [getCourseSubjectId, lectures],
  );
  const getClassExamsByLecture = useCallback((lid: string) => mock.classExams.filter((c) => c.lectureId === lid), [mock.classExams]);
  const getVideosByLecture = useCallback((lid: string) => mock.videos.filter((v) => v.lectureId === lid), [mock.videos]);
  const getCourse = useCallback((id: string) => courses.find((c) => c.id === id), [courses]);
  const getLecture = useCallback((id: string) => lectures.find((l) => l.id === id), [lectures]);

  const value = useMemo<Ctx>(() => ({
    sessions, courses, subjects, courseSubjects, lectures, paymentMethods, settings, loading,
    activeSessions, activeCourses, activeSubjects, activeCourseSubjects, activePaymentMethods,
    classExams: mock.classExams, videos: mock.videos,
    addSession, updateSession, deleteSession,
    addCourse, updateCourse, deleteCourse,
    addSubject, updateSubject, deleteSubject,
    addCourseSubject, updateCourseSubject, removeCourseSubject,
    addLecture, updateLecture, deleteLecture,
    addPaymentMethod, updatePaymentMethod, deletePaymentMethod,
    addClassExam, updateClassExam, deleteClassExam,
    addQuestions, updateQuestion, deleteQuestion,
    addVideo, updateVideo, deleteVideo,
    updateSettings,
    getCoursesBySession, getSubjectsByCourse, getCourseSubjectsForCourse, getCourseSubject, getCourseSubjectId,
    getSubjectForCourseSubject, getLecturesBySubject, getClassExamsByLecture, getVideosByLecture,
    getCourse, getSubject, getLecture,
  }), [sessions, courses, subjects, courseSubjects, lectures, paymentMethods, settings, loading, mock,
    activeSessions, activeCourses, activeSubjects, activeCourseSubjects, activePaymentMethods,
    addSession, updateSession, deleteSession, addCourse, updateCourse, deleteCourse,
    addSubject, updateSubject, deleteSubject, addCourseSubject, updateCourseSubject, removeCourseSubject,
    addLecture, updateLecture, deleteLecture,
    addPaymentMethod, updatePaymentMethod, deletePaymentMethod,
    addClassExam, updateClassExam, deleteClassExam, addQuestions, updateQuestion, deleteQuestion,
    addVideo, updateVideo, deleteVideo, updateSettings,
    getCoursesBySession, getSubjectsByCourse, getCourseSubjectsForCourse, getCourseSubject, getCourseSubjectId,
    getSubjectForCourseSubject, getLecturesBySubject, getClassExamsByLecture, getVideosByLecture,
    getCourse, getSubject, getLecture]);

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
}

export function useAcademic() {
  const ctx = useContext(AcademicContext);
  if (!ctx) throw new Error("useAcademic must be within AcademicProvider");
  return ctx;
}
