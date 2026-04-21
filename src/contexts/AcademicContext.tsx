import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  Session, Course, Subject, Lecture, ClassExam, VideoClass, Question, AcademicSettings,
} from "@/types/academic";

const KEY = "lara-academic-v1";

interface State {
  sessions: Session[];
  courses: Course[];
  subjects: Subject[];
  lectures: Lecture[];
  classExams: ClassExam[];
  videos: VideoClass[];
  settings: AcademicSettings;
}

function seed(): State {
  const sessions: Session[] = [
    { id: "ses1", name: "সেশন ২০২৬", startDate: "2026-01-01", endDate: "2026-12-31" },
    { id: "ses2", name: "সেশন ২০২৫", startDate: "2025-01-01", endDate: "2025-12-31" },
  ];
  const courses: Course[] = [
    { id: "c1", name: "বিজ্ঞান", sessionId: "ses1", duration: 12 },
    { id: "c2", name: "বাণিজ্য", sessionId: "ses1", duration: 12 },
    { id: "c3", name: "মানবিক", sessionId: "ses1", duration: 12 },
  ];
  const subjects: Subject[] = [
    { id: "sub1", name: "পদার্থবিজ্ঞান", courseId: "c1" },
    { id: "sub2", name: "রসায়ন", courseId: "c1" },
    { id: "sub3", name: "গণিত", courseId: "c1" },
    { id: "sub4", name: "জীববিজ্ঞান", courseId: "c1" },
    { id: "sub5", name: "হিসাববিজ্ঞান", courseId: "c2" },
    { id: "sub6", name: "ব্যবসায় শিক্ষা", courseId: "c2" },
    { id: "sub7", name: "ইতিহাস", courseId: "c3" },
    { id: "sub8", name: "ভূগোল", courseId: "c3" },
  ];
  const lectures: Lecture[] = [
    { id: "lec1", title: "নিউটনের গতিসূত্র", subjectId: "sub1", lectureNumber: 1, description: "প্রথম, দ্বিতীয় ও তৃতীয় সূত্র" },
    { id: "lec2", title: "তরঙ্গ", subjectId: "sub1", lectureNumber: 2 },
    { id: "lec3", title: "পর্যায় সারণি", subjectId: "sub2", lectureNumber: 1 },
    { id: "lec4", title: "ত্রিকোণমিতি", subjectId: "sub3", lectureNumber: 1 },
  ];
  return {
    sessions, courses, subjects, lectures,
    classExams: [],
    videos: [],
    settings: {
      defaultSessionId: "ses1",
      defaultExamDuration: 60,
      passingPercentage: 33,
      shuffleQuestions: false,
      publishResults: true,
    },
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch { /* ignore */ }
  return seed();
}

interface Ctx extends State {
  // Sessions
  addSession: (s: Omit<Session, "id">) => void;
  updateSession: (id: string, s: Partial<Session>) => void;
  deleteSession: (id: string) => void;
  // Courses
  addCourse: (c: Omit<Course, "id">) => void;
  updateCourse: (id: string, c: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  // Subjects
  addSubject: (s: Omit<Subject, "id">) => void;
  updateSubject: (id: string, s: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;
  // Lectures
  addLecture: (l: Omit<Lecture, "id">) => void;
  updateLecture: (id: string, l: Partial<Lecture>) => void;
  deleteLecture: (id: string) => void;
  // Class/Exam
  addClassExam: (c: Omit<ClassExam, "id">) => ClassExam;
  updateClassExam: (id: string, c: Partial<ClassExam>) => void;
  deleteClassExam: (id: string) => void;
  // Questions inside an exam
  addQuestions: (examId: string, qs: Omit<Question, "id">[]) => void;
  updateQuestion: (examId: string, qid: string, q: Partial<Question>) => void;
  deleteQuestion: (examId: string, qid: string) => void;
  // Video Classes
  addVideo: (v: Omit<VideoClass, "id">) => void;
  updateVideo: (id: string, v: Partial<VideoClass>) => void;
  deleteVideo: (id: string) => void;
  // Settings
  updateSettings: (s: Partial<AcademicSettings>) => void;
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

export function AcademicProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => load());

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Sessions
  const addSession = useCallback((s: Omit<Session, "id">) =>
    setState((p) => ({ ...p, sessions: [{ ...s, id: uid("ses") }, ...p.sessions] })), []);
  const updateSession = useCallback((id: string, s: Partial<Session>) =>
    setState((p) => ({ ...p, sessions: p.sessions.map((x) => x.id === id ? { ...x, ...s } : x) })), []);
  const deleteSession = useCallback((id: string) =>
    setState((p) => ({ ...p, sessions: p.sessions.filter((x) => x.id !== id) })), []);

  // Courses
  const addCourse = useCallback((c: Omit<Course, "id">) =>
    setState((p) => ({ ...p, courses: [{ ...c, id: uid("c") }, ...p.courses] })), []);
  const updateCourse = useCallback((id: string, c: Partial<Course>) =>
    setState((p) => ({ ...p, courses: p.courses.map((x) => x.id === id ? { ...x, ...c } : x) })), []);
  const deleteCourse = useCallback((id: string) =>
    setState((p) => ({ ...p, courses: p.courses.filter((x) => x.id !== id) })), []);

  // Subjects
  const addSubject = useCallback((s: Omit<Subject, "id">) =>
    setState((p) => ({ ...p, subjects: [{ ...s, id: uid("sub") }, ...p.subjects] })), []);
  const updateSubject = useCallback((id: string, s: Partial<Subject>) =>
    setState((p) => ({ ...p, subjects: p.subjects.map((x) => x.id === id ? { ...x, ...s } : x) })), []);
  const deleteSubject = useCallback((id: string) =>
    setState((p) => ({ ...p, subjects: p.subjects.filter((x) => x.id !== id) })), []);

  // Lectures
  const addLecture = useCallback((l: Omit<Lecture, "id">) =>
    setState((p) => ({ ...p, lectures: [{ ...l, id: uid("lec") }, ...p.lectures] })), []);
  const updateLecture = useCallback((id: string, l: Partial<Lecture>) =>
    setState((p) => ({ ...p, lectures: p.lectures.map((x) => x.id === id ? { ...x, ...l } : x) })), []);
  const deleteLecture = useCallback((id: string) =>
    setState((p) => ({ ...p, lectures: p.lectures.filter((x) => x.id !== id) })), []);

  // Class/Exam
  const addClassExam = useCallback((c: Omit<ClassExam, "id">) => {
    const item: ClassExam = { ...c, id: uid("ce"), questions: c.questions || [] };
    setState((p) => ({ ...p, classExams: [item, ...p.classExams] }));
    return item;
  }, []);
  const updateClassExam = useCallback((id: string, c: Partial<ClassExam>) =>
    setState((p) => ({ ...p, classExams: p.classExams.map((x) => x.id === id ? { ...x, ...c } : x) })), []);
  const deleteClassExam = useCallback((id: string) =>
    setState((p) => ({ ...p, classExams: p.classExams.filter((x) => x.id !== id) })), []);

  const addQuestions = useCallback((examId: string, qs: Omit<Question, "id">[]) => {
    const withIds: Question[] = qs.map((q) => ({ ...q, id: uid("q") }));
    setState((p) => ({
      ...p,
      classExams: p.classExams.map((x) =>
        x.id === examId ? { ...x, questions: [...(x.questions || []), ...withIds] } : x,
      ),
    }));
  }, []);

  const updateQuestion = useCallback((examId: string, qid: string, q: Partial<Question>) =>
    setState((p) => ({
      ...p,
      classExams: p.classExams.map((x) =>
        x.id === examId
          ? { ...x, questions: (x.questions || []).map((qq) => qq.id === qid ? { ...qq, ...q } : qq) }
          : x,
      ),
    })), []);

  const deleteQuestion = useCallback((examId: string, qid: string) =>
    setState((p) => ({
      ...p,
      classExams: p.classExams.map((x) =>
        x.id === examId ? { ...x, questions: (x.questions || []).filter((qq) => qq.id !== qid) } : x,
      ),
    })), []);

  // Videos
  const addVideo = useCallback((v: Omit<VideoClass, "id">) =>
    setState((p) => ({ ...p, videos: [{ ...v, id: uid("vid") }, ...p.videos] })), []);
  const updateVideo = useCallback((id: string, v: Partial<VideoClass>) =>
    setState((p) => ({ ...p, videos: p.videos.map((x) => x.id === id ? { ...x, ...v } : x) })), []);
  const deleteVideo = useCallback((id: string) =>
    setState((p) => ({ ...p, videos: p.videos.filter((x) => x.id !== id) })), []);

  // Settings
  const updateSettings = useCallback((s: Partial<AcademicSettings>) =>
    setState((p) => ({ ...p, settings: { ...p.settings, ...s } })), []);

  // Helpers
  const getCoursesBySession = useCallback((sid: string) => state.courses.filter((c) => c.sessionId === sid), [state.courses]);
  const getSubjectsByCourse = useCallback((cid: string) => state.subjects.filter((s) => s.courseId === cid), [state.subjects]);
  const getLecturesBySubject = useCallback((sid: string) => state.lectures.filter((l) => l.subjectId === sid).sort((a, b) => a.lectureNumber - b.lectureNumber), [state.lectures]);
  const getClassExamsByLecture = useCallback((lid: string) => state.classExams.filter((c) => c.lectureId === lid), [state.classExams]);
  const getVideosByLecture = useCallback((lid: string) => state.videos.filter((v) => v.lectureId === lid), [state.videos]);
  const getCourse = useCallback((id: string) => state.courses.find((c) => c.id === id), [state.courses]);
  const getSubject = useCallback((id: string) => state.subjects.find((s) => s.id === id), [state.subjects]);
  const getLecture = useCallback((id: string) => state.lectures.find((l) => l.id === id), [state.lectures]);

  const value = useMemo<Ctx>(() => ({
    ...state,
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
  }), [state, addSession, updateSession, deleteSession, addCourse, updateCourse, deleteCourse, addSubject, updateSubject, deleteSubject, addLecture, updateLecture, deleteLecture, addClassExam, updateClassExam, deleteClassExam, addQuestions, updateQuestion, deleteQuestion, addVideo, updateVideo, deleteVideo, updateSettings, getCoursesBySession, getSubjectsByCourse, getLecturesBySubject, getClassExamsByLecture, getVideosByLecture, getCourse, getSubject, getLecture]);

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
}

export function useAcademic() {
  const ctx = useContext(AcademicContext);
  if (!ctx) throw new Error("useAcademic must be within AcademicProvider");
  return ctx;
}
