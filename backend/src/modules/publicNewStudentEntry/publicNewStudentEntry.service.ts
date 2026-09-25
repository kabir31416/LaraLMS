import { Request } from "express";
import { Course } from "../courses/course.model";
import { Student } from "../students/student.model";
import * as studentService from "../students/student.service";
import * as batchService from "../batches/batch.service";

/**
 * The public /newstudententry quick-admission form's course dropdown —
 * reuses the exact same Course collection/model every other course picker
 * in this app reads, projected down to just {_id, name} (no fee/duration/
 * session — nothing a public, unauthenticated caller needs) and limited to
 * currently active courses, the same "সক্রিয়" status AcademicContext's own
 * `activeCourses` filter already uses for the Admin Admission form's course
 * dropdown (Course status is otherwise unenforced at create() time, exactly
 * like the Admin Admission flow — this list is a UI-level filter, not a new
 * business rule).
 */
export async function listActiveCourses() {
  return Course.find({ status: "সক্রিয়" }).select("name").sort({ displayOrder: 1, name: 1 });
}

/** The form's course-scoped Batch dropdown — every batch belonging to the selected course, nothing else (Student Entry Workflow §4). */
export async function listBatchesForCourse(courseId: string) {
  const { Batch } = await import("../batches/batch.model");
  return Batch.find({ courseId }).select("name batchTime").sort({ name: 1 });
}

interface RegisterInput {
  name: string;
  rollNumber: string;
  phone: string;
  guardianMobile: string;
  courseId: string;
  batchId: string;
  photoBuffer?: Buffer;
}

/**
 * A thin wrapper around student.service.ts's create() — the exact same
 * production Student-creation path Admission and Bulk Import already use,
 * not a second implementation. Every field this quick-entry form doesn't
 * collect (dob, address, HSC/SSC info, discount, paid, ...) is simply left
 * absent, the same way an Excel-imported student starts out — the admin or
 * the student themself fills the rest in later through the existing Student
 * Profile, never a parallel data structure.
 *
 * Student Entry Workflow — this no longer creates an immediately-active,
 * unenrolled student. It creates a `"pending"` application: the backend
 * re-validates the Course/Batch pair itself (never trusting the submitted
 * ids blindly), records which batch was requested, and leaves actual
 * enrollment/activation to an Admin's later approve-entry action.
 */
export async function register(req: Request, input: RegisterInput) {
  await batchService.assertBatchBelongsToCourse(input.batchId, input.courseId);

  // Same "phone identifies one real student" assumption
  // studentImport.rowValidator.ts's own duplicate detection already relies
  // on — a rapid double-submit (network retry, an accidental second click
  // that slipped past the frontend's own disabled-button guard) resolves to
  // the application already created by the first request instead of a
  // second Student document.
  const existing = await Student.findOne({ phone: input.phone });
  if (existing) {
    return {
      name: existing.name,
      rollNumber: existing.currentRollNumber,
      registrationId: existing.registrationId,
      course: existing.course,
      admissionStatus: existing.admissionStatus || "approved",
    };
  }

  const created = await studentService.create(req, {
    name: input.name,
    phone: input.phone,
    rollNumber: input.rollNumber,
    courseId: input.courseId,
    guardianMobile: input.guardianMobile,
    admissionStatus: "pending",
    requestedBatchId: input.batchId,
  });

  if (input.photoBuffer) {
    await studentService.applyPhotoUpload(req, String((created as Record<string, unknown>)._id), input.photoBuffer);
  }

  return {
    name: created.name as string,
    rollNumber: created.currentRollNumber as string | undefined,
    registrationId: created.registrationId as string,
    course: created.course as string | undefined,
    admissionStatus: "pending" as const,
  };
}
