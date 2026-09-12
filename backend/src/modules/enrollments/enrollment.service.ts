import { Request } from "express";
import { BatchEnrollment, BatchEnrollmentDoc } from "./enrollment.model";
import { Student } from "../students/student.model";
import { Batch } from "../batches/batch.model";
import { getSettings } from "../settings/settings.service";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";

/**
 * Roll-number uniqueness, scoped per Settings.rollNumberScope (Phase 1 §13).
 * The DB carries a partial unique index for the default "batch" scope as a
 * backstop; "course" and "global" scopes can't be expressed as a static
 * index (the partition key is a runtime setting), so they're enforced here.
 *
 * NOTE ON CONCURRENCY: this check-then-write is not race-proof without a
 * transaction (two simultaneous requests could both pass the check before
 * either writes). Phase 2 §1 calls for a replica set specifically so this
 * and the transfer below can run inside `session.withTransaction(...)`;
 * that wrapping is intentionally not added yet since it can't be exercised
 * against a real replica set in this environment — the logic here is
 * correct for the single-admin, low-concurrency usage this app has today,
 * and wrapping it in a transaction later is additive, not a rewrite.
 */
async function assertRollAvailable(studentId: string, batchId: string, rollNumber: string): Promise<void> {
  const settings = await getSettings();
  let clash;
  if (settings.rollNumberScope === "global") {
    clash = await Student.findOne({ currentRollNumber: rollNumber, _id: { $ne: studentId } });
  } else if (settings.rollNumberScope === "course") {
    const batch = await Batch.findById(batchId);
    if (!batch) throw ApiError.notFound("Batch not found");
    const sisterBatchIds = await Batch.find({ courseId: batch.courseId }).distinct("_id");
    clash = await Student.findOne({ currentBatchId: { $in: sisterBatchIds }, currentRollNumber: rollNumber, _id: { $ne: studentId } });
  } else {
    clash = await Student.findOne({ currentBatchId: batchId, currentRollNumber: rollNumber, _id: { $ne: studentId } });
  }
  if (clash) throw ApiError.conflict(`Roll number "${rollNumber}" is already in use in this ${settings.rollNumberScope === "global" ? "system" : settings.rollNumberScope}`);
}

export async function getActiveByStudent(studentId: string): Promise<BatchEnrollmentDoc | null> {
  return BatchEnrollment.findOne({ studentId, status: "active" });
}

export async function listByStudent(studentId: string): Promise<BatchEnrollmentDoc[]> {
  return BatchEnrollment.find({ studentId }).sort({ startDate: -1 });
}

export async function getRoster(batchId: string) {
  const enrollments = await BatchEnrollment.find({ batchId, status: "active" }).sort({ rollNumber: 1 });
  const studentIds = enrollments.map((e) => e.studentId);
  const students = await Student.find({ _id: { $in: studentIds } });
  const byId = new Map(students.map((s) => [String(s._id), s]));
  return enrollments.map((e) => ({ enrollment: e, student: byId.get(String(e.studentId)) })).filter((r) => r.student);
}

export async function enrollStudent(req: Request, studentId: string, batchId: string): Promise<BatchEnrollmentDoc> {
  const [student, batch, existingActive] = await Promise.all([
    Student.findById(studentId),
    Batch.findById(batchId),
    getActiveByStudent(studentId),
  ]);
  if (!student) throw ApiError.notFound("Student not found");
  if (!batch) throw ApiError.notFound("Batch not found");
  if (existingActive) throw ApiError.conflict("This student is already enrolled in a batch — use transfer instead of enroll");

  if (student.currentRollNumber) await assertRollAvailable(studentId, batchId, student.currentRollNumber);

  const enrollment = await BatchEnrollment.create({
    studentId,
    batchId,
    courseId: batch.courseId,
    rollNumber: student.currentRollNumber,
    startDate: new Date(),
    status: "active",
    createdBy: req.user?.id,
  });

  student.currentBatchId = batch._id as never;
  await student.save();

  await recordAudit({ req, action: "enrollment.create", module: "enrollments", targetCollection: "batchenrollments", targetId: String(enrollment._id), after: enrollment.toObject() });
  return enrollment;
}

export async function enrollBulk(req: Request, batchId: string, studentIds: string[]) {
  const succeeded: string[] = [];
  const failed: { studentId: string; reason: string }[] = [];
  for (const studentId of studentIds) {
    try {
      await enrollStudent(req, studentId, batchId);
      succeeded.push(studentId);
    } catch (err) {
      failed.push({ studentId, reason: err instanceof ApiError ? err.message : "Unknown error" });
    }
  }
  return { succeeded, failed };
}

export async function transferStudent(
  req: Request,
  studentId: string,
  toBatchId: string,
  reason: string,
  newRollNumber?: string,
): Promise<BatchEnrollmentDoc> {
  const [student, toBatch, current] = await Promise.all([
    Student.findById(studentId),
    Batch.findById(toBatchId),
    getActiveByStudent(studentId),
  ]);
  if (!student) throw ApiError.notFound("Student not found");
  if (!toBatch) throw ApiError.notFound("Destination batch not found");
  if (!current) throw ApiError.conflict("This student has no active enrollment to transfer — use enroll instead");
  if (String(current.batchId) === String(toBatchId)) throw ApiError.badRequest("Student is already in this batch");
  if (!reason?.trim()) throw ApiError.badRequest("A transfer reason is required");

  const rollForNewBatch = newRollNumber?.trim() || student.currentRollNumber;
  if (rollForNewBatch) await assertRollAvailable(studentId, toBatchId, rollForNewBatch);

  // Close the old stint — historical attendance/results already reference
  // this enrollment's id directly, so closing it never touches their data (Phase 1 §14).
  const before = current.toObject();
  current.status = "transferred";
  current.endDate = new Date();
  current.transferReason = reason;
  await current.save();

  const next = await BatchEnrollment.create({
    studentId,
    batchId: toBatchId,
    courseId: toBatch.courseId,
    rollNumber: rollForNewBatch,
    startDate: new Date(),
    status: "active",
    previousEnrollmentId: current._id,
    createdBy: req.user?.id,
  });

  student.currentBatchId = toBatch._id as never;
  if (newRollNumber?.trim()) student.currentRollNumber = newRollNumber.trim();
  await student.save();

  await recordAudit({
    req,
    action: "enrollment.transfer",
    module: "enrollments",
    targetCollection: "batchenrollments",
    targetId: String(current._id),
    before,
    after: { closed: current.toObject(), opened: next.toObject() },
  });
  return next;
}

export async function withdrawStudent(req: Request, studentId: string, reason?: string): Promise<void> {
  const current = await getActiveByStudent(studentId);
  if (!current) throw ApiError.conflict("This student has no active enrollment to withdraw from");
  const before = current.toObject();
  current.status = "withdrawn";
  current.endDate = new Date();
  current.transferReason = reason;
  await current.save();

  await Student.findByIdAndUpdate(studentId, { $unset: { currentBatchId: 1 } });

  await recordAudit({ req, action: "enrollment.withdraw", module: "enrollments", targetCollection: "batchenrollments", targetId: String(current._id), before, after: current.toObject() });
}

/** Guards Batch delete (Module 12) — Phase 1 §4's missing-delete-guard finding. */
export async function hasActiveEnrollments(batchId: string): Promise<boolean> {
  return (await BatchEnrollment.exists({ batchId, status: "active" })) !== null;
}
