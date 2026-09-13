import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  Session, Course, Subject, Lecture, ClassExam, VideoClass, Question, AcademicSettings,
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
};

/** Backend documents come back as { _id, ... }; every existing page reads `.id`. */
function withId<T extends { _id: string }>(doc: T): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

interface Ctx extends MockState {
  sessions: Session[];
  courses: Course[];
  subjects: Subject[];
  lectures: Lecture[];
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
  // Subjects
  addSubject: (s: Omit<Subject, "id">) => Promise<Subject>;
  updateSubject: (id: string, s: Partial<Subject>) => Promise<Subject>;
  deleteSubject: (id: string) => Promise<void>;
  // Lectures
  addLecture: (l: Omit<Lecture, "id">) => Promise<Lecture>;
  updateLecture: (id: string, l: Partial<Lecture>) => Promise<Lecture>;
  deleteLecture: (id: string) => Promise<void>;
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
  getSubjectsByCourse: (courseId: string) => Subject[];
  getLecturesBySubject: (subjectId: string) => Lecture[];
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
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [settings, setSettings] = useState<AcademicSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const [mock, setMock] = useState<MockState>(() => loadMock());
  useEffect(() => {
    try { localStorage.setItem(MOCK_KEY, JSON.stringify(mock)); } catch { /* ignore */ }
  }, [mock]);

  const refreshAll = useCallback(async () => {
    const [s, c, sub, lec, set] = await Promise.all([
      api.get<{ _id: string }[]>(`/sessions${LIST_LIMIT}`),
      api.get<{ _id: string }[]>(`/courses${LIST_LIMIT}`),
      api.get<{ _id: string }[]>(`/subjects${LIST_LIMIT}`),
      api.get<{ _id: string }[]>(`/lectures${LIST_LIMIT}`),
      api.get<AcademicSettings>("/settings"),
    ]);
    setSessions(s.map(withId) as Session[]);
    setCourses(c.map(withId) as Course[]);
    setSubjects(sub.map(withId) as Subject[]);
    setLectures(lec.map(withId) as Lecture[]);
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

  // -------------------- Helpers --------------------
  const getCoursesBySession = useCallback((sid: string) => courses.filter((c) => c.sessionId === sid), [courses]);
  const getSubjectsByCourse = useCallback((cid: string) => subjects.filter((s) => s.courseId === cid), [subjects]);
  const getLecturesBySubject = useCallback((sid: string) => lectures.filter((l) => l.subjectId === sid).sort((a, b) => a.lectureNumber - b.lectureNumber), [lectures]);
  const getClassExamsByLecture = useCallback((lid: string) => mock.classExams.filter((c) => c.lectureId === lid), [mock.classExams]);
  const getVideosByLecture = useCallback((lid: string) => mock.videos.filter((v) => v.lectureId === lid), [mock.videos]);
  const getCourse = useCallback((id: string) => courses.find((c) => c.id === id), [courses]);
  const getSubject = useCallback((id: string) => subjects.find((s) => s.id === id), [subjects]);
  const getLecture = useCallback((id: string) => lectures.find((l) => l.id === id), [lectures]);

  const value = useMemo<Ctx>(() => ({
    sessions, courses, subjects, lectures, settings, loading,
    classExams: mock.classExams, videos: mock.videos,
    addSession, updateSession, deleteSession,
    addCourse, updateCourse, deleteCourse,
    addSubject, updateSubject, deleteSubject,
    addLecture, updateLecture, deleteLecture,
    addClassExam, updateClassExam, deleteClassExam,
    addQuestions, updateQuestion, deleteQuestion,
    addVideo, updateVideo, deleteVideo,
    updateSettings,
    getCoursesBySession, getSubjectsByCourse, getLecturesBySubject, getClassExamsByLecture, getVideosByLecture,
    getCourse, getSubject, getLecture,
  }), [sessions, courses, subjects, lectures, settings, loading, mock,
    addSession, updateSession, deleteSession, addCourse, updateCourse, deleteCourse,
    addSubject, updateSubject, deleteSubject, addLecture, updateLecture, deleteLecture,
    addClassExam, updateClassExam, deleteClassExam, addQuestions, updateQuestion, deleteQuestion,
    addVideo, updateVideo, deleteVideo, updateSettings,
    getCoursesBySession, getSubjectsByCourse, getLecturesBySubject, getClassExamsByLecture, getVideosByLecture,
    getCourse, getSubject, getLecture]);

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
}

export function useAcademic() {
  const ctx = useContext(AcademicContext);
  if (!ctx) throw new Error("useAcademic must be within AcademicProvider");
  return ctx;
}
