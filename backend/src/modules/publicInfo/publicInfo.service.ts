import { Types } from "mongoose";
import { Student, StudentDoc } from "../students/student.model";
import { AttendanceEntry } from "../attendance/attendance.model";
import { OfflineResult } from "../exams/result.model";
import { OfflineExam } from "../exams/exam.model";
import { ApiError } from "../../common/utils/ApiError";
import { buildSearchFilter } from "../../common/utils/pagination";
import * as settingsService from "../settings/settings.service";

const SEARCH_METHODS = ["registrationId", "phone", "name"] as const;
type SearchMethod = (typeof SEARCH_METHODS)[number];

/** Name search can enumerate the whole roster if left unbounded — cap results tightly. */
const NAME_SEARCH_LIMIT = 10;

async function attendanceSummaryFor(studentId: string): Promise<{ percent: number | null }> {
  const rows = await AttendanceEntry.aggregate<{ _id: null; total: number; present: number }>([
    { $match: { studentId: new Types.ObjectId(studentId) } },
    { $group: { _id: null, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } } } },
  ]);
  const r = rows[0];
  return { percent: r && r.total ? Math.round((r.present / r.total) * 100) : null };
}

async function resultSummaryFor(studentId: string): Promise<{ averagePercent: number | null; examsTaken: number }> {
  const results = await OfflineResult.find({ studentId, marks: { $ne: null } });
  if (!results.length) return { averagePercent: null, examsTaken: 0 };

  const exams = await OfflineExam.find({ _id: { $in: results.map((r) => r.examId) } }, { fullMarks: 1 });
  const fullMarksById = new Map(exams.map((e) => [String(e._id), e.fullMarks]));

  let sumPercent = 0;
  let counted = 0;
  for (const r of results) {
    const fullMarks = fullMarksById.get(String(r.examId));
    if (fullMarks) {
      sumPercent += (Number(r.marks) / fullMarks) * 100;
      counted += 1;
    }
  }
  return { averagePercent: counted ? Math.round(sumPercent / counted) : null, examsTaken: counted };
}

/**
 * Builds the public-facing view of one student, restricted to
 * `settings.visibleFields` (itself constrained to PUBLIC_INFO_ALLOWED_FIELDS
 * at the schema level — Phase 1 §16). Never includes `_id` or any other
 * Mongo identifier; batch/director are resolved to their display names only.
 */
async function toPublicView(doc: StudentDoc, visibleFields: string[]): Promise<Record<string, unknown>> {
  const want = (field: string) => visibleFields.includes(field);
  const view: Record<string, unknown> = {};

  if (want("name")) view.name = doc.name;
  if (want("registrationId")) view.registrationId = doc.registrationId;
  if (want("rollNumber")) view.rollNumber = doc.currentRollNumber ?? null;
  if (want("course")) view.course = doc.course ?? null;
  if (want("admissionStatus")) view.admissionStatus = doc.status;
  if (want("photo")) view.photo = doc.photoUrl ?? null;

  if ((want("currentBatch") || want("batchDirector")) && doc.currentBatchId) {
    const { Batch } = await import("../batches/batch.model");
    const batch = await Batch.findById(doc.currentBatchId);
    if (want("currentBatch")) view.currentBatch = batch?.name ?? null;
    if (want("batchDirector")) {
      if (batch?.directorId) {
        const { Staff } = await import("../staff/staff.model");
        const director = await Staff.findById(batch.directorId);
        view.batchDirector = director?.name ?? null;
      } else {
        view.batchDirector = null;
      }
    }
  } else {
    if (want("currentBatch")) view.currentBatch = null;
    if (want("batchDirector")) view.batchDirector = null;
  }

  if (want("attendanceSummary")) view.attendanceSummary = await attendanceSummaryFor(String(doc._id));
  if (want("resultSummary")) view.resultSummary = await resultSummaryFor(String(doc._id));

  return view;
}

function buildFilter(method: SearchMethod, q: string): Record<string, unknown> {
  if (method === "registrationId") return { registrationId: q };
  if (method === "phone") return { phone: q };
  return buildSearchFilter(q, ["name"]);
}

export async function search(method: SearchMethod, q: string) {
  const settings = await settingsService.getPublicInfoSettings();
  if (!settings.enabled) throw ApiError.forbidden("Public info search is currently disabled");
  if (!settings.searchMethods[method]) throw ApiError.forbidden(`Search by ${method} is not enabled`);

  const filter = buildFilter(method, q);
  const limit = method === "name" ? NAME_SEARCH_LIMIT : 1;
  const docs = await Student.find(filter).limit(limit);

  return Promise.all(docs.map((doc) => toPublicView(doc, settings.visibleFields)));
}
