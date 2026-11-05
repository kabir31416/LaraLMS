import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../common/utils/ApiError";
import { buildMeta } from "../../common/utils/pagination";
import { localToday } from "../../common/utils/localDate";
import { recordAudit } from "../../audit/auditLog.service";
import { Student } from "../students/student.model";
import { PERMISSIONS } from "../rbac/permissions";
import { IdCard, IdCardDoc } from "./idCard.model";
import {
  CardScope, CardStudentView, ELIGIBLE_STUDENT_FILTER, MAX_BULK, buildStudentViews, cardInstitution, cardSettingsView,
  getCardSettings, idCardFingerprint, inScope, loadStudentViews, oid, randomCode, scopeFor, sortViews, studentSearchFilter,
  STUDENT_CARD_FIELDS, validUntilFor,
} from "./cardCommon";

const scope = (req: Request) => scopeFor(req, PERMISSIONS.ID_CARDS_MANAGE, PERMISSIONS.ID_CARDS_READ_OWN_BATCH);

export interface CardSelector {
  studentIds?: string[];
  batchId?: string;
  courseId?: string;
  all?: boolean;
}

/** Turns "these students / this batch / this course / everyone" into a Student filter, inside the caller's scope. */
function selectorFilter(sel: CardSelector, sc: CardScope): Record<string, unknown> {
  const f: Record<string, unknown> = { ...ELIGIBLE_STUDENT_FILTER };
  if (sel.studentIds?.length) f._id = { $in: sel.studentIds.map(oid) };
  else if (sel.batchId) f.currentBatchId = oid(sel.batchId);
  else if (sel.courseId) f.courseId = oid(sel.courseId);
  else if (!sel.all) throw ApiError.badRequest("শিক্ষার্থী, ব্যাচ বা কোর্স নির্বাচন করুন");
  if (sel.batchId && sel.courseId) f.courseId = oid(sel.courseId);
  if (!sc.all) {
    if (sel.batchId && !inScope(sc, sel.batchId)) throw ApiError.forbidden("এই ব্যাচটি আপনার নয়");
    if (!sel.batchId) f.currentBatchId = { $in: sc.batchIds };
  }
  return f;
}

type CardMeta = { version: number; verifyCode: string; generatedAt: Date; firstIssuedAt: Date; outdated: boolean };

function cardMeta(card: Pick<IdCardDoc, "version" | "verifyCode" | "generatedAt" | "firstIssuedAt" | "fingerprint"> | undefined, v: CardStudentView): CardMeta | null {
  if (!card) return null;
  return { version: card.version, verifyCode: card.verifyCode, generatedAt: card.generatedAt, firstIssuedAt: card.firstIssuedAt, outdated: card.fingerprint !== idCardFingerprint(v) };
}

async function cardsByStudent(ids: (string | Types.ObjectId)[]) {
  const cards = ids.length ? await IdCard.find({ studentId: { $in: ids } }).lean() : [];
  return new Map(cards.map((c) => [String(c.studentId), c]));
}

/** Students with their card status — the ID Card Management table. */
export async function listStudents(req: Request) {
  const sc = await scope(req);
  const q = req.query as Record<string, string | undefined>;
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  const filter: Record<string, unknown> = { ...ELIGIBLE_STUDENT_FILTER, ...studentSearchFilter(q.search) };
  if (q.courseId) filter.courseId = oid(q.courseId);
  if (q.batchId) {
    if (!inScope(sc, q.batchId)) throw ApiError.forbidden("এই ব্যাচটি আপনার নয়");
    filter.currentBatchId = oid(q.batchId);
  } else if (!sc.all) filter.currentBatchId = { $in: sc.batchIds };

  const status = q.cardStatus;
  if (status === "issued" || status === "not_issued" || status === "outdated") {
    const issued = (await IdCard.distinct("studentId")) as Types.ObjectId[];
    const cur = filter._id as Record<string, unknown> | undefined;
    filter._id = { ...(cur ?? {}), [status === "not_issued" ? "$nin" : "$in"]: issued };
  }

  if (status === "outdated") {
    // "Outdated" compares live data with the issued fingerprint, so it is computed, then paged in memory.
    const views = await loadStudentViews(filter, 5000);
    const cards = await cardsByStudent(views.map((v) => v.id));
    const rows = views.map((v) => ({ student: v, card: cardMeta(cards.get(v.id), v) })).filter((r) => r.card?.outdated);
    return { items: rows.slice((page - 1) * limit, page * limit), meta: buildMeta(page, limit, rows.length) };
  }

  const [docs, total] = await Promise.all([
    Student.find(filter).select(STUDENT_CARD_FIELDS).sort({ currentBatchId: 1, currentRollNumber: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Student.countDocuments(filter),
  ]);
  const views = sortViews(await buildStudentViews(docs as never));
  const cards = await cardsByStudent(views.map((v) => v.id));
  return { items: views.map((v) => ({ student: v, card: cardMeta(cards.get(v.id), v) })), meta: buildMeta(page, limit, total) };
}

/** Everything needed to preview/print the selected cards (no writes). */
export async function cardData(req: Request, sel: CardSelector) {
  const sc = await scope(req);
  const views = await loadStudentViews(selectorFilter(sel, sc), MAX_BULK);
  const cards = await cardsByStudent(views.map((v) => v.id));
  const [institution, settings] = await Promise.all([cardInstitution(), getCardSettings()]);
  return {
    institution,
    settings: cardSettingsView(settings),
    cards: views.map((v) => ({ student: v, validUntil: validUntilFor(settings, v), card: cardMeta(cards.get(v.id), v) })),
  };
}

export type GenerateMode = "missing" | "changed" | "all";

/**
 * Issues ID cards. "missing" issues cards only to students without one,
 * "changed" also re-issues cards whose printed details changed, "all"
 * re-issues every selected card. Re-issuing bumps the version and rotates
 * the QR code (the old code then verifies as "replaced"). Idempotent under
 * double clicks: inserts rely on the unique studentId index and re-issues
 * are conditional on the version that was read.
 */
export async function generate(req: Request, sel: CardSelector, mode: GenerateMode) {
  const sc = await scope(req);
  if (!sc.all) throw ApiError.forbidden("ID কার্ড ইস্যু করার অনুমতি নেই");
  const views = await loadStudentViews(selectorFilter(sel, sc), MAX_BULK);
  if (!views.length) throw ApiError.badRequest("নির্বাচনে কোনো সক্রিয় শিক্ষার্থী নেই");
  const cards = await cardsByStudent(views.map((v) => v.id));
  const now = new Date();
  const by = req.user?.id;
  const inserts: Record<string, unknown>[] = [];
  const updates: { filter: Record<string, unknown>; update: Record<string, unknown> }[] = [];
  let skipped = 0;
  for (const v of views) {
    const fp = idCardFingerprint(v);
    const card = cards.get(v.id);
    if (!card) {
      inserts.push({ studentId: oid(v.id), version: 1, verifyCode: randomCode(), previousCodes: [], fingerprint: fp, firstIssuedAt: now, generatedAt: now, generatedBy: by });
    } else if (mode === "all" || (mode === "changed" && card.fingerprint !== fp)) {
      updates.push({
        filter: { _id: card._id, version: card.version },
        update: { $set: { version: card.version + 1, verifyCode: randomCode(), fingerprint: fp, generatedAt: now, generatedBy: by }, $push: { previousCodes: { $each: [card.verifyCode], $slice: -10 } } },
      });
    } else skipped++;
  }
  let created = 0;
  if (inserts.length) {
    try {
      created = (await IdCard.insertMany(inserts, { ordered: false })).length;
    } catch (err) {
      // A concurrent request already issued some of these — those rows are simply not created twice.
      const e = err as { code?: number; insertedDocs?: unknown[]; result?: { insertedCount?: number }; writeErrors?: unknown[] };
      if (e.code !== 11000 && !e.writeErrors) throw err;
      created = e.insertedDocs?.length ?? e.result?.insertedCount ?? 0;
      skipped += inserts.length - created;
    }
  }
  let reissued = 0;
  if (updates.length) {
    const res = await IdCard.bulkWrite(updates.map((u) => ({ updateOne: { filter: u.filter, update: u.update } })), { ordered: false });
    reissued = res.modifiedCount ?? 0;
    skipped += updates.length - reissued;
  }
  await recordAudit({ req, action: "id-card.generate", module: "id-cards", targetCollection: "idcards", after: { mode, selector: { ...sel, studentIds: sel.studentIds?.length }, created, reissued, skipped } });
  return { total: views.length, created, reissued, skipped };
}

/** Overview cards: eligible students, issued, without card, outdated, recently issued. */
export async function stats(req: Request) {
  const sc = await scope(req);
  const filter: Record<string, unknown> = { ...ELIGIBLE_STUDENT_FILTER };
  if (!sc.all) filter.currentBatchId = { $in: sc.batchIds };
  const ids = (await Student.find(filter).distinct("_id")) as Types.ObjectId[];
  const cards = ids.length ? await IdCard.find({ studentId: { $in: ids } }).select("studentId fingerprint generatedAt version").sort({ generatedAt: -1 }).lean() : [];
  const views = cards.length ? await loadStudentViews({ _id: { $in: cards.map((c) => c.studentId) } }, cards.length) : [];
  const viewById = new Map(views.map((v) => [v.id, v]));
  let outdated = 0;
  for (const c of cards) {
    const v = viewById.get(String(c.studentId));
    if (v && c.fingerprint !== idCardFingerprint(v)) outdated++;
  }
  const today = localToday();
  const recent = cards.slice(0, 8).map((c) => {
    const v = viewById.get(String(c.studentId));
    return { studentId: String(c.studentId), name: v?.name ?? "—", code: v?.studentId ?? "", batch: v?.batch ?? null, version: c.version, generatedAt: c.generatedAt };
  });
  return {
    totalStudents: ids.length,
    issued: cards.length,
    withoutCard: ids.length - cards.length,
    outdated,
    issuedToday: cards.filter((c) => localToday(undefined, new Date(c.generatedAt)) === today).length,
    recent,
  };
}

/** Student Portal — the caller's own card only (the id comes from the token, never from the request). */
export async function myCard(req: Request) {
  const sid = req.user?.studentId;
  if (!sid || !Types.ObjectId.isValid(sid)) throw ApiError.forbidden();
  const doc = await Student.findById(sid).select(STUDENT_CARD_FIELDS).lean();
  if (!doc) throw ApiError.notFound("শিক্ষার্থী পাওয়া যায়নি");
  const [view] = await buildStudentViews([doc as never]);
  const card = await IdCard.findOne({ studentId: doc._id }).lean();
  const [institution, settings] = await Promise.all([cardInstitution(), getCardSettings()]);
  if (!card) return { issued: false as const, institution: { name: institution.name } };
  return { issued: true as const, institution, settings: cardSettingsView(settings), cards: [{ student: view, validUntil: validUntilFor(settings, view), card: cardMeta(card, view) }] };
}

/** Public QR check — answers "is this a genuine, current card?" with the minimum needed to compare against the holder. */
export async function verify(code: string) {
  const institution = await cardInstitution();
  const inst = { name: institution.name, logoUrl: institution.logoUrl };
  const card = await IdCard.findOne({ verifyCode: code }).lean();
  if (!card) {
    const old = await IdCard.exists({ previousCodes: code });
    return { kind: "id-card", status: old ? "replaced" : "not_found", institution: inst };
  }
  const doc = await Student.findById(card.studentId).select(STUDENT_CARD_FIELDS).lean();
  if (!doc) return { kind: "id-card", status: "not_found", institution: inst };
  const [v] = await buildStudentViews([doc as never]);
  const settings = await getCardSettings();
  const validUntil = validUntilFor(settings, v);
  const status = v.status !== "সক্রিয়" ? "inactive" : validUntil && validUntil < localToday() ? "expired" : "valid";
  return {
    kind: "id-card",
    status,
    institution: inst,
    student: { name: v.name, studentId: v.studentId, course: v.course, batch: v.batch, photo: v.photo },
    issuedAt: card.generatedAt,
    version: card.version,
    validUntil,
  };
}
