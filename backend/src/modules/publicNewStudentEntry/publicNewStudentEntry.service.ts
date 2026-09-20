import { Request } from "express";
import { Course } from "../courses/course.model";
import { Student } from "../students/student.model";
import * as studentService from "../students/student.service";

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

interface RegisterInput {
  name: string;
  rollNumber: string;
  phone: string;
  guardianMobile: string;
  courseId: string;
}

/**
 * A thin wrapper around student.service.ts's create() — the exact same
 * production Student-creation path Admission and Bulk Import already use,
 * not a second implementation. Every field this quick-entry form doesn't
 * collect (dob, address, HSC/SSC info, photo, discount, paid, ...) is simply
 * left absent, the same way an Excel-imported student starts out — the
 * admin or the student themself fills the rest in later through the
 * existing Student Profile, never a parallel data structure.
 */
export async function register(req: Request, input: RegisterInput) {
  // Same "phone identifies one real student" assumption
  // studentImport.rowValidator.ts's own duplicate detection already relies
  // on — a rapid double-submit (network retry, an accidental second click
  // that slipped past the frontend's own disabled-button guard) resolves to
  // the student already created by the first request instead of a second
  // Student document.
  const existing = await Student.findOne({ phone: input.phone });
  if (existing) {
    return {
      name: existing.name,
      rollNumber: existing.currentRollNumber,
      registrationId: existing.registrationId,
      course: existing.course,
    };
  }

  const created = await studentService.create(req, {
    name: input.name,
    phone: input.phone,
    rollNumber: input.rollNumber,
    courseId: input.courseId,
    guardianMobile: input.guardianMobile,
  });

  return {
    name: created.name as string,
    rollNumber: created.currentRollNumber as string | undefined,
    registrationId: created.registrationId as string,
    course: created.course as string | undefined,
  };
}
