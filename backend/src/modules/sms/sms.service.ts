import { Request } from "express";
import { SmsLog, SmsLogDoc, SmsLogEventType, SmsLogStatus, SmsSettings, SmsSettingsDoc } from "./sms.model";
import {
  SMS_EVENT_TYPES,
  SMS_EVENT_VARIABLES,
  SmsEventType,
  SmsProviderName,
  SmsTemplatedEvent,
} from "./sms.constants";
import { bulkSmsBdProvider } from "./providers/bulksmsbd.provider";
import { createAlphaProvider, getAlphaReport } from "./providers/alpha.provider";
import { SmsProvider } from "./providers/types";
import { validateTemplatePlaceholders } from "./sms.template";
import { getOrCreateSingleton } from "../../common/utils/singleton";
import { recordAudit } from "../../audit/auditLog.service";
import { ApiError } from "../../common/utils/ApiError";
import { buildMeta, parsePagination } from "../../common/utils/pagination";
import { logger } from "../../logger/logger";

// -------------------- Settings (safe read / writes) --------------------

async function getSettingsDoc(): Promise<SmsSettingsDoc> {
  return getOrCreateSingleton(SmsSettings, {} as SmsSettingsDoc);
}

/** Includes the real Alpha API key — ONLY for internal use (resolving a provider to actually send, or building the masked preview below). Never returned from a controller. */
async function getSettingsWithSecret(): Promise<SmsSettingsDoc> {
  let doc = await SmsSettings.findOne().select("+alpha.apiKey");
  if (!doc) doc = await SmsSettings.create({});
  return doc;
}

function maskApiKey(key?: string): string | undefined {
  if (!key) return undefined;
  const tail = key.slice(-4);
  return `${"*".repeat(Math.max(0, key.length - 4))}${tail}`;
}

/**
 * The shape returned to the frontend (Admin SMS Settings §3/§18/§19) — the
 * real `alpha.apiKey` never appears here, only whether one is configured and
 * a masked preview (last 4 characters) so an Admin can tell which key is
 * currently saved without it ever crossing the network in full.
 */
export async function getSmsSettingsForApi(): Promise<{
  activeProvider: SmsProviderName;
  alpha: { apiKeyConfigured: boolean; apiKeyMasked?: string; senderId?: string; contentId?: string };
  events: Record<SmsEventType, boolean>;
  templates: { admission: string; payment: string; birthday: string };
}> {
  const doc = await getSettingsWithSecret();
  return {
    activeProvider: doc.activeProvider,
    alpha: {
      apiKeyConfigured: Boolean(doc.alpha?.apiKey),
      apiKeyMasked: maskApiKey(doc.alpha?.apiKey),
      senderId: doc.alpha?.senderId,
      contentId: doc.alpha?.contentId,
    },
    events: doc.events,
    templates: doc.templates,
  };
}

/** Redacts the one secret field before it's ever handed to recordAudit — AuditLog stores before/after verbatim and is readable by anyone with AUDIT_READ, so the raw key must never reach it (Security §18). */
function redactedAlphaSnapshot(doc: SmsSettingsDoc): Record<string, unknown> {
  const obj = doc.toObject() as Record<string, unknown>;
  const alpha = obj.alpha as Record<string, unknown> | undefined;
  if (alpha && "apiKey" in alpha) {
    return { ...obj, alpha: { ...alpha, apiKey: alpha.apiKey ? "[REDACTED]" : undefined } };
  }
  return obj;
}

export async function updateActiveProvider(req: Request, activeProvider: SmsProviderName): Promise<void> {
  const doc = await getSettingsDoc();
  const before = doc.toObject();
  doc.activeProvider = activeProvider;
  await doc.save();
  await recordAudit({ req, action: "sms.provider.update", module: "sms", targetCollection: "smssettings", targetId: String(doc._id), before, after: doc.toObject() });
}

export async function updateAlphaSettings(
  req: Request,
  patch: { apiKey?: string; senderId?: string; contentId?: string },
): Promise<void> {
  const doc = await getSettingsWithSecret();
  const before = redactedAlphaSnapshot(doc);
  if (typeof patch.apiKey === "string" && patch.apiKey.trim()) doc.alpha.apiKey = patch.apiKey.trim();
  if (patch.senderId !== undefined) doc.alpha.senderId = patch.senderId.trim() || undefined;
  if (patch.contentId !== undefined) doc.alpha.contentId = patch.contentId.trim() || undefined;
  await doc.save();
  await recordAudit({
    req,
    action: "sms.alpha-settings.update",
    module: "sms",
    targetCollection: "smssettings",
    targetId: String(doc._id),
    before,
    after: redactedAlphaSnapshot(doc),
  });
}

export async function updateEvents(req: Request, patch: Partial<Record<SmsEventType, boolean>>): Promise<Record<SmsEventType, boolean>> {
  const doc = await getSettingsDoc();
  const before = doc.toObject();
  doc.events = { ...doc.events, ...patch };
  await doc.save();
  await recordAudit({ req, action: "sms.events.update", module: "sms", targetCollection: "smssettings", targetId: String(doc._id), before, after: doc.toObject() });
  return doc.events;
}

/**
 * "result" is intentionally not handled here — it's routed to the existing
 * exam.service.ts's updateResultSmsTemplate (Template Management §5: "do
 * not create duplicate template storage"). Dynamic import avoids a static
 * dependency cycle between the exams and sms modules.
 */
export async function updateEventTemplate(req: Request, event: SmsTemplatedEvent, template: string): Promise<string> {
  const unknown = validateTemplatePlaceholders(template, SMS_EVENT_VARIABLES[event].map((v) => v.key));
  if (unknown.length > 0) {
    throw ApiError.badRequest(`টেমপ্লেটে অসমর্থিত ভ্যারিয়েবল আছে: ${unknown.map((k) => `{{${k}}}`).join(", ")}`);
  }
  const doc = await getSettingsDoc();
  const before = doc.toObject();
  doc.templates[event] = template;
  await doc.save();
  await recordAudit({ req, action: "sms.template.update", module: "sms", targetCollection: "smssettings", targetId: String(doc._id), before, after: doc.toObject() });
  return doc.templates[event];
}

// -------------------- Provider resolution --------------------

async function resolveActiveProvider(): Promise<{ provider: SmsProvider; name: SmsProviderName }> {
  const doc = await getSettingsWithSecret();
  if (doc.activeProvider === "alpha") {
    return {
      provider: createAlphaProvider({ apiKey: doc.alpha?.apiKey || "", senderId: doc.alpha?.senderId, contentId: doc.alpha?.contentId }),
      name: "alpha",
    };
  }
  return { provider: bulkSmsBdProvider, name: "bulksmsbd" };
}

/** Exported so a caller with an expensive per-recipient loop (exam.service.ts's submitResult) can skip the whole loop up front instead of discovering "disabled" one guardian lookup at a time — sendSms() below still checks this itself too, so it's always enforced even for a caller that doesn't. */
export async function isEventEnabled(eventType: SmsEventType): Promise<boolean> {
  const doc = await getSettingsDoc();
  return Boolean(doc.events[eventType]);
}

// -------------------- The common send entrypoint --------------------

export interface SendSmsParams {
  to: string;
  message: string;
  /**
   * Determines both the SmsLog category AND, for the 4 configurable events
   * (admission/payment/birthday/result), whether the backend actually
   * allows the send at all (Admin SMS Settings §4: "the backend must
   * enforce them"). "login" (the existing login-credential SMS) and "test"
   * (Test SMS §15) are never gated — they always attempt to send, matching
   * the login flow's existing unconditional behavior.
   */
  eventType: SmsLogEventType;
  studentId?: string;
  staffId?: string;
}

export interface SendSmsResult {
  ok: boolean;
  status: SmsLogStatus;
  providerRequestId?: string;
  errorCode?: string;
  errorMessage?: string;
}

async function writeLog(params: SendSmsParams, provider: SmsProviderName, result: Partial<SendSmsResult>, status: SmsLogStatus): Promise<void> {
  try {
    await SmsLog.create({
      studentId: params.studentId,
      staffId: params.staffId,
      recipient: params.to,
      eventType: params.eventType,
      provider,
      message: params.message,
      status,
      providerRequestId: result.providerRequestId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      sentForDate: params.eventType === "birthday" ? new Date().toISOString().slice(0, 10) : undefined,
      sentAt: status === "sent" ? new Date() : undefined,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write SMS log");
  }
}

/**
 * THE one common SMS service every event trigger calls (SMS Provider
 * Upgrade §2: "the event system should call ONE common SMS service").
 * Admission/Payment/Birthday/Result never talk to a provider directly and
 * never know which gateway is active — this resolves it from SmsSettings
 * every time, so switching providers takes effect on the very next send
 * with no code change anywhere else (§16). Never throws — a failed or
 * disabled SMS must never block the business operation that triggered it
 * (§17); callers just get `{ok:false}` back to log/toast or ignore.
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  try {
    if ((SMS_EVENT_TYPES as readonly string[]).includes(params.eventType)) {
      const enabled = await isEventEnabled(params.eventType as SmsEventType);
      if (!enabled) {
        await writeLog(params, (await getSettingsDoc()).activeProvider, {}, "disabled");
        return { ok: false, status: "disabled" };
      }
    }

    const { provider, name } = await resolveActiveProvider();
    const sendResult = await provider.send({ to: params.to, message: params.message });
    const status: SmsLogStatus = sendResult.ok ? "sent" : "failed";
    await writeLog(params, name, sendResult, status);
    return { ok: sendResult.ok, status, providerRequestId: sendResult.providerRequestId, errorCode: sendResult.errorCode, errorMessage: sendResult.errorMessage };
  } catch (err) {
    logger.error({ err }, "sendSms failed unexpectedly");
    return { ok: false, status: "failed", errorMessage: "SMS পাঠাতে অপ্রত্যাশিত ত্রুটি হয়েছে" };
  }
}

// -------------------- Test SMS (§15) --------------------

/** Bypasses every event toggle by construction ("test" is not in SMS_EVENT_TYPES) — Admin/Super Admin only, enforced at the route layer (PERMISSIONS.SMS_MANAGE). */
export async function sendTestSms(to: string, message: string): Promise<SendSmsResult> {
  return sendSms({ to, message, eventType: "test" });
}

// -------------------- Balance (§12) --------------------

export async function checkBalance(): Promise<{ provider: SmsProviderName; ok: boolean; balance?: string; errorMessage?: string; supported: boolean }> {
  const { provider, name } = await resolveActiveProvider();
  if (!provider.getBalance) {
    return { provider: name, ok: false, supported: false, errorMessage: "এই প্রোভাইডারের জন্য ব্যালেন্স চেক সমর্থিত নয়" };
  }
  const result = await provider.getBalance();
  return { provider: name, ok: result.ok, balance: result.balance, errorMessage: result.errorMessage, supported: true };
}

// -------------------- Delivery report (§13, Alpha only) --------------------

export async function getDeliveryReport(requestId: string) {
  const doc = await getSettingsWithSecret();
  if (doc.activeProvider !== "alpha" || !doc.alpha?.apiKey) {
    throw ApiError.badRequest("ডেলিভারি রিপোর্ট শুধু Alpha SMS সক্রিয় থাকলে দেখা যাবে");
  }
  return getAlphaReport(doc.alpha.apiKey, requestId);
}

// -------------------- SMS History / Log (§14) --------------------

export async function listSmsLogs(req: Request): Promise<{ items: SmsLogDoc[]; meta: ReturnType<typeof buildMeta> }> {
  const { page, limit, skip, sort } = parsePagination(req, { createdAt: -1 });
  const filter: Record<string, unknown> = {};
  if (req.query.eventType) filter.eventType = req.query.eventType;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.studentId) filter.studentId = req.query.studentId;

  const [items, total] = await Promise.all([
    SmsLog.find(filter).sort(sort).skip(skip).limit(limit),
    SmsLog.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}
