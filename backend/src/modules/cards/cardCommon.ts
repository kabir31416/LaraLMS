import { createHash, randomBytes } from "crypto";
import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../common/utils/ApiError";
import { getOrCreateSingleton } from "../../common/utils/singleton";
import { recordAudit } from "../../audit/auditLog.service";
import { Student } from "../students/student.model";
import { Course } from "../courses/course.model";
import { Batch } from "../batches/batch.model";
import { AcademicSession } from "../academicSessions/academicSession.model";
import { Guardian } from "../guardians/guardian.model";
import { getInstitutionSettings } from "../settings/institution.service";
import { CardSettings, CardSettingsDoc } from "./cardSettings.model";

/** Active, admitted students — the only ones who get ID cards or can be assigned to an exam. */
export const ELIGIBLE_STUDENT_FILTER = { status: "সক্রিয়", admissionStatus: { $nin: ["pending", "rejected"] } } as const;

/** Bulk operations are capped per request so one click stays one bounded request. */
export const MAX_BULK = 1000;

/**
 * "Which students may this caller see?" — permission-based, not role-based:
 * a holder of the manage permission (Admin has "*") sees everyone; a holder
 * of the own-batch permission (Batch Director) sees only students whose batch
 * lists them as a director; anyone else is refused.
 */
export type CardScope = { all: true } | { all: false; batchIds: Types.ObjectId[] };

export async function scopeFor(req: Request, managePerm: string, ownBatchPerm: string): Promise<CardScope> {
  const u = req.user;
  if (!u) throw ApiError.unauthorized();
  if (u.permissions.includes("*") || u.permissions.includes(managePerm)) return { all: true };
  if (u.permissions.includes(ownBatchPerm) && u.staffId && Types.ObjectId.isValid(u.staffId)) {
    const ids = (await Batch.find({ directorIds: new Types.ObjectId(u.staffId) }).distinct("_id")) as Types.ObjectId[];
    return { all: false, batchIds: ids };
  }
  throw ApiError.forbidden("অনুমতি নেই");
}

export const inScope = (scope: CardScope, batchId: unknown): boolean =>
  scope.all || (!!batchId && scope.batchIds.some((b) => String(b) === String(batchId)));

export const canManage = (req: Request, perm: string): boolean =>
  !!req.user && (req.user.permissions.includes("*") || req.user.permissions.includes(perm));

export const randomCode = (): string => randomBytes(16).toString("base64url");

export const oid = (v: string): Types.ObjectId => new Types.ObjectId(v);

export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Name / Student ID / registration number / phone search — the same fields the Student List searches. */
export function studentSearchFilter(search: unknown): Record<string, unknown> {
  if (typeof search !== "string" || !search.trim()) return {};
  const r = new RegExp(escapeRegex(search.trim()), "i");
  return { $or: [{ name: r }, { registrationId: r }, { currentRollNumber: r }, { phone: r }] };
}

export async function getCardSettings(): Promise<CardSettingsDoc> {
  return getOrCreateSingleton(CardSettings, {} as CardSettingsDoc);
}

export async function updateCardSettings(req: Request, patch: Partial<CardSettingsDoc>): Promise<CardSettingsDoc> {
  const settings = await getCardSettings();
  const before = settings.toObject();
  Object.assign(settings, patch);
  await settings.save();
  await recordAudit({ req, action: "settings.cards.update", module: "settings", targetCollection: "cardsettings", targetId: String(settings._id), before, after: settings.toObject() });
  return settings;
}

/** Institution branding + contact for printed cards (never receipt internals). */
export async function cardInstitution() {
  const i = await getInstitutionSettings();
  return {
    name: i.name,
    shortName: i.shortName,
    logoUrl: i.logoUrl,
    address: i.address,
    phone: i.phone,
    email: i.email,
    website: i.website,
    signatureLabel: i.print?.signatureLabel || "অনুমোদিতকারী",
    showLogo: i.print?.showLogoOnDocuments !== false,
  };
}

export function cardSettingsView(s: CardSettingsDoc) {
  return {
    primaryColor: s.primaryColor,
    idCardLayout: s.idCardLayout,
    idCardShowBack: s.idCardShowBack,
    validityMode: s.validityMode,
    validUntil: s.validUntil,
    idCardRules: s.idCardRules,
    idCardShowEmergencyContact: s.idCardShowEmergencyContact,
    idCardShowQr: s.idCardShowQr,
    admitShowQr: s.admitShowQr,
    admitDefaultInstructions: s.admitDefaultInstructions,
    admitCardsPerPage: s.admitCardsPerPage,
  };
}

/**
 * What a card prints about a student. `studentId` is the permanent,
 * system-generated Student ID (Student.registrationId); `registrationNumber`
 * is the academic registration number (Student.currentRollNumber, shown as
 * "রেজিস্ট্রেশন নম্বর" everywhere in the app). The two are never mixed.
 */
export interface CardStudentView {
  id: string;
  name: string;
  studentId: string;
  registrationNumber: string | null;
  photo: string | null;
  phone: string | null;
  bloodGroup: string | null;
  courseId: string | null;
  course: string | null;
  batchId: string | null;
  batch: string | null;
  session: string | null;
  sessionEnd: string | null;
  emergencyContact: string | null;
  status: string;
}

type LeanStudent = {
  _id: Types.ObjectId;
  name: string;
  registrationId: string;
  currentRollNumber?: string;
  photoUrl?: string;
  phone?: string;
  bloodGroup?: string;
  courseId?: Types.ObjectId;
  course?: string;
  currentBatchId?: Types.ObjectId;
  status: string;
  admissionStatus?: string;
};

export const STUDENT_CARD_FIELDS = "name registrationId currentRollNumber photoUrl phone bloodGroup courseId course currentBatchId status admissionStatus";

/** Resolves course, batch, session and primary guardian for many students with one query per collection (no N+1). */
export async function buildStudentViews(students: LeanStudent[]): Promise<CardStudentView[]> {
  if (!students.length) return [];
  const courseIds = [...new Set(students.map((s) => s.courseId).filter(Boolean).map(String))];
  const batchIds = [...new Set(students.map((s) => s.currentBatchId).filter(Boolean).map(String))];
  const [courses, batches, guardians] = await Promise.all([
    courseIds.length ? Course.find({ _id: { $in: courseIds } }).select("name sessionId").lean() : [],
    batchIds.length ? Batch.find({ _id: { $in: batchIds } }).select("name").lean() : [],
    Guardian.find({ studentId: { $in: students.map((s) => s._id) } }).select("studentId phone isPrimary").lean(),
  ]);
  const sessionIds = [...new Set(courses.map((c) => c.sessionId).filter(Boolean).map(String))];
  const sessions = sessionIds.length ? await AcademicSession.find({ _id: { $in: sessionIds } }).select("name endDate").lean() : [];
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const batchById = new Map(batches.map((b) => [String(b._id), b]));
  const sessionById = new Map(sessions.map((s) => [String(s._id), s]));
  const guardianByStudent = new Map<string, { phone: string; isPrimary?: boolean }>();
  for (const g of guardians) {
    const k = String(g.studentId);
    const cur = guardianByStudent.get(k);
    if (!cur || (g.isPrimary && !cur.isPrimary)) guardianByStudent.set(k, g);
  }
  return students.map((s) => {
    const course = s.courseId ? courseById.get(String(s.courseId)) : undefined;
    const session = course?.sessionId ? sessionById.get(String(course.sessionId)) : undefined;
    const end = session?.endDate ? new Date(session.endDate) : null;
    return {
      id: String(s._id),
      name: s.name,
      studentId: s.registrationId,
      registrationNumber: s.currentRollNumber || null,
      photo: s.photoUrl || null,
      phone: s.phone || null,
      bloodGroup: s.bloodGroup || null,
      courseId: s.courseId ? String(s.courseId) : null,
      course: course?.name ?? s.course ?? null,
      batchId: s.currentBatchId ? String(s.currentBatchId) : null,
      batch: s.currentBatchId ? batchById.get(String(s.currentBatchId))?.name ?? null : null,
      session: session?.name ?? null,
      sessionEnd: end && !Number.isNaN(end.getTime()) ? end.toISOString().slice(0, 10) : null,
      emergencyContact: guardianByStudent.get(String(s._id))?.phone ?? null,
      status: s.status,
    };
  });
}

/** Hash of everything printed on an ID card — a different value means the issued card is outdated. */
export function idCardFingerprint(v: CardStudentView): string {
  const printed = [v.name, v.studentId, v.registrationNumber, v.photo, v.phone, v.bloodGroup, v.course, v.batch, v.session, v.sessionEnd, v.emergencyContact];
  return createHash("sha256").update(JSON.stringify(printed)).digest("hex").slice(0, 32);
}

export async function loadStudentViews(filter: Record<string, unknown>, limit = MAX_BULK): Promise<CardStudentView[]> {
  const docs = (await Student.find(filter).select(STUDENT_CARD_FIELDS).sort({ _id: 1 }).limit(limit).lean()) as unknown as LeanStudent[];
  return sortViews(await buildStudentViews(docs));
}

const collator = new Intl.Collator("bn", { numeric: true });
/** Batch, then registration number (numeric-aware), then name — the order cards are printed and cut in. */
export function sortViews<T extends Pick<CardStudentView, "batch" | "registrationNumber" | "name">>(views: T[]): T[] {
  return views.sort((a, b) => collator.compare(a.batch ?? "\uffff", b.batch ?? "\uffff") || collator.compare(a.registrationNumber ?? "\uffff", b.registrationNumber ?? "\uffff") || collator.compare(a.name, b.name));
}

/** The date a card stops being valid, per the configured validity mode. */
export function validUntilFor(settings: Pick<CardSettingsDoc, "validityMode" | "validUntil">, v: Pick<CardStudentView, "sessionEnd">): string | null {
  if (settings.validityMode === "date") return settings.validUntil || null;
  if (settings.validityMode === "session") return v.sessionEnd;
  return null;
}
