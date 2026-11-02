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
import { BILLABLE_STATUS, ProrationMode } from "../mess.constants";
import { Mess } from "../models/mess.model";
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
  /** Not billed by rule (approved leaving settlement, "start next month" proration) — not an error. */
  skipped: { membershipId: string; membershipNo?: string; reason: string }[];
  failed: { membershipId: string; membershipNo?: string; reason: string }[];
  billIds: string[];
}

/**
 * Who is generating: an operator request (scope + audit actor from `req`),
 * or the backend scheduler (no request — every active Mess, audited as the
 * system). Both run exactly the same code below.
 */
export interface BillingCtx {
  req?: Request;
  source: "manual" | "auto" | "admission" | "regenerate";
}

type Settings = Awaited<ReturnType<typeof getMessSettings>>;
type MessBillingCfg = { billingDay: number; dueDay: number };

/** The configured joining-month rule (prorationMode supersedes the older prorationEnabled flag). */
export function effectiveProrationMode(settings: Pick<Settings, "prorationMode" | "prorationEnabled">): ProrationMode {
  return settings.prorationMode ?? (settings.prorationEnabled ? "prorate" : "full");
}

/**
 * Pure: the monthly SEAT RENT for `period` for a member whose billing starts
 * on `startDate`. Returns null when the rule says the month is not billed.
 * (The one-time dining charge and the one-month advance are never billed.)
 */
export function rentForPeriod(
  monthlyRent: number,
  startDate: string,
  period: string,
  mode: ProrationMode,
): { amount: number; label: string } | null {
  const days = daysInPeriod(period);
  const startsThisPeriod = startDate.slice(0, 7) === period;
  const startDay = Number(startDate.slice(8, 10));
  if (!startsThisPeriod || startDay <= 1) return { amount: money(monthlyRent), label: "মাসিক সিট ভাড়া" };
  if (mode === "next_month") return null;
  if (mode === "prorate") {
    const chargedDays = days - startDay + 1;
    return { amount: money((monthlyRent * chargedDays) / days), label: `মাসিক সিট ভাড়া (আংশিক: ${chargedDays}/${days} দিন)` };
  }
  return { amount: money(monthlyRent), label: "মাসিক সিট ভাড়া" };
}

/** Pure: Total Payable = Current Charge (rent + other charges/fine − discount) + Previous Due. */
export function billTotalPayable(currentCharges: number, previousDue: number): number {
  return money(currentCharges + previousDue);
}

async function assertApprovalForCredit(req: Request | undefined, amount: number | undefined) {
  if (!amount || amount <= 0 || !req) return;
  const settings = await getMessSettings();
  if (settings.discountApprovalRequired && !hasPerm(req, PERMISSIONS.MESS_FINANCE_APPROVE)) {
    throw ApiError.forbidden("মেস সেটিংস অনুযায়ী ডিসকাউন্ট/সমন্বয় দিতে আর্থিক অনুমোদনের অনুমতি প্রয়োজন");
  }
}

async function eligibleMemberships(ctx: BillingCtx, input: Pick<GenerateBillsInput, "period" | "messId" | "membershipIds">): Promise<MessMembershipDoc[]> {
  const periodEnd = periodDate(input.period, 31);
  const filter: Record<string, unknown> = {
    status: { $in: BILLABLE_STATUS },
    billingStartDate: { $lte: periodEnd },
    joiningDate: { $lte: periodEnd },
  };
  if (ctx.req) {
    const scope = await messScopeFilter(ctx.req, input.messId);
    if (scope) filter.messId = scope;
  } else if (input.messId) {
    filter.messId = toObjectId(input.messId, "messId");
  }
  if (input.membershipIds?.length) filter._id = { $in: input.membershipIds.map((id) => toObjectId(id, "membershipId")) };
  return MessMembership.find(filter).sort({ membershipNo: 1 }).limit(5000);
}

async function messConfigs(messIds: Types.ObjectId[], settings: Settings): Promise<Map<string, MessBillingCfg>> {
  const rows = await Mess.find({ _id: { $in: messIds } }).select("billingDay dueDay").lean();
  const map = new Map<string, MessBillingCfg>();
  for (const r of rows) map.set(String(r._id), { billingDay: r.billingDay ?? settings.billingDay, dueDay: r.dueDay ?? settings.dueDay });
  return map;
}

/** How many members would get a bill for this period, and how many already have one — shown before the operator confirms bulk generation. */
export async function previewGeneration(req: Request, period: string, messId?: string) {
  const members = await eligibleMemberships({ req, source: "manual" }, { period, messId });
  const existing = await MessBill.countDocuments({ membershipId: { $in: members.map((m) => m._id) }, periodKey: period });
  const settings = await getMessSettings();
  const mode = effectiveProrationMode(settings);
  const notBilledByRule = mode === "next_month" ? members.filter((m) => !rentForPeriod(m.monthlyRent, m.billingStartDate, period, mode)).length : 0;
  return {
    period,
    eligible: members.length,
    alreadyBilled: existing,
    notBilledByRule,
    toCreate: Math.max(0, members.length - existing - notBilledByRule),
    prorationMode: mode,
    autoBillingEnabled: settings.autoBillingEnabled,
  };
}

export type BuildOutcome = { kind: "created"; billId: Types.ObjectId } | { kind: "exists" } | { kind: "skipped"; reason: string } | { kind: "failed"; reason: string };

/** Creates one member's monthly rent bill for one month. */
export async function buildBillForMember(
  ctx: BillingCtx,
  m: MessMembershipDoc,
  input: GenerateBillsInput,
  settings: Settings,
  cfg: MessBillingCfg,
): Promise<BuildOutcome> {
  if (await MessBill.exists({ membershipId: m._id, periodKey: input.period })) return { kind: "exists" };
  // A member whose leaving settlement is already approved is settled on the
  // figures at approval — billing them again would silently change those.
  if (await MessSettlement.exists({ membershipId: m._id, status: "approved" })) {
    return { kind: "skipped", reason: "চূড়ান্ত নিষ্পত্তি অনুমোদিত — নতুন বিল তৈরি হয়নি" };
  }

  const items: MessBillItem[] = [];
  const rent = rentForPeriod(m.monthlyRent, m.billingStartDate, input.period, effectiveProrationMode(settings));
  if (!rent) return { kind: "skipped", reason: "যোগদানের মাস — নিয়ম অনুযায়ী ভাড়া পরের মাস থেকে" };
  if (rent.amount > 0) items.push({ kind: "rent", label: rent.label, amount: money(rent.amount) });
  const includesSetup = m.setupCharge > 0 && !m.setupChargeBilled;
  if (includesSetup) items.push({ kind: "setup", label: "ভর্তি / সেটআপ চার্জ", amount: money(m.setupCharge) });
  for (const c of input.additionalCharges ?? []) {
    if (c.amount > 0) items.push({ kind: "additional", label: c.label, amount: money(c.amount) });
  }

  const issueDate = periodDate(input.period, cfg.billingDay);
  const before = await computeBalances(m._id as Types.ObjectId);
  // "Previous due" on a rent bill is earlier rent/fines only — the one-time dining charge is its own charge, not part of any bill.
  const priorDue = money(before.due - before.diningDue);
  if (settings.lateFeeEnabled && settings.lateFeeAmount > 0 && priorDue > 0) {
    const graceCutoff = addDaysISO(issueDate, -settings.gracePeriodDays);
    const overdue = await MessBill.exists({ membershipId: m._id, status: { $in: ["unpaid", "partial"] }, dueDate: { $lt: graceCutoff } });
    if (overdue) items.push({ kind: "late_fee", label: "বিলম্ব ফি", amount: money(settings.lateFeeAmount) });
  }

  const gross = money(items.reduce((s, i) => s + i.amount, 0));
  const discount = money(Math.min(gross, m.discount + (input.extraDiscount ?? 0)));
  const currentCharges = money(gross - discount);
  const previousDue = money(priorDue - before.advance);
  const billId = new Types.ObjectId();
  const bill = {
    _id: billId,
    billNo: await generateSequenceCode("mess_bill", settings.billPrefix || "MB", 5, true),
    membershipId: m._id,
    studentId: m.studentId,
    messId: m.messId,
    roomId: m.roomId,
    seatId: m.seatId,
    period: input.period,
    periodKey: input.period,
    issueDate,
    dueDate: input.dueDate || periodDate(input.period, cfg.dueDay),
    items,
    discount,
    adjustment: 0,
    previousDue,
    currentCharges,
    totalPayable: billTotalPayable(currentCharges, previousDue),
    paidAmount: 0,
    dueAmount: currentCharges,
    status: currentCharges > 0 ? "unpaid" : "paid",
    source: ctx.source,
    notes: input.notes,
    generatedBy: ctx.req ? actorId(ctx.req) : undefined,
  };
  try {
    await MessBill.create(bill);
  } catch (err) {
    // The unique {membershipId, periodKey} index — a concurrent/duplicate
    // generation run for the same month lands here, never as a second bill.
    if (isDuplicateKeyError(err)) return { kind: "exists" };
    throw err;
  }
  if (includesSetup) await MessMembership.updateOne({ _id: m._id, setupChargeBilled: false }, { $set: { setupChargeBilled: true } });
  await recomputeLedger(m._id as Types.ObjectId);
  return { kind: "created", billId };
}

/** Bill-generated SMS for a batch of new bills, at the shared bulk concurrency — never one burst per member. */
async function sendBillSmsBatch(billIds: Types.ObjectId[]): Promise<void> {
  if (billIds.length === 0) return;
  const settings = await getMessSettings();
  const { isMessSmsEnabled, sendMessEventSms, fmtTaka, periodLabel } = await import("./messSms.service");
  if (!isMessSmsEnabled(settings, "bill")) return;
  const bills = await MessBill.find({ _id: { $in: billIds } }).select("studentId messId period currentCharges previousDue totalPayable dueDate").lean();
  const { env } = await import("../../../config/env");
  await mapWithConcurrency(bills, env.SMS_BULK_CONCURRENCY, (b) =>
    sendMessEventSms({
      event: "bill",
      studentId: b.studentId,
      messId: b.messId,
      vars: { amount: fmtTaka(b.currentCharges), billingMonth: periodLabel(b.period), previousDue: fmtTaka(Math.max(0, b.previousDue)), totalPayable: fmtTaka(Math.max(0, b.totalPayable)), remainingDue: fmtTaka(Math.max(0, b.totalPayable)), dueDate: b.dueDate },
      refType: "bill",
      refId: String(b._id),
      dedupeKey: `bill:${String(b._id)}`,
    }),
  );
}

/**
 * Monthly / bulk / per-Mess / individual / scheduled bill generation — ONE
 * code path. Idempotent: re-running for the same period skips members who
 * already have a live bill (enforced by the unique index, not just the
 * pre-check), so a scheduler retry or a manual run after the automatic one
 * can never create a duplicate.
 */
export async function runBillGeneration(ctx: BillingCtx, input: GenerateBillsInput): Promise<GenerateBillsResult> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw ApiError.badRequest("Invalid billing period");
  await assertApprovalForCredit(ctx.req, input.extraDiscount);
  if (input.messId && ctx.req) await assertMessAccess(ctx.req, input.messId);
  const settings = await getMessSettings();
  const members = await eligibleMemberships(ctx, input);
  if (input.membershipIds?.length && members.length === 0) {
    throw ApiError.badRequest("নির্বাচিত সদস্য এই মাসের বিলের জন্য যোগ্য নয় (সক্রিয় নয় বা বিলিং শুরুর তারিখ পরে)");
  }
  const cfgs = await messConfigs([...new Set(members.map((m) => String(m.messId)))].map((id) => new Types.ObjectId(id)), settings);
  const fallbackCfg = { billingDay: settings.billingDay, dueDay: settings.dueDay };
  const result: GenerateBillsResult = { period: input.period, eligible: members.length, created: 0, skippedExisting: 0, skipped: [], failed: [], billIds: [] };
  const outcomes = await mapWithConcurrency(members, 4, async (m) => {
    try {
      return { m, outcome: await buildBillForMember(ctx, m, input, settings, cfgs.get(String(m.messId)) ?? fallbackCfg) };
    } catch (err) {
      return { m, outcome: { kind: "failed", reason: err instanceof Error ? err.message : "Unknown error" } as BuildOutcome };
    }
  });
  const newBillIds: Types.ObjectId[] = [];
  for (const { m, outcome } of outcomes) {
    if (outcome.kind === "created") {
      result.created++;
      newBillIds.push(outcome.billId);
    } else if (outcome.kind === "exists") result.skippedExisting++;
    else if (outcome.kind === "skipped") result.skipped.push({ membershipId: String(m._id), membershipNo: m.membershipNo, reason: outcome.reason });
    else result.failed.push({ membershipId: String(m._id), membershipNo: m.membershipNo, reason: outcome.reason });
  }
  if (result.created > 0 || result.skippedExisting > 0) {
    const live = await MessBill.find({ membershipId: { $in: members.map((m) => m._id) }, periodKey: input.period }).select("_id").lean();
    result.billIds = live.map((b) => String(b._id));
  }
  await recordAudit({
    req: ctx.req,
    action: ctx.source === "auto" ? "mess.bill.auto-generate" : "mess.bill.generate",
    module: "mess",
    targetCollection: "messbills",
    after: {
      period: input.period,
      messId: input.messId,
      source: ctx.source,
      membershipIds: input.membershipIds,
      additionalCharges: input.additionalCharges,
      extraDiscount: input.extraDiscount,
      eligible: result.eligible,
      created: result.created,
      skippedExisting: result.skippedExisting,
      skipped: result.skipped.length,
      failed: result.failed.length,
    },
  });
  // The scheduler awaits the SMS batch (serverless may freeze afterwards); an operator's request does not wait on it.
  if (ctx.source === "auto") await sendBillSmsBatch(newBillIds).catch(() => undefined);
  else void sendBillSmsBatch(newBillIds).catch(() => undefined);
  return result;
}

export async function generateBills(req: Request, input: GenerateBillsInput): Promise<GenerateBillsResult> {
  return runBillGeneration({ req, source: "manual" }, input);
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
  return cancelBillDoc(req, bill, reason);
}

/** Shared by the cancel action and the joining-date correction. Payments are never touched — they stay on the ledger and FIFO re-allocates them. */
export async function cancelBillDoc(req: Request, bill: MessBillDoc, reason: string): Promise<MessBillDoc> {
  if (bill.status === "cancelled") throw ApiError.conflict("বিলটি ইতিমধ্যে বাতিল");
  if (await MessSettlement.exists({ membershipId: bill.membershipId, status: { $in: ["approved", "completed"] } })) {
    throw ApiError.conflict("এই সদস্যের চূড়ান্ত নিষ্পত্তি অনুমোদিত/সম্পন্ন — বিল বাতিল করা যাবে না");
  }
  const id = String(bill._id);
  const updated = await MessBill.findOneAndUpdate(
    { _id: bill._id, status: { $ne: "cancelled" } },
    { $set: { status: "cancelled", periodKey: `${bill.period}#cancelled#${id}`, cancelledAt: new Date(), cancelledBy: actorId(req), cancelReason: reason, paidAmount: 0, dueAmount: 0 } },
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
  bill.totalPayable = billTotalPayable(currentCharges, bill.previousDue);
  await bill.save();
  await recomputeLedger(bill.membershipId);
  await recordAudit({ req, action: "mess.bill.adjust", module: "mess", targetCollection: "messbills", targetId: id, before, after: bill.toObject() });
  return (await MessBill.findById(bill._id))!;
}

export { todayISO };
