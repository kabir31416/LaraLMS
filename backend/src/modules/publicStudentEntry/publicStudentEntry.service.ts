import { Request } from "express";
import { Student, StudentDoc } from "../students/student.model";
import * as studentService from "../students/student.service";
import * as guardianService from "../guardians/guardian.service";
import { normalizePhoneForLookup } from "../auth/auth.service";
import { toAsciiDigits } from "../../common/utils/digits";
import { signShortLivedToken } from "../../common/utils/jwt";
import { ApiError } from "../../common/utils/ApiError";
import { env } from "../../config/env";

const VERIFY_ERROR = "শিক্ষার্থীর তথ্য যাচাই করা যায়নি। রেজিস্ট্রেশন নম্বর/রোল ও মোবাইল নম্বর আবার পরীক্ষা করুন।";

/**
 * Verifies a Registration ID *or* Roll Number together with phone against
 * the same Student record — the same generic-error-either-way pattern as
 * auth.service.ts's login()/studentLogin() (Public Security §11: never
 * reveal which field was wrong). Issues a short-lived, purpose-scoped token
 * (studentEntryAuth.middleware.ts) rather than exposing the student's
 * MongoDB _id or any admin-style session — the token IS the only handle the
 * rest of this workflow ever gets to identify "which student."
 */
export async function verify(identifier: string, phone: string): Promise<{ token: string }> {
  const normalizedPhone = normalizePhoneForLookup(phone);
  const normalizedIdentifier = toAsciiDigits(identifier).trim();
  if (!normalizedPhone || !normalizedIdentifier) throw ApiError.unauthorized(VERIFY_ERROR);

  const student = await Student.findOne({
    phone: normalizedPhone,
    $or: [{ currentRollNumber: normalizedIdentifier }, { registrationId: normalizedIdentifier }],
  });
  if (!student) throw ApiError.unauthorized(VERIFY_ERROR);

  const token = signShortLivedToken({ purpose: "student-entry", studentId: String(student._id) }, env.STUDENT_ENTRY_TOKEN_EXPIRES_IN);
  return { token };
}

async function getVerifiedStudent(studentId: string): Promise<StudentDoc> {
  const doc = await Student.findById(studentId);
  // The token was already verified by studentEntryAuth.middleware.ts — a
  // missing student here only happens if the record was deleted after the
  // token was issued, not a client trying to reach someone else's data
  // (Public Security §15 — the ID never comes from the client at all).
  if (!doc) throw ApiError.notFound("Student not found");
  return doc;
}

/**
 * A deliberately narrow, hand-picked view — never the full document
 * (student.service.ts's withGuardian/toObject() includes fees, payments,
 * internal IDs, etc.). Same allowlist philosophy as publicInfo.service.ts's
 * toPublicView, just fixed rather than admin-configurable, since this page
 * is a self-service workflow, not a visitor lookup. Includes the
 * self-editable fields too (read-only display + pre-fill for the edit
 * form), but never registrationId's sibling identity fields beyond what's
 * explicitly listed here.
 */
async function toEntryProfileView(doc: StudentDoc): Promise<Record<string, unknown>> {
  const guardian = await guardianService.getPrimary(String(doc._id));

  let batchName: string | null = null;
  if (doc.currentBatchId) {
    const { Batch } = await import("../batches/batch.model");
    const batch = await Batch.findById(doc.currentBatchId).select("name");
    batchName = batch?.name ?? null;
  }

  return {
    name: doc.name,
    registrationId: doc.registrationId,
    rollNumber: doc.currentRollNumber ?? null,
    phone: doc.phone,
    dob: doc.dob ?? null,
    photo: doc.photoUrl ?? null,
    course: doc.course ?? null,
    batchName,
    guardianMobile: guardian?.phone ?? null,
    // Editable subset — mirrors updatePublicProfileSchema exactly.
    presentAddress: doc.presentAddress ?? "",
    permanentAddress: doc.permanentAddress ?? "",
    division: doc.division ?? "",
    district: doc.district ?? "",
    upazila: doc.upazila ?? "",
    postOffice: doc.postOffice ?? "",
    postcode: doc.postcode ?? "",
    village: doc.village ?? "",
    hscInstitution: doc.hscInstitution ?? "",
    hscBoard: doc.hscBoard ?? "",
    hscPassingYear: doc.hscPassingYear ?? "",
    hscGroup: doc.hscGroup ?? "",
    hscGpa: doc.hscGpa ?? "",
    hscRoll: doc.hscRoll ?? "",
    hscRegistrationNumber: doc.hscRegistrationNumber ?? "",
    sscInstitution: doc.sscInstitution ?? "",
    sscBoard: doc.sscBoard ?? "",
    sscPassingYear: doc.sscPassingYear ?? "",
    sscGroup: doc.sscGroup ?? "",
    sscGpa: doc.sscGpa ?? "",
    sscRoll: doc.sscRoll ?? "",
    sscRegistrationNumber: doc.sscRegistrationNumber ?? "",
    guardianName: guardian?.name ?? "",
    guardianRelation: guardian?.relation ?? "",
    guardianOccupation: guardian?.occupation ?? "",
    guardianAddress: guardian?.address ?? "",
  };
}

export async function getProfile(studentId: string): Promise<Record<string, unknown>> {
  const doc = await getVerifiedStudent(studentId);
  return toEntryProfileView(doc);
}

/** The patch is already whitelisted by updatePublicProfileSchema (.strict()) — reuses student.service.ts's updateSelf so this never re-implements HSC-master-data sync, guardian upsert, or profile-completion refresh a second time. */
export async function updateProfile(req: Request, studentId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  await getVerifiedStudent(studentId); // 404s cleanly if the record vanished since the token was issued
  await studentService.updateSelf(req, studentId, patch);
  const doc = await getVerifiedStudent(studentId);
  return toEntryProfileView(doc);
}

/** Reuses the exact same upload/replace pipeline as the Admin and Student Portal photo endpoints (student.service.ts's applyPhotoUpload) — same Cloudinary folder, same 1:1 transform, same old-asset cleanup. */
export async function uploadPhoto(req: Request, studentId: string, fileBuffer: Buffer): Promise<Record<string, unknown>> {
  await getVerifiedStudent(studentId);
  const doc = await studentService.applyPhotoUpload(req, studentId, fileBuffer);
  return toEntryProfileView(doc);
}
