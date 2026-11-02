import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../../common/utils/ApiError";
import { recordAudit } from "../../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../../common/utils/pagination";
import { generateSequenceCode } from "../../../common/utils/idGenerators";
import { PERMISSIONS } from "../../rbac/permissions";
import { MessMembership } from "../models/messMembership.model";
import { MessReservation } from "../models/messReservation.model";
import { MessPayment, MessPaymentDoc } from "../models/messPayment.model";
import { MessSettlement } from "../models/messSettlement.model";
import { assertMessAccess, hasPerm, messScopeFilter } from "../mess.scope";
import { MessPaymentPurpose } from "../mess.constants";
import { actorId, isDuplicateKeyError, money, todayISO, toObjectId } from "../mess.utils";
import { assertMessPaymentMethod, getMessSettings } from "./messSettings.service";
import { computeBalances, PAYMENT_DEPOSIT_PART, PAYMENT_RENT_PART, paymentPortions, recomputeLedger } from "./messLedger.service";
import { resolveStudentFilter } from "./messMembership.service";
import { fmtTaka, periodLabel, queueMessEventSms } from "./messSms.service";

export interface ReceivePaymentInput {
  membershipId?: string;
  reservationId?: string;
  purpose: Exclude<MessPaymentPurpose, "initial">;
  amount: number;
  method: string;
  date?: string;
  /** "yyyy-mm" the payment is for (shown on the receipt). FIFO still clears the oldest due first. */
  billingMonth?: string;
  reference?: string;
  note?: string;
  idempotencyKey?: string;
}

function paymentSmsVars(doc: MessPaymentDoc, due: number) {
  return {
    amount: fmtTaka(doc.amount),
    paymentDate: doc.date,
    receiptNo: doc.receiptNo,
    paymentMethod: doc.method,
    billingMonth: periodLabel(doc.billingMonth),
    previousDue: fmtTaka(doc.dueBefore ?? 0),
    remainingDue: fmtTaka(due),
  };
}

interface InsertPaymentFields {
  studentId: Types.ObjectId;
  messId: Types.ObjectId;
  membershipId?: Types.ObjectId;
  reservationId?: Types.ObjectId;
  purpose: MessPaymentPurpose;
  amount: number;
  allocation: { rent: number; deposit: number };
  method: string;
  date?: string;
  billingMonth?: string;
  dueBefore?: number;
  reference?: string;
  note?: string;
  idempotencyKey?: string;
}

/** Receipt number, idempotent insert, ledger recompute and audit — shared by every way Mess money comes in. */
async function insertPayment(req: Request, f: InsertPaymentFields): Promise<{ doc: MessPaymentDoc; duplicate: boolean; due: number }> {
  await assertMessPaymentMethod(f.method);
  const settings = await getMessSettings();
  const prefix = settings.receiptPrefix || "MR";
  let doc: MessPaymentDoc;
  try {
    doc = await MessPayment.create({
      receiptNo: await generateSequenceCode(`mess_receipt_${prefix}`, prefix, 5, true),
      studentId: f.studentId,
      membershipId: f.membershipId,
      reservationId: f.reservationId,
      messId: f.messId,
      purpose: f.purpose,
      amount: f.amount,
      allocation: { rent: money(f.allocation.rent), deposit: money(f.allocation.deposit) },
      method: f.method,
      date: f.date || todayISO(),
      billingMonth: f.billingMonth,
      dueBefore: f.dueBefore,
      reference: f.reference,
      note: f.note,
      idempotencyKey: f.idempotencyKey,
      status: "active",
      verified: false,
      createdBy: actorId(req),
    });
  } catch (err) {
    if (f.idempotencyKey && isDuplicateKeyError(err)) {
      const existing = await MessPayment.findOne({ idempotencyKey: f.idempotencyKey });
      if (existing) return { doc: existing, duplicate: true, due: existing.balanceAfter?.due ?? 0 };
    }
    throw err;
  }
  let balanceAfter = { due: 0, advance: 0, depositBalance: 0 };
  if (f.membershipId) {
    const b = await recomputeLedger(f.membershipId);
    balanceAfter = { due: b.due, advance: b.advance, depositBalance: b.depositBalance };
    await MessPayment.updateOne({ _id: doc._id }, { $set: { balanceAfter } });
    doc.balanceAfter = balanceAfter;
  }
  await recordAudit({ req, action: "mess.payment.create", module: "mess", targetCollection: "messpayments", targetId: String(doc._id), after: doc.toObject() });
  return { doc, duplicate: false, due: balanceAfter.due };
}

/**
 * Receives Mess money (rent/dues/advance or security deposit). Every
 * figure is server-computed; the client only says how much was handed over.
 * Double-click / retry safety comes from the client's per-attempt
 * idempotencyKey (unique index) — never from making studentId unique.
 */
export async function receivePayment(req: Request, input: ReceivePaymentInput): Promise<MessPaymentDoc> {
  if (input.idempotencyKey) {
    const existing = await MessPayment.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) return existing;
  }
  const amount = money(input.amount);
  if (amount <= 0) throw ApiError.badRequest("পরিমাণ শূন্যের বেশি হতে হবে");
  if (!input.membershipId && !input.reservationId) throw ApiError.badRequest("membershipId or reservationId is required");

  let studentId: Types.ObjectId;
  let messId: Types.ObjectId;
  let membershipId: Types.ObjectId | undefined;
  let reservationId: Types.ObjectId | undefined;
  let dueBefore: number | undefined;
  if (input.billingMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.billingMonth)) throw ApiError.badRequest("Invalid billing month");

  if (input.membershipId) {
    const m = await MessMembership.findById(toObjectId(input.membershipId, "membershipId"));
    if (!m) throw ApiError.notFound("Membership not found");
    await assertMessAccess(req, m.messId);
    if (m.status === "pending") throw ApiError.badRequest("আবেদন এখনো অনুমোদিত হয়নি — অনুমোদনের পর পেমেন্ট নিন");
    if (m.status === "cancelled") throw ApiError.badRequest("বাতিল সদস্যপদে পেমেন্ট নেওয়া যাবে না");
    if (await MessSettlement.exists({ membershipId: m._id, status: "approved" })) {
      throw ApiError.conflict("এই সদস্যের চূড়ান্ত হিসাব নিষ্পত্তি চলছে — নিষ্পত্তি সম্পন্ন বা বাতিল হওয়ার পর পেমেন্ট নিন");
    }
    const balances = await computeBalances(m._id as Types.ObjectId);
    dueBefore = balances.due;
    if (m.status === "left") {
      if (input.purpose !== "rent") throw ApiError.badRequest("সদস্যপদ শেষ — শুধু বকেয়া আদায় করা যাবে");
      if (amount > balances.due) throw ApiError.badRequest(`সদস্যপদ শেষ — সর্বোচ্চ বকেয়া ৳${balances.due} আদায় করা যাবে`);
    }
    if (input.purpose === "deposit" && balances.depositRequired > 0) {
      const remaining = money(balances.depositRequired - balances.depositCollected);
      if (amount > remaining) throw ApiError.badRequest(`জামানতের বাকি মাত্র ৳${Math.max(0, remaining)} — এর বেশি নেওয়া যাবে না`);
    }
    studentId = m.studentId;
    messId = m.messId;
    membershipId = m._id as Types.ObjectId;
  } else {
    const r = await MessReservation.findById(toObjectId(input.reservationId!, "reservationId"));
    if (!r) throw ApiError.notFound("Reservation not found");
    await assertMessAccess(req, r.messId);
    if (r.status !== "active") throw ApiError.badRequest("রিজার্ভেশনটি সক্রিয় নয়");
    if (input.purpose !== "rent") throw ApiError.badRequest("রিজার্ভেশনে শুধু অগ্রিম পেমেন্ট নেওয়া যায়");
    studentId = r.studentId;
    messId = r.messId;
    reservationId = r._id as Types.ObjectId;
  }

  const { doc, duplicate, due } = await insertPayment(req, {
    studentId,
    messId,
    membershipId,
    reservationId,
    purpose: input.purpose,
    amount,
    allocation: input.purpose === "deposit" ? { rent: 0, deposit: amount } : { rent: amount, deposit: 0 },
    method: input.method,
    date: input.date,
    billingMonth: input.billingMonth,
    dueBefore,
    reference: input.reference,
    note: input.note,
    idempotencyKey: input.idempotencyKey,
  });
  // Payment SMS to the student's own phone — after the payment is safely recorded, never able to undo or fail it.
  if (!duplicate) {
    queueMessEventSms({ event: "payment", studentId, messId, vars: paymentSmsVars(doc, due), refType: "payment", refId: String(doc._id), dedupeKey: `payment:${String(doc._id)}` });
  }
  return doc;
}

/**
 * Pure split of an admission payment: the one-time dining charge first, then
 * the one-month advance still owed; anything beyond both is a credit
 * against rent. rent + deposit always equals the amount — never more.
 */
export function splitInitialPayment(amount: number, diningDue: number, depositRemaining: number): { rent: number; deposit: number } {
  const a = money(Math.max(0, amount));
  const rent = money(Math.min(a, Math.max(0, diningDue)));
  const deposit = money(Math.min(a - rent, Math.max(0, depositRemaining)));
  return { rent: money(a - deposit), deposit };
}

/**
 * The single admission receipt: Amount Paid is applied to the one-time
 * dining charge first, then to the one-month advance. Anything beyond both
 * is a credit against rent. Partial payment is allowed; whatever is unpaid
 * stays as due.
 */
export async function recordInitialPayment(
  req: Request,
  membershipId: Types.ObjectId,
  input: { amount: number; method: string; date?: string; reference?: string; note?: string; idempotencyKey?: string },
): Promise<{ payment: MessPaymentDoc; allocation: { rent: number; deposit: number }; due: number; depositRemaining: number }> {
  const m = await MessMembership.findById(membershipId);
  if (!m) throw ApiError.notFound("Membership not found");
  const amount = money(input.amount);
  if (amount <= 0) throw ApiError.badRequest("পরিমাণ শূন্যের বেশি হতে হবে");
  const balances = await computeBalances(membershipId);
  const depositRemaining = money(Math.max(0, balances.depositRequired - balances.depositCollected));
  // The admission receipt covers the one-time dining charge and the one-month advance; rent is paid with normal payments.
  const allocation = splitInitialPayment(amount, balances.diningDue, depositRemaining);
  const { doc, due } = await insertPayment(req, {
    studentId: m.studentId,
    messId: m.messId,
    membershipId,
    purpose: "initial",
    amount,
    allocation,
    method: input.method,
    date: input.date,
    dueBefore: balances.due,
    reference: input.reference,
    note: input.note || "ভর্তির পেমেন্ট (একবারের ডাইনিং চার্জ + এক মাসের অগ্রিম)",
    idempotencyKey: input.idempotencyKey,
  });
  return { payment: doc, allocation, due, depositRemaining: money(depositRemaining - allocation.deposit) };
}

export async function listPayments(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = {};
  const scope = await messScopeFilter(req, req.query.messId);
  if (scope) filter.messId = scope;
  for (const key of ["purpose", "method", "billingMonth"] as const) {
    if (typeof req.query[key] === "string" && req.query[key]) filter[key] = req.query[key];
  }
  if (typeof req.query.status === "string" && req.query.status) filter.status = req.query.status;
  else if (req.query.includeCancelled !== "true") filter.status = "active";
  if (req.query.verified === "true") filter.verified = true;
  if (req.query.verified === "false") filter.verified = false;
  if (typeof req.query.membershipId === "string" && Types.ObjectId.isValid(req.query.membershipId)) filter.membershipId = new Types.ObjectId(req.query.membershipId);
  if (typeof req.query.reservationId === "string" && Types.ObjectId.isValid(req.query.reservationId)) filter.reservationId = new Types.ObjectId(req.query.reservationId);
  if (req.query.dateFrom || req.query.dateTo) {
    filter.date = { ...(req.query.dateFrom ? { $gte: String(req.query.dateFrom) } : {}), ...(req.query.dateTo ? { $lte: String(req.query.dateTo) } : {}) };
  }
  if (typeof req.query.receiptNo === "string" && req.query.receiptNo.trim()) filter.receiptNo = req.query.receiptNo.trim();
  const studentIds = await resolveStudentFilter(req);
  if (studentIds) filter.studentId = { $in: studentIds };
  const [items, total, totals] = await Promise.all([
    MessPayment.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("studentId", "name registrationId currentRollNumber phone")
      .populate("messId", "name code")
      .populate("membershipId", "membershipNo")
      .populate("reservationId", "reservationNo")
      .lean(),
    MessPayment.countDocuments(filter),
    MessPayment.aggregate<{ _id: null; rent: number; deposit: number; count: number }>([
      { $match: { ...filter, status: "active" } },
      { $group: { _id: null, rent: { $sum: PAYMENT_RENT_PART }, deposit: { $sum: PAYMENT_DEPOSIT_PART }, count: { $sum: 1 } } },
    ]),
  ]);
  return {
    items,
    meta: {
      ...buildMeta(page, limit, total),
      totals: {
        rent: money(totals[0]?.rent ?? 0),
        deposit: money(totals[0]?.deposit ?? 0),
      },
    },
  };
}

export async function getPaymentOrThrow(req: Request, id: string, allowOwnStudent = false): Promise<MessPaymentDoc> {
  const p = await MessPayment.findById(toObjectId(id, "paymentId"));
  if (!p) throw ApiError.notFound("Payment not found");
  if (allowOwnStudent && req.user?.studentId && String(p.studentId) === req.user.studentId) return p;
  if (!hasPerm(req, PERMISSIONS.MESS_VIEW)) throw ApiError.forbidden();
  await assertMessAccess(req, p.messId);
  return p;
}

export async function getReceipt(req: Request, id: string) {
  const p = await getPaymentOrThrow(req, id, true);
  const [payment, institution] = await Promise.all([
    MessPayment.findById(p._id)
      .populate("studentId", "name registrationId currentRollNumber phone course")
      .populate("messId", "name code address contactNumber")
      .populate({ path: "membershipId", select: "membershipNo roomId seatId monthlyRent securityDeposit", populate: [{ path: "roomId", select: "name" }, { path: "seatId", select: "seatNumber" }] })
      .populate("reservationId", "reservationNo")
      .lean(),
    import("../../settings/institution.service").then((m) => m.getInstitutionSettings()),
  ]);
  return { payment, institution };
}

/** Reversal is a soft cancellation — the receipt and row stay for audit; balances are recomputed without it. */
export async function cancelPayment(req: Request, id: string, reason: string): Promise<MessPaymentDoc> {
  const p = await getPaymentOrThrow(req, id);
  if (p.status === "cancelled") throw ApiError.conflict("পেমেন্টটি ইতিমধ্যে বাতিল");
  if (p.membershipId) {
    if (await MessSettlement.exists({ membershipId: p.membershipId, status: { $in: ["approved", "completed"] } })) {
      throw ApiError.conflict("এই সদস্যের চূড়ান্ত নিষ্পত্তি অনুমোদিত/সম্পন্ন — পেমেন্ট বাতিল করা যাবে না");
    }
    const portion = paymentPortions(p);
    if (portion.deposit > 0) {
      const b = await computeBalances(p.membershipId);
      if (money(b.depositBalance - b.depositPendingRefund - portion.deposit) < 0) {
        throw ApiError.conflict("এই জামানতের অর্থ ইতিমধ্যে সমন্বয়/ফেরত হয়েছে — পেমেন্ট বাতিল করা যাবে না");
      }
    }
  }
  const updated = await MessPayment.findOneAndUpdate(
    { _id: p._id, status: "active" },
    { $set: { status: "cancelled", cancelledAt: new Date(), cancelledBy: actorId(req), cancelReason: reason } },
    { new: true },
  );
  if (!updated) throw ApiError.conflict("পেমেন্টটি ইতিমধ্যে বাতিল");
  if (p.membershipId) await recomputeLedger(p.membershipId);
  await recordAudit({ req, action: "mess.payment.cancel", module: "mess", targetCollection: "messpayments", targetId: id, before: p.toObject(), after: updated.toObject() });
  return updated;
}

export async function verifyPayment(req: Request, id: string): Promise<MessPaymentDoc> {
  const p = await getPaymentOrThrow(req, id);
  if (p.status !== "active") throw ApiError.badRequest("বাতিল পেমেন্ট যাচাই করা যাবে না");
  if (p.verified) return p;
  p.verified = true;
  p.verifiedAt = new Date();
  p.verifiedBy = actorId(req);
  await p.save();
  await recordAudit({ req, action: "mess.payment.verify", module: "mess", targetCollection: "messpayments", targetId: id, after: { verified: true } });
  return p;
}
