import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../../common/utils/ApiError";
import { recordAudit } from "../../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../../common/utils/pagination";
import { generateSequenceCode } from "../../../common/utils/idGenerators";
import { logger } from "../../../logger/logger";
import { PERMISSIONS } from "../../rbac/permissions";
import { MessMembership } from "../models/messMembership.model";
import { MessReservation } from "../models/messReservation.model";
import { MessPayment, MessPaymentDoc } from "../models/messPayment.model";
import { MessSettlement } from "../models/messSettlement.model";
import { assertMessAccess, hasPerm, messScopeFilter } from "../mess.scope";
import { MessPaymentPurpose } from "../mess.constants";
import { actorId, isDuplicateKeyError, money, todayISO, toObjectId } from "../mess.utils";
import { assertMessPaymentMethod, getMessSettings } from "./messSettings.service";
import { computeBalances, recomputeLedger } from "./messLedger.service";
import { resolveStudentFilter } from "./messMembership.service";

export interface ReceivePaymentInput {
  membershipId?: string;
  reservationId?: string;
  purpose: MessPaymentPurpose;
  amount: number;
  method: string;
  date?: string;
  reference?: string;
  note?: string;
  idempotencyKey?: string;
}

async function sendMessPaymentSms(studentId: Types.ObjectId, amount: number, receiptNo: string, due: number): Promise<void> {
  try {
    const settings = await getMessSettings();
    if (!settings.paymentSmsEnabled) return;
    const { Student } = await import("../../students/student.model");
    const student = await Student.findById(studentId).select("name phone");
    if (!student?.phone) return;
    const { sendSms } = await import("../../sms/sms.service");
    await sendSms({
      to: student.phone,
      message: `প্রিয় ${student.name}, মেস পেমেন্ট ৳${amount} গৃহীত হয়েছে। রসিদ: ${receiptNo}। বর্তমান বকেয়া: ৳${due}।`,
      eventType: "mess",
      studentId: String(studentId),
    });
  } catch (err) {
    // An SMS problem must never affect a recorded payment.
    logger.warn({ err }, "Mess payment SMS failed");
  }
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

  await assertMessPaymentMethod(input.method);
  const settings = await getMessSettings();
  const prefix = settings.receiptPrefix || "MR";
  let doc: MessPaymentDoc;
  try {
    doc = await MessPayment.create({
      receiptNo: await generateSequenceCode(`mess_receipt_${prefix}`, prefix, 5, true),
      studentId,
      membershipId,
      reservationId,
      messId,
      purpose: input.purpose,
      amount,
      method: input.method,
      date: input.date || todayISO(),
      reference: input.reference,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
      status: "active",
      verified: false,
      createdBy: actorId(req),
    });
  } catch (err) {
    if (input.idempotencyKey && isDuplicateKeyError(err)) {
      const existing = await MessPayment.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) return existing;
    }
    throw err;
  }

  let balanceAfter = { due: 0, advance: 0, depositBalance: 0 };
  if (membershipId) {
    const b = await recomputeLedger(membershipId);
    balanceAfter = { due: b.due, advance: b.advance, depositBalance: b.depositBalance };
    await MessPayment.updateOne({ _id: doc._id }, { $set: { balanceAfter } });
    doc.balanceAfter = balanceAfter;
  }
  await recordAudit({ req, action: "mess.payment.create", module: "mess", targetCollection: "messpayments", targetId: String(doc._id), after: doc.toObject() });
  void sendMessPaymentSms(studentId, amount, doc.receiptNo, balanceAfter.due);
  return doc;
}

export async function listPayments(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = {};
  const scope = await messScopeFilter(req, req.query.messId);
  if (scope) filter.messId = scope;
  for (const key of ["purpose", "method"] as const) {
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
    MessPayment.aggregate<{ _id: string; total: number; count: number }>([
      { $match: { ...filter, status: "active" } },
      { $group: { _id: "$purpose", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);
  return {
    items,
    meta: {
      ...buildMeta(page, limit, total),
      totals: {
        rent: totals.find((t) => t._id === "rent")?.total ?? 0,
        deposit: totals.find((t) => t._id === "deposit")?.total ?? 0,
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
    if (p.purpose === "deposit") {
      const b = await computeBalances(p.membershipId);
      if (money(b.depositBalance - b.depositPendingRefund - p.amount) < 0) {
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
