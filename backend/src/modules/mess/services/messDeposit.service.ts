import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../../common/utils/ApiError";
import { recordAudit } from "../../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../../common/utils/pagination";
import { generateSequenceCode } from "../../../common/utils/idGenerators";
import { PERMISSIONS } from "../../rbac/permissions";
import { MessMembership, MessMembershipDoc } from "../models/messMembership.model";
import { MessDepositTransaction, MessDepositTransactionDoc } from "../models/messDepositTransaction.model";
import { MessSettlement, MessSettlementDoc } from "../models/messSettlement.model";
import { assertMessAccess, hasPerm, messScopeFilter } from "../mess.scope";
import { DepositTxType } from "../mess.constants";
import { actorId, isDuplicateKeyError, money, statusFlags, todayISO, toObjectId } from "../mess.utils";
import { assertMessPaymentMethod, getMessSettings } from "./messSettings.service";
import { computeBalances, LedgerBalances, recomputeLedger } from "./messLedger.service";
import { getMembershipOrThrow, resolveStudentFilter } from "./messMembership.service";
import { releaseSeat } from "./messSetup.service";

function assertApprover(req: Request) {
  if (!hasPerm(req, PERMISSIONS.MESS_FINANCE_APPROVE)) throw ApiError.forbidden("আর্থিক অনুমোদনের অনুমতি আপনার নেই");
}

/** Deposit money not yet earmarked by any pending/approved-but-unpaid movement. */
async function availableDeposit(membershipId: Types.ObjectId, excludeTxId?: Types.ObjectId): Promise<{ balances: LedgerBalances; available: number }> {
  const balances = await computeBalances(membershipId);
  const pending = await MessDepositTransaction.aggregate<{ _id: null; total: number }>([
    {
      $match: {
        membershipId,
        ...(excludeTxId ? { _id: { $ne: excludeTxId } } : {}),
        $or: [{ status: "pending" }, { type: "refund", status: "approved" }],
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return { balances, available: money(balances.depositBalance - (pending[0]?.total ?? 0)) };
}

// -------------------- Deposit movements --------------------

export async function listDepositTransactions(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = {};
  const scope = await messScopeFilter(req, req.query.messId);
  if (scope) filter.messId = scope;
  for (const key of ["type", "status"] as const) {
    if (typeof req.query[key] === "string" && req.query[key]) filter[key] = req.query[key];
  }
  if (typeof req.query.membershipId === "string" && Types.ObjectId.isValid(req.query.membershipId)) filter.membershipId = new Types.ObjectId(req.query.membershipId);
  if (req.query.dateFrom || req.query.dateTo) {
    filter.date = { ...(req.query.dateFrom ? { $gte: String(req.query.dateFrom) } : {}), ...(req.query.dateTo ? { $lte: String(req.query.dateTo) } : {}) };
  }
  const studentIds = await resolveStudentFilter(req);
  if (studentIds) filter.studentId = { $in: studentIds };
  const [items, total] = await Promise.all([
    MessDepositTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("studentId", "name registrationId currentRollNumber phone")
      .populate("messId", "name")
      .populate("membershipId", "membershipNo")
      .lean(),
    MessDepositTransaction.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function createDepositTransaction(
  req: Request,
  membershipId: string,
  body: { type: DepositTxType; amount: number; reason?: string; method?: string; reference?: string; date?: string; period?: string },
): Promise<MessDepositTransactionDoc> {
  const m = await getMembershipOrThrow(req, membershipId);
  if (m.status === "cancelled") throw ApiError.badRequest("বাতিল সদস্যপদে জামানত লেনদেন করা যাবে না");
  if (await MessSettlement.exists({ membershipId: m._id, status: { $in: ["pending", "approved"] } })) {
    throw ApiError.conflict("চূড়ান্ত নিষ্পত্তি চলমান — জামানত সেখান থেকেই সমন্বয় হবে");
  }
  const amount = money(body.amount);
  if (amount <= 0) throw ApiError.badRequest("পরিমাণ শূন্যের বেশি হতে হবে");
  const { balances, available } = await availableDeposit(m._id as Types.ObjectId);
  if (amount > available) throw ApiError.badRequest(`জামানতে ব্যবহারযোগ্য আছে মাত্র ৳${Math.max(0, available)}`);
  if (body.type === "apply_to_due" && amount > balances.due) throw ApiError.badRequest(`বকেয়া মাত্র ৳${balances.due} — এর বেশি সমন্বয় করা যাবে না`);
  if (body.type === "refund" && body.method) await assertMessPaymentMethod(body.method);
  if (body.type !== "refund" && !body.reason?.trim()) throw ApiError.badRequest("কারণ লিখুন");

  const settings = await getMessSettings();
  const isApprover = hasPerm(req, PERMISSIONS.MESS_FINANCE_APPROVE);
  // Deductions/applications are effective once approved; refunds additionally need the money paid out ("completed").
  const needsApproval = body.type === "refund" ? settings.refundApprovalRequired && !isApprover : !isApprover;
  const doc = await MessDepositTransaction.create({
    txNo: await generateSequenceCode("mess_deposit_tx", "MDT", 5, true),
    membershipId: m._id,
    studentId: m.studentId,
    messId: m.messId,
    type: body.type,
    amount,
    reason: body.reason,
    date: body.date || todayISO(),
    status: needsApproval ? "pending" : "approved",
    method: body.method,
    reference: body.reference,
    // "Which month was the advance used for" — recorded for a manual apply_to_due (advance rule "manual").
    period: body.type === "apply_to_due" ? body.period || todayISO().slice(0, 7) : undefined,
    source: "manual",
    requestedBy: actorId(req),
    ...(needsApproval ? {} : { approvedBy: actorId(req), approvedAt: new Date() }),
  });
  await recomputeLedger(m._id as Types.ObjectId);
  await recordAudit({ req, action: `mess.deposit.${body.type}.create`, module: "mess", targetCollection: "messdeposittransactions", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

async function getDepositTxOrThrow(req: Request, id: string): Promise<MessDepositTransactionDoc> {
  const tx = await MessDepositTransaction.findById(toObjectId(id, "transactionId"));
  if (!tx) throw ApiError.notFound("Deposit transaction not found");
  await assertMessAccess(req, tx.messId);
  return tx;
}

export async function approveDepositTransaction(req: Request, id: string): Promise<MessDepositTransactionDoc> {
  assertApprover(req);
  const tx = await getDepositTxOrThrow(req, id);
  if (tx.status !== "pending") throw ApiError.badRequest("শুধু অপেক্ষমাণ অনুরোধ অনুমোদন করা যায়");
  const { balances, available } = await availableDeposit(tx.membershipId, tx._id as Types.ObjectId);
  if (tx.amount > available) throw ApiError.badRequest(`জামানতে ব্যবহারযোগ্য আছে মাত্র ৳${Math.max(0, available)}`);
  if (tx.type === "apply_to_due" && tx.amount > balances.due) throw ApiError.badRequest(`বকেয়া মাত্র ৳${balances.due}`);
  const updated = await MessDepositTransaction.findOneAndUpdate(
    { _id: tx._id, status: "pending" },
    { $set: { status: "approved", approvedBy: actorId(req), approvedAt: new Date() } },
    { new: true },
  );
  if (!updated) throw ApiError.conflict("অনুরোধটি ইতিমধ্যে প্রক্রিয়া হয়েছে");
  await recomputeLedger(tx.membershipId);
  await recordAudit({ req, action: "mess.deposit.approve", module: "mess", targetCollection: "messdeposittransactions", targetId: id, before: { status: "pending" }, after: { status: "approved" } });
  return updated;
}

export async function rejectDepositTransaction(req: Request, id: string, reason: string): Promise<MessDepositTransactionDoc> {
  assertApprover(req);
  const tx = await getDepositTxOrThrow(req, id);
  const updated = await MessDepositTransaction.findOneAndUpdate(
    { _id: tx._id, status: "pending" },
    { $set: { status: "rejected", rejectedReason: reason, approvedBy: actorId(req), approvedAt: new Date() } },
    { new: true },
  );
  if (!updated) throw ApiError.badRequest("শুধু অপেক্ষমাণ অনুরোধ প্রত্যাখ্যান করা যায়");
  await recomputeLedger(tx.membershipId);
  await recordAudit({ req, action: "mess.deposit.reject", module: "mess", targetCollection: "messdeposittransactions", targetId: id, after: { status: "rejected", reason } });
  return updated;
}

/** Records that an approved refund was actually paid out to the student. */
export async function completeRefund(req: Request, id: string, body: { method: string; date?: string; reference?: string }): Promise<MessDepositTransactionDoc> {
  const tx = await getDepositTxOrThrow(req, id);
  if (tx.type !== "refund") throw ApiError.badRequest("এটি ফেরতের লেনদেন নয়");
  if (tx.status !== "approved") throw ApiError.badRequest("শুধু অনুমোদিত ফেরত পরিশোধ করা যায়");
  await assertMessPaymentMethod(body.method);
  const updated = await MessDepositTransaction.findOneAndUpdate(
    { _id: tx._id, status: "approved" },
    { $set: { status: "completed", method: body.method, reference: body.reference, date: body.date || todayISO(), completedBy: actorId(req), completedAt: new Date() } },
    { new: true },
  );
  if (!updated) throw ApiError.conflict("ফেরতটি ইতিমধ্যে প্রক্রিয়া হয়েছে");
  await recomputeLedger(tx.membershipId);
  await recordAudit({ req, action: "mess.deposit.refund.complete", module: "mess", targetCollection: "messdeposittransactions", targetId: id, after: updated.toObject() });
  return updated;
}

/** Reverses an approved (not yet paid) movement. Settlement-posted movements are reversed only by cancelling nothing — they are final. */
export async function cancelDepositTransaction(req: Request, id: string, reason: string): Promise<MessDepositTransactionDoc> {
  assertApprover(req);
  const tx = await getDepositTxOrThrow(req, id);
  if (tx.settlementId) throw ApiError.badRequest("চূড়ান্ত নিষ্পত্তির লেনদেন বাতিল করা যাবে না");
  if (tx.status === "completed" && tx.type === "refund") throw ApiError.badRequest("পরিশোধিত ফেরত বাতিল করা যাবে না");
  const updated = await MessDepositTransaction.findOneAndUpdate(
    { _id: tx._id, status: { $in: ["pending", "approved"] } },
    { $set: { status: "cancelled", rejectedReason: reason } },
    { new: true },
  );
  if (!updated) throw ApiError.badRequest("এই লেনদেন বাতিল করা যাবে না");
  await recomputeLedger(tx.membershipId);
  await recordAudit({ req, action: "mess.deposit.cancel", module: "mess", targetCollection: "messdeposittransactions", targetId: id, before: { status: tx.status }, after: { status: "cancelled", reason } });
  return updated;
}

// -------------------- Final settlement --------------------

export interface SettlementFigures {
  depositBalance: number;
  advanceBalance: number;
  outstandingDue: number;
  damageCharges: number;
  depositApplied: number;
  depositRefund: number;
  advanceRefund: number;
  refundableAmount: number;
  remainingDue: number;
}

/**
 * Security Deposit + Advance − Outstanding Due − Damage = Refundable.
 * The deposit first covers whatever is owed (due + damage − advance); what's
 * left of it is refunded, and any advance beyond what's owed is refunded too.
 */
export function computeSettlement(b: Pick<LedgerBalances, "depositBalance" | "advance" | "due">, damageCharges: number): SettlementFigures {
  const P = money(Math.max(0, b.depositBalance));
  const A = money(b.advance);
  const D = money(b.due);
  const X = money(damageCharges);
  const owed = money(D + X - A);
  const depositApplied = money(Math.min(P, Math.max(0, owed)));
  return {
    depositBalance: P,
    advanceBalance: A,
    outstandingDue: D,
    damageCharges: X,
    depositApplied,
    depositRefund: money(P - depositApplied),
    advanceRefund: money(Math.max(0, -owed)),
    refundableAmount: money(P + A - D - X),
    remainingDue: money(Math.max(0, owed) - depositApplied),
  };
}

export async function previewSettlement(req: Request, membershipId: string, damageCharges: number) {
  const m = await getMembershipOrThrow(req, membershipId);
  const { balances } = await availableDeposit(m._id as Types.ObjectId);
  const pendingTx = await MessDepositTransaction.countDocuments({ membershipId: m._id, $or: [{ status: "pending" }, { type: "refund", status: "approved" }] });
  return { ...computeSettlement(balances, damageCharges), pendingDepositTransactions: pendingTx };
}

async function getSettlementOrThrow(req: Request, id: string, allowOwnStudent = false): Promise<MessSettlementDoc> {
  const s = await MessSettlement.findById(toObjectId(id, "settlementId"));
  if (!s) throw ApiError.notFound("Settlement not found");
  if (allowOwnStudent && req.user?.studentId && String(s.studentId) === req.user.studentId) return s;
  if (!hasPerm(req, PERMISSIONS.MESS_VIEW)) throw ApiError.forbidden();
  await assertMessAccess(req, s.messId);
  return s;
}

export async function createSettlement(
  req: Request,
  membershipId: string,
  body: { leavingDate: string; damageCharges?: number; damageNote?: string; notes?: string },
): Promise<MessSettlementDoc> {
  const m = await getMembershipOrThrow(req, membershipId);
  if (!["approved", "active", "on_leave", "notice_given"].includes(m.status)) throw ApiError.badRequest("এই সদস্যপদের চূড়ান্ত নিষ্পত্তি করা যাবে না");
  const pendingTx = await MessDepositTransaction.exists({ membershipId: m._id, $or: [{ status: "pending" }, { type: "refund", status: "approved" }] });
  if (pendingTx) throw ApiError.conflict("জামানতের অপেক্ষমাণ/অপরিশোধিত লেনদেন আছে — আগে সেগুলো নিষ্পত্তি করুন");
  if ((body.damageCharges ?? 0) > 0 && !body.damageNote?.trim()) throw ApiError.badRequest("ক্ষতি/অন্যান্য চার্জের বিবরণ লিখুন");
  const balances = await computeBalances(m._id as Types.ObjectId);
  const figures = computeSettlement(balances, body.damageCharges ?? 0);
  const isApprover = hasPerm(req, PERMISSIONS.MESS_FINANCE_APPROVE);
  try {
    const doc = await MessSettlement.create({
      settlementNo: await generateSequenceCode("mess_settlement", "MST", 5, true),
      membershipId: m._id,
      studentId: m.studentId,
      messId: m.messId,
      leavingDate: body.leavingDate,
      ...figures,
      damageNote: body.damageNote,
      notes: body.notes,
      status: isApprover ? "approved" : "pending",
      activeKey: String(m._id),
      createdBy: actorId(req),
      ...(isApprover ? { approvedBy: actorId(req), approvedAt: new Date() } : {}),
    });
    await recordAudit({ req, action: "mess.settlement.create", module: "mess", targetCollection: "messsettlements", targetId: String(doc._id), after: doc.toObject() });
    return doc;
  } catch (err) {
    if (isDuplicateKeyError(err)) throw ApiError.conflict("এই সদস্যপদের একটি নিষ্পত্তি ইতিমধ্যে চলমান আছে");
    throw err;
  }
}

export async function approveSettlement(req: Request, id: string): Promise<MessSettlementDoc> {
  assertApprover(req);
  const s = await getSettlementOrThrow(req, id);
  const balances = await computeBalances(s.membershipId);
  const figures = computeSettlement(balances, s.damageCharges);
  const updated = await MessSettlement.findOneAndUpdate(
    { _id: s._id, status: "pending" },
    { $set: { ...figures, status: "approved", approvedBy: actorId(req), approvedAt: new Date() } },
    { new: true },
  );
  if (!updated) throw ApiError.badRequest("শুধু অপেক্ষমাণ নিষ্পত্তি অনুমোদন করা যায়");
  await recordAudit({ req, action: "mess.settlement.approve", module: "mess", targetCollection: "messsettlements", targetId: id, after: updated.toObject() });
  return updated;
}

export async function cancelSettlement(req: Request, id: string, reason: string): Promise<MessSettlementDoc> {
  const s = await getSettlementOrThrow(req, id);
  if (s.status === "approved") assertApprover(req);
  const updated = await MessSettlement.findOneAndUpdate(
    { _id: s._id, status: { $in: ["pending", "approved"] } },
    { $set: { status: "cancelled", cancelledBy: actorId(req), cancelReason: reason }, $unset: { activeKey: "" } },
    { new: true },
  );
  if (!updated) throw ApiError.badRequest("এই নিষ্পত্তি বাতিল করা যাবে না");
  await recordAudit({ req, action: "mess.settlement.cancel", module: "mess", targetCollection: "messsettlements", targetId: id, after: { status: "cancelled", reason } });
  return updated;
}

/**
 * Completes the leaving settlement. Figures are recomputed one last time
 * from the live ledger; the status flip approved→completed is the lock, and
 * the deposit movements it posts are unique per (settlementId, type), so a
 * retried/double-submitted completion cannot apply the deposit twice.
 */
export async function completeSettlement(
  req: Request,
  id: string,
  body: { refundMethod?: string; refundDate?: string; refundReference?: string },
): Promise<MessSettlementDoc> {
  const s = await getSettlementOrThrow(req, id);
  if (s.status !== "approved") throw ApiError.badRequest("শুধু অনুমোদিত নিষ্পত্তি সম্পন্ন করা যায়");
  const balances = await computeBalances(s.membershipId);
  const figures = computeSettlement(balances, s.damageCharges);
  const paysOut = figures.depositRefund + figures.advanceRefund > 0;
  if (paysOut) {
    if (!body.refundMethod) throw ApiError.badRequest("ফেরতের পেমেন্ট পদ্ধতি নির্বাচন করুন");
    await assertMessPaymentMethod(body.refundMethod);
  }
  const date = body.refundDate || todayISO();
  const updated = await MessSettlement.findOneAndUpdate(
    { _id: s._id, status: "approved" },
    {
      $set: {
        ...figures,
        status: "completed",
        refundMethod: paysOut ? body.refundMethod : undefined,
        refundDate: paysOut ? date : undefined,
        refundReference: body.refundReference,
        completedBy: actorId(req),
        completedAt: new Date(),
      },
    },
    { new: true },
  );
  if (!updated) throw ApiError.conflict("নিষ্পত্তিটি ইতিমধ্যে প্রক্রিয়া হয়েছে");

  const base = { membershipId: s.membershipId, studentId: s.studentId, messId: s.messId, settlementId: s._id, date, status: "completed" as const, requestedBy: actorId(req), approvedBy: actorId(req), approvedAt: new Date(), completedBy: actorId(req), completedAt: new Date() };
  const postTx = async (type: DepositTxType, amount: number, reason: string, extra: Record<string, unknown> = {}) => {
    if (amount <= 0) return;
    try {
      await MessDepositTransaction.create({ ...base, txNo: await generateSequenceCode("mess_deposit_tx", "MDT", 5, true), type, amount, reason, ...extra });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
  };
  await postTx("apply_to_due", figures.depositApplied, `চূড়ান্ত নিষ্পত্তি ${s.settlementNo}`);
  await postTx("refund", figures.depositRefund, `চূড়ান্ত নিষ্পত্তি ${s.settlementNo}`, { method: body.refundMethod, reference: body.refundReference });

  // Membership ends; seat is freed; seat history is closed with the real leaving date.
  const m = (await MessMembership.findById(s.membershipId)) as MessMembershipDoc;
  const history = m.seatHistory.map((h) => (h as unknown as { toObject?: () => object }).toObject?.() ?? h) as MessMembershipDoc["seatHistory"];
  if (history.length && !history[history.length - 1].toDate) history[history.length - 1].toDate = s.leavingDate;
  await MessMembership.updateOne(
    { _id: m._id },
    {
      $set: { status: "left", ...statusFlags("left"), leftDate: s.leavingDate, settlementId: s._id, seatHistory: history },
      $push: { statusHistory: { status: "left", at: new Date(), by: actorId(req), note: `নিষ্পত্তি ${s.settlementNo}` } },
    },
  );
  await releaseSeat(m.seatId, { membershipId: m._id as Types.ObjectId });
  await recomputeLedger(s.membershipId);
  await recordAudit({ req, action: "mess.settlement.complete", module: "mess", targetCollection: "messsettlements", targetId: id, before: s.toObject(), after: updated.toObject() });
  // Check-out SMS (if enabled) — after everything is recorded; can never affect the settlement.
  const { fmtTaka, queueMessEventSms } = await import("./messSms.service");
  const final = figures.refundableAmount;
  queueMessEventSms({
    event: "checkout",
    studentId: s.studentId,
    messId: s.messId,
    vars: {
      amount: `${fmtTaka(Math.abs(final))} ${final >= 0 ? "(ফেরতযোগ্য)" : "(বকেয়া)"}`,
      remainingDue: fmtTaka(figures.remainingDue),
      paymentDate: date,
      paymentMethod: body.refundMethod ?? "",
    },
    refType: "settlement",
    refId: String(s._id),
    dedupeKey: `checkout:${String(s._id)}`,
  });
  return updated;
}

export async function listSettlements(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = {};
  const scope = await messScopeFilter(req, req.query.messId);
  if (scope) filter.messId = scope;
  if (typeof req.query.status === "string" && req.query.status) filter.status = req.query.status;
  const studentIds = await resolveStudentFilter(req);
  if (studentIds) filter.studentId = { $in: studentIds };
  const [items, total] = await Promise.all([
    MessSettlement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("studentId", "name registrationId currentRollNumber phone")
      .populate("messId", "name")
      .populate("membershipId", "membershipNo")
      .lean(),
    MessSettlement.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getSettlementDetail(req: Request, id: string) {
  const s = await getSettlementOrThrow(req, id, true);
  const [settlement, institution] = await Promise.all([
    MessSettlement.findById(s._id)
      .populate("studentId", "name registrationId currentRollNumber phone")
      .populate("messId", "name code address contactNumber")
      .populate({ path: "membershipId", select: "membershipNo joiningDate roomId seatId", populate: [{ path: "roomId", select: "name" }, { path: "seatId", select: "seatNumber" }] })
      .lean(),
    import("../../settings/institution.service").then((mod) => mod.getInstitutionSettings()),
  ]);
  return { settlement, institution };
}
