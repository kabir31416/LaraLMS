import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../../common/utils/ApiError";
import { recordAudit } from "../../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../../common/utils/pagination";
import { mapWithConcurrency } from "../../../common/utils/concurrency";
import { env } from "../../../config/env";
import { localDayBoundary } from "../../../common/utils/localDate";
import { logger } from "../../../logger/logger";
import { SmsLog } from "../../sms/sms.model";
import { Mess } from "../models/mess.model";
import { MessMembership } from "../models/messMembership.model";
import { DEFAULT_MESS_SMS_TEMPLATES, MESS_SMS_PLACEHOLDERS, MessSmsEvent } from "../mess.constants";
import { accessibleMessIds, assertMessAccess, messScopeFilter } from "../mess.scope";
import { currentPeriod, money, todayISO, toObjectId } from "../mess.utils";
import { getMessSettings } from "./messSettings.service";
import { MessSettingsDoc } from "../models/messSettings.model";

/**
 * Mess SMS — one place that decides whether a Mess event sends an SMS, what it
 * says, and that it is never sent twice. Delivery itself always goes through
 * the shared sms.service.ts `sendSms` (BulkSMSBD / Alpha, whichever is active
 * in SMS Settings) — this file never talks to a gateway or touches API keys.
 *
 * Guarantees:
 *  - never throws into the caller: a failed SMS can never fail a payment,
 *    bill or admission;
 *  - a status is only what the provider actually answered (sent = gateway
 *    accepted; delivery is a separate, later lookup where supported);
 *  - a `dedupeKey` per notice (e.g. `payment:<id>`) — a retry or double
 *    trigger finds the earlier sent/pending row and does not send again.
 */

const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

export function periodLabel(period?: string): string {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period ?? "";
  const [y, m] = period.split("-").map(Number);
  return `${BN_MONTHS[m - 1]} ${y}`;
}

export function fmtTaka(n: number | undefined | null): string {
  return money(Number(n) || 0).toLocaleString("en-IN");
}

export type MessSmsVars = Partial<Record<(typeof MESS_SMS_PLACEHOLDERS)[number], string>>;

export function isMessSmsEnabled(settings: MessSettingsDoc, event: MessSmsEvent): boolean {
  switch (event) {
    case "payment":
      return !!settings.paymentSmsEnabled;
    case "bill":
      return !!settings.billSmsEnabled;
    case "dueReminder":
      return !!settings.dueReminderSmsEnabled;
    case "admission":
      return !!settings.admissionSmsEnabled;
    case "checkout":
      return !!settings.checkoutSmsEnabled;
  }
}

export function messTemplate(settings: MessSettingsDoc, event: MessSmsEvent): string {
  const t = settings.smsTemplates?.[event];
  return t && t.trim() ? t : DEFAULT_MESS_SMS_TEMPLATES[event];
}

/** Unknown placeholders in a template — empty means it is safe to save. */
export async function invalidPlaceholders(template: string): Promise<string[]> {
  const { validateTemplatePlaceholders } = await import("../../sms/sms.template");
  return validateTemplatePlaceholders(template, MESS_SMS_PLACEHOLDERS as unknown as string[]);
}

export async function renderMessSms(template: string, vars: MessSmsVars): Promise<string> {
  const { renderTemplate } = await import("../../sms/sms.template");
  return renderTemplate(template, vars as Record<string, string>).replace(/\s+/g, " ").trim();
}

export interface MessSmsOutcome {
  status: "sent" | "failed" | "timeout" | "disabled" | "duplicate" | "no_phone" | "error" | "pending";
  logId?: string;
  errorMessage?: string;
}

/**
 * Sends one Mess event SMS to the student's own phone (Student.phone).
 * `force` bypasses the event toggle — used only for an operator's explicit
 * manual send (e.g. "send due reminder now"), never for automatic events.
 */
export async function sendMessEventSms(params: {
  event: MessSmsEvent;
  studentId: Types.ObjectId | string;
  messId: Types.ObjectId | string;
  vars: MessSmsVars;
  refType: string;
  refId: string;
  dedupeKey: string;
  force?: boolean;
}): Promise<MessSmsOutcome> {
  try {
    const settings = await getMessSettings();
    if (!params.force && !isMessSmsEnabled(settings, params.event)) return { status: "disabled" };
    const prior = await SmsLog.findOne({ dedupeKey: params.dedupeKey, status: { $in: ["sent", "pending"] } }).select("_id status");
    if (prior) return { status: "duplicate", logId: String(prior._id) };

    const { Student } = await import("../../students/student.model");
    const [student, mess] = await Promise.all([
      Student.findById(params.studentId).select("name phone").lean(),
      Mess.findById(params.messId).select("name").lean(),
    ]);
    if (!student?.phone) return { status: "no_phone" };
    const message = await renderMessSms(messTemplate(settings, params.event), {
      studentName: student.name,
      messName: mess?.name ?? "",
      ...params.vars,
    });
    if (!message) return { status: "error", errorMessage: "Empty SMS text" };

    const { sendSms } = await import("../../sms/sms.service");
    const result = await sendSms({
      to: student.phone,
      message,
      eventType: "mess",
      studentId: String(params.studentId),
      ref: { messId: String(params.messId), refType: params.refType, refId: params.refId, dedupeKey: params.dedupeKey },
    });
    const log = await SmsLog.findOne({ dedupeKey: params.dedupeKey }).sort({ createdAt: -1 }).select("_id").lean();
    return { status: result.status === "sent" ? "sent" : result.status, logId: log ? String(log._id) : undefined, errorMessage: result.errorMessage };
  } catch (err) {
    logger.warn({ err, event: params.event, refId: params.refId }, "Mess SMS failed");
    return { status: "error", errorMessage: err instanceof Error ? err.message : "SMS error" };
  }
}

/** Fire-and-forget wrapper for business flows: the caller never waits on, or fails because of, the SMS. */
export function queueMessEventSms(params: Parameters<typeof sendMessEventSms>[0]): void {
  void sendMessEventSms(params).catch((err) => logger.warn({ err }, "Mess SMS queue failed"));
}

// -------------------- Test SMS --------------------

const SAMPLE_VARS: MessSmsVars = {
  studentName: "পরীক্ষামূলক শিক্ষার্থী",
  messName: "মেস",
  amount: "1,500",
  paymentDate: "",
  receiptNo: "MR-TEST",
  billingMonth: "",
  previousDue: "500",
  remainingDue: "0",
  paymentMethod: "Cash",
  dueDate: "",
  totalPayable: "2,000",
};

/** Sends the chosen event's current template, filled with sample values, to a phone number the operator types. Result is the provider's real answer. */
export async function sendTestMessSms(req: Request, body: { phone: string; event: MessSmsEvent; template?: string }) {
  const settings = await getMessSettings();
  const template = body.template?.trim() || messTemplate(settings, body.event);
  const unknown = await invalidPlaceholders(template);
  if (unknown.length) throw ApiError.badRequest(`অজানা placeholder: ${unknown.map((k) => `{{${k}}}`).join(", ")}`);
  const today = todayISO();
  const message = await renderMessSms(template, { ...SAMPLE_VARS, paymentDate: today, billingMonth: periodLabel(currentPeriod()), dueDate: today });
  const { sendSms } = await import("../../sms/sms.service");
  const result = await sendSms({ to: body.phone, message, eventType: "test", ref: { refType: "mess_test" } });
  await recordAudit({ req, action: "mess.sms.test", module: "mess", targetCollection: "smslogs", after: { phone: body.phone, event: body.event, status: result.status } });
  return { ...result, message };
}

// -------------------- Due reminders --------------------

export interface DueReminderResult {
  candidates: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Due-reminder SMS to every billable member with a dining-charge due.
 *  - automatic (scheduler, on the due day): respects the toggle, one per member per month
 *  - manual (operator): explicit action, one per member per day
 */
export async function sendDueReminders(opts: { messIds: Types.ObjectId[] | null; membershipIds?: Types.ObjectId[]; mode: "auto" | "manual" }): Promise<DueReminderResult> {
  const settings = await getMessSettings();
  const filter: Record<string, unknown> = { status: { $in: ["active", "on_leave", "notice_given"] }, "balance.due": { $gt: 0 } };
  if (opts.messIds) filter.messId = { $in: opts.messIds };
  if (opts.membershipIds?.length) filter._id = { $in: opts.membershipIds };
  const members = await MessMembership.find(filter).select("_id studentId messId balance.due").limit(5000).lean();
  const period = currentPeriod();
  const today = todayISO();
  const messDueDays = new Map<string, number>();
  for (const m of await Mess.find({ _id: { $in: [...new Set(members.map((x) => String(x.messId)))] } }).select("dueDay").lean()) {
    messDueDays.set(String(m._id), m.dueDay ?? settings.dueDay);
  }
  const outcomes = await mapWithConcurrency(members, env.SMS_BULK_CONCURRENCY, (m) =>
    sendMessEventSms({
      event: "dueReminder",
      studentId: m.studentId,
      messId: m.messId,
      vars: { remainingDue: fmtTaka(m.balance?.due), amount: fmtTaka(m.balance?.due), billingMonth: periodLabel(period), dueDate: `${period}-${String(messDueDays.get(String(m.messId)) ?? settings.dueDay).padStart(2, "0")}` },
      refType: "membership",
      refId: String(m._id),
      dedupeKey: opts.mode === "auto" ? `due:${String(m._id)}:${period}` : `due-manual:${String(m._id)}:${today}`,
      force: opts.mode === "manual",
    }),
  );
  const result: DueReminderResult = { candidates: members.length, sent: 0, failed: 0, skipped: 0 };
  for (const o of outcomes) {
    if (o.status === "sent" || o.status === "pending") result.sent++;
    else if (o.status === "failed" || o.status === "timeout" || o.status === "error") result.failed++;
    else result.skipped++;
  }
  return result;
}

export async function sendDueRemindersManual(req: Request, body: { messId?: string; membershipIds?: string[] }) {
  let messIds: Types.ObjectId[] | null;
  if (body.messId) {
    await assertMessAccess(req, body.messId);
    messIds = [toObjectId(body.messId, "messId")];
  } else {
    messIds = await accessibleMessIds(req);
  }
  const result = await sendDueReminders({ messIds, membershipIds: body.membershipIds?.map((id) => toObjectId(id, "membershipId")), mode: "manual" });
  await recordAudit({ req, action: "mess.sms.due-reminder", module: "mess", targetCollection: "smslogs", after: { messId: body.messId, ...result } });
  return result;
}

// -------------------- History / delivery --------------------

async function smsScope(req: Request): Promise<Record<string, unknown>> {
  const scope = await messScopeFilter(req, req.query.messId);
  const base: Record<string, unknown> = { eventType: "mess" };
  if (scope) base.messId = scope;
  return base;
}

export async function listMessSmsLogs(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const filter = await smsScope(req);
  if (typeof req.query.status === "string" && req.query.status) {
    const s = req.query.status.split(",").filter(Boolean);
    filter.status = s.length === 1 ? s[0] : { $in: s };
  }
  if (typeof req.query.refType === "string" && req.query.refType) filter.refType = req.query.refType;
  if (typeof req.query.studentId === "string" && Types.ObjectId.isValid(req.query.studentId)) filter.studentId = new Types.ObjectId(req.query.studentId);
  if (req.query.dateFrom || req.query.dateTo) {
    filter.createdAt = {
      ...(typeof req.query.dateFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.dateFrom) ? { $gte: localDayBoundary(req.query.dateFrom) } : {}),
      ...(typeof req.query.dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.dateTo) ? { $lte: localDayBoundary(req.query.dateTo, true) } : {}),
    };
  }
  const [items, total, byStatus] = await Promise.all([
    SmsLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("studentId", "name registrationId phone").populate("messId", "name").lean(),
    SmsLog.countDocuments(filter),
    SmsLog.aggregate<{ _id: string; count: number }>([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  return { items, meta: { ...buildMeta(page, limit, total), byStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.count])) } };
}

/** Failed/timeout and still-pending Mess SMS in the last 30 days — the dashboard's attention counter. */
export async function messSmsAttention(messIds: Types.ObjectId[] | null): Promise<{ failed: number; pending: number }> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const base: Record<string, unknown> = { eventType: "mess", createdAt: { $gte: since } };
  if (messIds) base.messId = { $in: messIds };
  const [failed, pending] = await Promise.all([
    SmsLog.countDocuments({ ...base, status: { $in: ["failed", "timeout"] } }),
    // A row still "pending" after 10 minutes never got a provider answer.
    SmsLog.countDocuments({ ...base, status: "pending", createdAt: { $gte: since, $lte: new Date(Date.now() - 10 * 60_000) } }),
  ]);
  return { failed, pending };
}

/** Delivery lookup for one Mess SMS (Alpha SMS only — BulkSMSBD has no delivery API). Stored separately from the acceptance status. */
export async function checkMessSmsDelivery(req: Request, id: string) {
  const log = await SmsLog.findById(toObjectId(id, "smsLogId"));
  if (!log || log.eventType !== "mess") throw ApiError.notFound("SMS log not found");
  if (log.messId) await assertMessAccess(req, log.messId);
  else if ((await accessibleMessIds(req)) !== null) throw ApiError.forbidden();
  if (!log.providerRequestId) throw ApiError.badRequest("প্রোভাইডার রিকোয়েস্ট আইডি নেই — ডেলিভারি রিপোর্ট পাওয়া যাবে না");
  const { getDeliveryReport } = await import("../../sms/sms.service");
  const report = await getDeliveryReport(log.providerRequestId);
  if (!report.ok) throw ApiError.badRequest(report.errorMessage || "ডেলিভারি রিপোর্ট পাওয়া যায়নি");
  const recipient = report.recipients?.[0];
  const deliveryStatus = recipient?.status || report.requestStatus || "unknown";
  await SmsLog.updateOne({ _id: log._id }, { $set: { deliveryStatus, deliveryCheckedAt: new Date() } });
  return { id, status: log.status, deliveryStatus, requestStatus: report.requestStatus };
}
