import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../../common/utils/ApiError";
import { recordAudit } from "../../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../../common/utils/pagination";
import { generateSequenceCode } from "../../../common/utils/idGenerators";
import { mapWithConcurrency } from "../../../common/utils/concurrency";
import { PERMISSIONS } from "../../rbac/permissions";
import { MessMembership, MessMembershipDoc } from "../models/messMembership.model";
import { MessBill, MessBillDoc, MessBillItem } from "../models/messBill.model";
import { MessSettlement } from "../models/messSettlement.model";
import { assertMessAccess, hasPerm, messScopeFilter } from "../mess.scope";
import { BILLABLE_STATUS } from "../mess.constants";
import { actorId, addDaysISO, daysInPeriod, isDuplicateKeyError, money, periodDate, todayISO, toObjectId } from "../mess.utils";
import { getMessSettings } from "./messSettings.service";
import { computeBalances, recomputeLedger } from "./messLedger.service";
import { resolveStudentFilter } from "./messMembership.service";

export interface GenerateBillsInput {
  period: string; // yyyy-mm
  messId?: string;
  membershipIds?: string[];
  additionalCharges?: { label: string; amount: number }[];
  extraDiscount?: number;
  dueDate?: string;
  notes?: string;
}

export interface GenerateBillsResult {
  period: string;
  eligible: number;
  created: number;
  skippedExisting: number;
  failed: { membershipId: string; membershipNo?: string; reason: string }[];
  billIds: string[];
}

async function assertApprovalForCredit(req: Request, amount: number | undefined) {
  if (!amount || amount <= 0) return;
  const settings = await getMessSettings();
  if (settings.discountApprovalRequired && !hasPerm(req, PERMISSIONS.MESS_FINANCE_APPROVE)) {
    throw ApiError.forbidden("মেস সেটিংস অনুযায়ী ডিসকাউন্ট/সমন্বয় দিতে আর্থিক অনুমোদনের অনুমতি প্রয়োজন");
  }
}

async function eligibleMemberships(req: Request, input: Pick<GenerateBillsInput, "period" | "messId" | "membershipIds">): Promise<MessMembershipDoc[]> {
  const periodEnd = periodDate(input.period, 31);
  const filter: Record<string, unknown> = {
    status: { $in: BILLABLE_STATUS },
    billingStartDate: { $lte: periodEnd },
    joiningDate: { $lte: periodEnd },
  };
  const scope = await messScopeFilter(req, input.messId);
  if (scope) filter.messId = scope;
  if (input.membershipIds?.length) filter._id = { $in: input.membershipIds.map((id) => toObjectId(id, "membershipId")) };
  return MessMembership.find(filter).sort({ membershipNo: 1 }).limit(5000);
}

/** How many members would get a bill for this period, and how many already have one — shown before the operator confirms bulk generation. */
export async function previewGeneration(req: Request, period: string, messId?: string) {
  const members = await eligibleMemberships(req, { period, messId });
  const existing = await MessBill.countDocuments({ membershipId: { $in: members.map((m) => m._id) }, periodKey: period });
  return { period, eligible: members.length, alreadyBilled: existing, toCreate: Math.max(0, members.length - existing) };
}

async function buildBillForMember(
  req: Request,
  m: MessMembershipDoc,
  input: GenerateBillsInput,
  settings: Awaited<ReturnType<typeof getMessSettings>>,
): Promise<"created" | "exists" | string> {
  if (await MessBill.exists({ membershipId: m._id, periodKey: input.period })) return "exists";
  // A member whose leaving settlement is already approved is settled on the
  // figures at approval — billing them again would silently change those.
  if (await MessSettlement.exists({ membershipId: m._id, status: "approved" })) {
    return "চূড়ান্ত নিষ্পত্তি অনুমোদিত — নতুন বিল তৈরি হয়নি";
  }

  const items: MessBillItem[] = [];
  const days = daysInPeriod(input.period);
  const startsThisPeriod = m.billingStartDate.slice(0, 7) === input.period;
  const startDay = Number(m.billingStartDate.slice(8, 10));
  if (settings.prorationEnabled && startsThisPeriod && startDay > 1) {
    const chargedDays = days - startDay + 1;
    items.push({ kind: "rent", label: `মাসিক ভাড়া (আংশিক: ${chargedDays}/${days} দিন)`, amount: money((m.monthlyRent * chargedDays) / days) });
  } else {
    items.push({ kind: "rent", label: "মাসিক ভাড়া", amount: money(m.monthlyRent) });
  }
  const includesSetup = m.setupCharge > 0 && !m.setupChargeBilled;
  if (includesSetup) items.push({ kind: "setup", label: "ভর্তি / সেটআপ চার্জ", amount: money(m.setupCharge) });
  for (const c of input.additionalCharges ?? []) {
    if (c.amount > 0) items.push({ kind: "additional", label: c.label, amount: money(c.amount) });
  }

  const issueDate = periodDate(input.period, settings.billingDay);
  const before = await computeBalances(m._id as Types.ObjectId);
  if (settings.lateFeeEnabled && settings.lateFeeAmount > 0 && before.due > 0) {
    const graceCutoff = addDaysISO(issueDate, -settings.gracePeriodDays);
    const overdue = await MessBill.exists({ membershipId: m._id, status: { $in: ["unpaid", "partial"] }, dueDate: { $lt: graceCutoff } });
    if (overdue) items.push({ kind: "late_fee", label: "বিলম্ব ফি", amount: money(settings.lateFeeAmount) });
  }

  const gross = money(items.reduce((s, i) => s + i.amount, 0));
  const discount = money(Math.min(gross, m.discount + (input.extraDiscount ?? 0)));
  const currentCharges = money(gross - discount);
  const previousDue = money(before.due - before.advance);
  const bill = {
    billNo: await generateSequenceCode("mess_bill", settings.billPrefix || "MB", 5, true),
    membershipId: m._id,
    studentId: m.studentId,
    messId: m.messId,
    roomId: m.roomId,
    seatId: m.seatId,
    period: input.period,
    periodKey: input.period,
    issueDate,
    dueDate: input.dueDate || periodDate(input.period, settings.dueDay),
    items,
    discount,
    adjustment: 0,
    previousDue,
    currentCharges,
    totalPayable: money(currentCharges + previousDue),
    paidAmount: 0,
    dueAmount: currentCharges,
    status: currentCharges > 0 ? "unpaid" : "paid",
    notes: input.notes,
    generatedBy: actorId(req),
  };
  try {
    await MessBill.create(bill);
  } catch (err) {
    // The unique {membershipId, periodKey} index — a concurrent/duplicate
    // generation run for the same month lands here, never as a second bill.
    if (isDuplicateKeyError(err)) return "exists";
    throw err;
  }
  if (includesSetup) await MessMembership.updateOne({ _id: m._id, setupChargeBilled: false }, { $set: { setupChargeBilled: true } });
  await recomputeLedger(m._id as Types.ObjectId);
  return "created";
}

/**
 * Monthly / bulk / per-Mess / individual bill generation — one code path.
 * Idempotent: re-running for the same period skips members who already have
 * a live bill (enforced by the unique index, not just the pre-check).
 */
export async function generateBills(req: Request, input: GenerateBillsInput): Promise<GenerateBillsResult> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw ApiError.badRequest("Invalid billing period");
  await assertApprovalForCredit(req, input.extraDiscount);
  if (input.messId) await assertMessAccess(req, input.messId);
  const settings = await getMessSettings();
  const members = await eligibleMemberships(req, input);
  if (input.membershipIds?.length && members.length === 0) {
    throw ApiError.badRequest("নির্বাচিত সদস্য এই মাসের বিলের জন্য যোগ্য নয় (সক্রিয় নয় বা বিলিং শুরুর তারিখ পরে)");
  }
  const result: GenerateBillsResult = { period: input.period, eligible: members.length, created: 0, skippedExisting: 0, failed: [], billIds: [] };
  const outcomes = await mapWithConcurrency(members, 4, async (m) => {
    try {
      return { m, outcome: await buildBillForMember(req, m, input, settings) };
    } catch (err) {
      return { m, outcome: err instanceof Error ? err.message : "Unknown error" };
    }
  });
  for (const { m, outcome } of outcomes) {
    if (outcome === "created") result.created++;
    else if (outcome === "exists") result.skippedExisting++;
    else result.failed.push({ membershipId: String(m._id), membershipNo: m.membershipNo, reason: outcome });
  }
  if (result.created > 0) {
    const created = await MessBill.find({ membershipId: { $in: members.map((m) => m._id) }, periodKey: input.period }).select("_id").lean();
    result.billIds = created.map((b) => String(b._id));
  }
  await recordAudit({
    req,
    action: "mess.bill.generate",
    module: "mess",
    targetCollection: "messbills",
    after: { period: input.period, messId: input.messId, membershipIds: input.membershipIds, additionalCharges: input.additionalCharges, extraDiscount: input.extraDiscount, created: result.created, skippedExisting: result.skippedExisting, failed: result.failed.length },
  });
  return result;
}

export async function listBills(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = {};
  const scope = await messScopeFilter(req, req.query.messId);
  if (scope) filter.messId = scope;
  if (typeof req.query.period === "string" && req.query.period) filter.period = req.query.period;
  if (typeof req.query.status === "string" && req.query.status) {
    const s = req.query.status.split(",").filter(Boolean);
    filter.status = s.length === 1 ? s[0] : { $in: s };
  } else if (req.query.includeCancelled !== "true") {
    filter.status = { $ne: "cancelled" };
  }
  if (typeof req.query.membershipId === "string" && Types.ObjectId.isValid(req.query.membershipId)) filter.membershipId = new Types.ObjectId(req.query.membershipId);
  const studentIds = await resolveStudentFilter(req);
  if (studentIds) filter.studentId = { $in: studentIds };
  const [items, total, totals] = await Promise.all([
    MessBill.find(filter)
      .sort({ period: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("studentId", "name registrationId currentRollNumber phone")
      .populate("messId", "name code")
      .populate("roomId", "name")
      .populate("seatId", "seatNumber")
      .lean(),
    MessBill.countDocuments(filter),
    MessBill.aggregate<{ _id: null; charges: number; paid: number; due: number }>([
      { $match: { ...filter, status: filter.status ?? { $ne: "cancelled" } } },
      { $group: { _id: null, charges: { $sum: "$currentCharges" }, paid: { $sum: "$paidAmount" }, due: { $sum: "$dueAmount" } } },
    ]),
  ]);
  return { items, meta: { ...buildMeta(page, limit, total), totals: totals[0] ?? { charges: 0, paid: 0, due: 0 } } };
}

export async function getBillOrThrow(req: Request, id: string, allowOwnStudent = false): Promise<MessBillDoc> {
  const bill = await MessBill.findById(toObjectId(id, "billId"));
  if (!bill) throw ApiError.notFound("Bill not found");
  if (allowOwnStudent && req.user?.studentId && String(bill.studentId) === req.user.studentId) return bill;
  if (!hasPerm(req, PERMISSIONS.MESS_VIEW)) throw ApiError.forbidden();
  await assertMessAccess(req, bill.messId);
  return bill;
}

/** Everything the printable invoice needs, in one response (institution branding from central Settings). */
export async function getInvoice(req: Request, id: string) {
  const bill = await getBillOrThrow(req, id, true);
  const [populated, membership, institution] = await Promise.all([
    MessBill.findById(bill._id)
      .populate("studentId", "name registrationId currentRollNumber phone course")
      .populate("messId", "name code address contactNumber")
      .populate("roomId", "name floor")
      .populate("seatId", "seatNumber")
      .lean(),
    MessMembership.findById(bill.membershipId).select("membershipNo monthlyRent securityDeposit balance status").lean(),
    import("../../settings/institution.service").then((m) => m.getInstitutionSettings()),
  ]);
  return { bill: populated, membership, institution };
}

export async function cancelBill(req: Request, id: string, reason: string): Promise<MessBillDoc> {
  const bill = await getBillOrThrow(req, id);
  if (bill.status === "cancelled") throw ApiError.conflict("বিলটি ইতিমধ্যে বাতিল");
  const updated = await MessBill.findOneAndUpdate(
    { _id: bill._id, status: { $ne: "cancelled" } },
    { $set: { status: "cancelled", periodKey: `${bill.period}#cancelled#${String(bill._id)}`, cancelledAt: new Date(), cancelledBy: actorId(req), cancelReason: reason, paidAmount: 0, dueAmount: 0 } },
    { new: true },
  );
  if (!updated) throw ApiError.conflict("বিলটি ইতিমধ্যে বাতিল");
  // A cancelled bill that carried the one-time setup charge releases it so the corrected bill can include it again.
  if (bill.items.some((i) => i.kind === "setup")) {
    await MessMembership.updateOne({ _id: bill.membershipId }, { $set: { setupChargeBilled: false } });
  }
  await recomputeLedger(bill.membershipId);
  await recordAudit({ req, action: "mess.bill.cancel", module: "mess", targetCollection: "messbills", targetId: id, before: bill.toObject(), after: { status: "cancelled", reason } });
  return updated;
}

/** An approved one-off credit on a live bill (correction without cancelling it). */
export async function adjustBill(req: Request, id: string, body: { adjustment: number; reason: string }): Promise<MessBillDoc> {
  const bill = await getBillOrThrow(req, id);
  if (bill.status === "cancelled") throw ApiError.badRequest("বাতিল বিল সমন্বয় করা যাবে না");
  await assertApprovalForCredit(req, body.adjustment);
  const gross = money(bill.items.reduce((s, i) => s + i.amount, 0));
  const currentCharges = money(gross - bill.discount - body.adjustment);
  if (currentCharges < 0) throw ApiError.badRequest("সমন্বয়ের পরিমাণ বিলের মোট চার্জের চেয়ে বেশি হতে পারে না");
  const before = bill.toObject();
  bill.adjustment = money(body.adjustment);
  bill.adjustmentReason = body.reason;
  bill.adjustmentApprovedBy = actorId(req);
  bill.currentCharges = currentCharges;
  bill.totalPayable = money(currentCharges + bill.previousDue);
  await bill.save();
  await recomputeLedger(bill.membershipId);
  await recordAudit({ req, action: "mess.bill.adjust", module: "mess", targetCollection: "messbills", targetId: id, before, after: bill.toObject() });
  return (await MessBill.findById(bill._id))!;
}

export { todayISO };
