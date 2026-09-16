import { Request } from "express";
import { OfflineExam, OfflineExamDoc } from "./exam.model";
import { OfflineResult } from "./result.model";
import { Batch } from "../batches/batch.model";
import { Student } from "../students/student.model";
import { Subject } from "../subjects/subject.model";
import { Lecture } from "../lectures/lecture.model";
import { getSettings } from "../settings/settings.service";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { assertCanActOnBatch, computeGrade, readScope } from "./exam.service";

/**
 * Result Management (internal Admin/Batch Director module) — a viewing +
 * editing layer over the EXACT same OfflineExam/OfflineResult data Result
 * Entry writes and the public /marksheet reads. No new result collection,
 * no separate calculation logic: percentage/grade reuse exam.service.ts's
 * own computeGrade + Settings.gradeScale/passingPercentage, and an edit
 * here updates the same OfflineResult row Result Entry itself would.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function gradeResult(
  marks: number | null,
  fullMarks: number,
  gradeScale: { minPercent: number; grade: string }[],
  passingPercentage: number,
): { percentage: number | null; grade: string; result: "পাস" | "ফেল" | "অনুপস্থিত" } {
  if (marks === null) return { percentage: null, grade: "", result: "অনুপস্থিত" };
  const percentage = fullMarks > 0 ? round2((marks / fullMarks) * 100) : 0;
  return { percentage, grade: computeGrade(percentage, gradeScale), result: percentage >= passingPercentage ? "পাস" : "ফেল" };
}

export interface ResultRowView {
  resultId: string;
  examId: string;
  subjectName: string;
  lectureTitle: string;
  examTitle: string;
  batchName: string;
  date: string;
  fullMarks: number;
  obtainedMarks: number | null;
  percentage: number | null;
  grade: string;
  result: "পাস" | "ফেল" | "অনুপস্থিত";
  isPublished: boolean;
}

export interface StudentResultDetail {
  student: {
    id: string;
    name: string;
    registrationId: string;
    rollNumber?: string;
    course?: string;
    batchName?: string;
    phone: string;
  };
  rows: ResultRowView[];
}

/**
 * Individual Result — every OfflineResult row for one student, joined with
 * its exam/subject/lecture/batch, newest first. Two bulk queries (results,
 * then their exams) plus one more for subject/lecture/batch names — never
 * one query per row. A Batch Director only ever sees this for a student
 * CURRENTLY in one of their own batches (their full history is still
 * shown, including exams from before they joined this batch — same "tied
 * to the exam's own batch at the time" history as the rest of this app,
 * but the *access* decision is based on the student's present assignment,
 * matching "only students belonging to assigned batches").
 */
export async function getStudentResultDetail(req: Request, studentId: string): Promise<StudentResultDetail> {
  const student = await Student.findById(studentId).select("name registrationId currentRollNumber course currentBatchId phone");
  if (!student) throw ApiError.notFound("Student not found");

  const scope = await readScope(req);
  if (scope?.batchIds) {
    if (!student.currentBatchId || !scope.batchIds.includes(String(student.currentBatchId))) {
      throw ApiError.forbidden("You may only view results for students in batches you direct");
    }
  }

  let batchName: string | undefined;
  if (student.currentBatchId) {
    const batch = await Batch.findById(student.currentBatchId).select("name");
    batchName = batch?.name;
  }

  const results = await OfflineResult.find({ studentId }).sort({ createdAt: -1 });
  const examIds = Array.from(new Set(results.map((r) => String(r.examId))));
  const exams = await OfflineExam.find({ _id: { $in: examIds } }).select("title fullMarks date isPublished subjectId lectureId batchId");
  const examById = new Map(exams.map((e) => [String(e._id), e]));

  const [subjects, lectures, batches, settings] = await Promise.all([
    Subject.find({ _id: { $in: exams.map((e) => e.subjectId) } }).select("name"),
    Lecture.find({ _id: { $in: exams.map((e) => e.lectureId) } }).select("title"),
    Batch.find({ _id: { $in: exams.map((e) => e.batchId) } }).select("name"),
    getSettings(),
  ]);
  const subjectById = new Map(subjects.map((s) => [String(s._id), s.name]));
  const lectureById = new Map(lectures.map((l) => [String(l._id), l.title]));
  const batchById = new Map(batches.map((b) => [String(b._id), b.name]));

  const rows: ResultRowView[] = results
    .map((r) => {
      const exam = examById.get(String(r.examId));
      if (!exam) return null;
      const { percentage, grade, result } = gradeResult(r.marks, exam.fullMarks, settings.gradeScale, settings.passingPercentage);
      const row: ResultRowView = {
        resultId: String(r._id),
        examId: String(exam._id),
        subjectName: subjectById.get(String(exam.subjectId)) ?? "-",
        lectureTitle: lectureById.get(String(exam.lectureId)) ?? "-",
        examTitle: exam.title,
        batchName: batchById.get(String(exam.batchId)) ?? "-",
        date: exam.date,
        fullMarks: exam.fullMarks,
        obtainedMarks: r.marks,
        percentage,
        grade,
        result,
        isPublished: exam.isPublished,
      };
      return row;
    })
    .filter((r): r is ResultRowView => r !== null);

  return {
    student: {
      id: String(student._id),
      name: student.name,
      registrationId: student.registrationId,
      rollNumber: student.currentRollNumber,
      course: student.course,
      batchName,
      phone: student.phone,
    },
    rows,
  };
}

export interface BatchResultColumn {
  examId: string;
  subjectName: string;
  lectureTitle: string;
  examTitle: string;
  date: string;
  fullMarks: number;
}

export interface BatchResultCell {
  resultId: string | null;
  value: number | null;
  status: "present" | "absent" | "na";
}

export interface BatchResultRow {
  studentId: string;
  rollNumber: string;
  registrationId: string;
  name: string;
  cells: BatchResultCell[];
  totalObtained: number;
  totalFullMarks: number;
  percentage: number;
  grade: string;
}

export interface BatchResultView {
  batch: { id: string; name: string; courseName: string | null };
  columns: BatchResultColumn[];
  rows: BatchResultRow[];
}

async function courseNameOf(batch: { courseId?: unknown }): Promise<string | null> {
  if (!batch.courseId) return null;
  const { Course } = await import("../courses/course.model");
  return (await Course.findById(batch.courseId).select("name"))?.name ?? null;
}

/**
 * Batch-wise Result — one column per matching exam (narrowed by subject/
 * lecture/exam filters, the same Course→Batch→Subject→Lecture/Exam
 * linkage Result Entry itself uses), one row per student who has at least
 * one result against this batch's exams. Two queries total (exams, then
 * results) regardless of student count — same N+1-safe shape as the
 * public marksheet's getBatchMasterSheet, just without its isPublished/
 * Settings gating (internal management sees everything) and with each
 * cell carrying its own resultId so the UI can edit it directly.
 */
export async function getBatchResults(
  req: Request,
  params: { batchId: string; subjectId?: string; lectureId?: string; examId?: string },
): Promise<BatchResultView> {
  const batch = await Batch.findById(params.batchId).select("name courseId directorId");
  if (!batch) throw ApiError.notFound("Batch not found");

  const scope = await readScope(req);
  if (scope?.batchIds && !scope.batchIds.includes(String(batch._id))) {
    throw ApiError.forbidden("You may only view results for batches you direct");
  }

  const examFilter: Record<string, unknown> = { batchId: batch._id };
  if (params.examId) examFilter._id = params.examId;
  else {
    if (params.subjectId) examFilter.subjectId = params.subjectId;
    if (params.lectureId) examFilter.lectureId = params.lectureId;
  }

  const exams = await OfflineExam.find(examFilter).select("subjectId lectureId title fullMarks date").sort({ date: 1 });
  if (exams.length === 0) {
    return { batch: { id: String(batch._id), name: batch.name, courseName: await courseNameOf(batch) }, columns: [], rows: [] };
  }

  const examIds = exams.map((e) => e._id);
  const [subjects, lectures, results] = await Promise.all([
    Subject.find({ _id: { $in: exams.map((e) => e.subjectId) } }).select("name"),
    Lecture.find({ _id: { $in: exams.map((e) => e.lectureId) } }).select("title"),
    OfflineResult.find({ examId: { $in: examIds } }).select("examId studentId marks"),
  ]);
  const subjectById = new Map(subjects.map((s) => [String(s._id), s.name]));
  const lectureById = new Map(lectures.map((l) => [String(l._id), l.title]));

  const columns: BatchResultColumn[] = exams.map((e) => ({
    examId: String(e._id),
    subjectName: subjectById.get(String(e.subjectId)) ?? "-",
    lectureTitle: lectureById.get(String(e.lectureId)) ?? "-",
    examTitle: e.title,
    date: e.date,
    fullMarks: e.fullMarks,
  }));
  const columnIndexByExamId = new Map(exams.map((e, i) => [String(e._id), i]));

  const studentIds = Array.from(new Set(results.map((r) => String(r.studentId))));
  const students = await Student.find({ _id: { $in: studentIds } }).select("name currentRollNumber registrationId");
  const studentById = new Map(students.map((s) => [String(s._id), s]));

  const cellsByStudent = new Map<string, BatchResultCell[]>();
  for (const sid of studentById.keys()) {
    cellsByStudent.set(sid, columns.map(() => ({ resultId: null, value: null, status: "na" as const })));
  }
  for (const r of results) {
    const sid = String(r.studentId);
    const cells = cellsByStudent.get(sid);
    if (!cells) continue; // student record no longer exists
    const colIndex = columnIndexByExamId.get(String(r.examId));
    if (colIndex === undefined) continue;
    cells[colIndex] = r.marks === null
      ? { resultId: String(r._id), value: null, status: "absent" }
      : { resultId: String(r._id), value: r.marks, status: "present" };
  }

  const settings = await getSettings();
  const rows: BatchResultRow[] = Array.from(studentById.entries()).map(([sid, student]) => {
    const cells = cellsByStudent.get(sid)!;
    let totalObtained = 0;
    let totalFullMarks = 0;
    cells.forEach((cell, i) => {
      if (cell.status === "present") {
        totalObtained += cell.value as number;
        totalFullMarks += columns[i].fullMarks;
      }
    });
    const percentage = totalFullMarks > 0 ? round2((totalObtained / totalFullMarks) * 100) : 0;
    return {
      studentId: sid,
      rollNumber: student.currentRollNumber ?? "-",
      registrationId: student.registrationId,
      name: student.name,
      cells,
      totalObtained,
      totalFullMarks,
      percentage,
      grade: totalFullMarks > 0 ? computeGrade(percentage, settings.gradeScale) : "-",
    };
  });
  rows.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, "bn", { numeric: true }));

  return { batch: { id: String(batch._id), name: batch.name, courseName: await courseNameOf(batch) }, columns, rows };
}

/**
 * Edits ONE existing OfflineResult's marks — never inserts a new row (the
 * resultId already identifies the exact existing {examId, studentId}
 * document Result Entry itself created/updated), so this can never produce
 * a duplicate result. Same authorization as Result Entry's own save/send
 * (assertCanActOnBatch): a Batch Director may only edit results for exams
 * belonging to a batch they direct; this doesn't grant any new capability,
 * it's the same OFFLINE_RESULTS_MANAGE_OWN_BATCH permission Result Entry
 * already uses, just reachable from a second screen.
 */
export async function updateResultMark(req: Request, resultId: string, marks: number | null): Promise<ResultRowView> {
  const result = await OfflineResult.findById(resultId);
  if (!result) throw ApiError.notFound("Result not found");

  const exam: OfflineExamDoc | null = await OfflineExam.findById(result.examId);
  if (!exam) throw ApiError.notFound("Exam not found");
  await assertCanActOnBatch(req, String(exam.batchId));

  if (marks !== null && (marks < 0 || marks > exam.fullMarks)) {
    throw ApiError.badRequest(`নম্বর ০ থেকে ${exam.fullMarks}-এর মধ্যে হতে হবে।`);
  }

  const before = { marks: result.marks };
  result.marks = marks;
  await result.save();

  await recordAudit({
    req,
    action: "result.edit-mark",
    module: "exams",
    targetCollection: "offlineresults",
    targetId: String(result._id),
    before,
    after: { marks: result.marks, studentId: String(result.studentId), examId: String(exam._id) },
  });

  const [subject, lecture, batch, settings] = await Promise.all([
    Subject.findById(exam.subjectId).select("name"),
    Lecture.findById(exam.lectureId).select("title"),
    Batch.findById(exam.batchId).select("name"),
    getSettings(),
  ]);
  const { percentage, grade, result: resultStatus } = gradeResult(result.marks, exam.fullMarks, settings.gradeScale, settings.passingPercentage);

  return {
    resultId: String(result._id),
    examId: String(exam._id),
    subjectName: subject?.name ?? "-",
    lectureTitle: lecture?.title ?? "-",
    examTitle: exam.title,
    batchName: batch?.name ?? "-",
    date: exam.date,
    fullMarks: exam.fullMarks,
    obtainedMarks: result.marks,
    percentage,
    grade,
    result: resultStatus,
    isPublished: exam.isPublished,
  };
}
