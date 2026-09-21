import { logger } from "../../../logger/logger";
import { alphaErrorMessage } from "../sms.constants";
import { toGatewayFormat } from "../sms.util";
import { SmsBalanceResult, SmsProvider, SmsSendParams, SmsSendResult } from "./types";

const SEND_URL = "https://api.sms.net.bd/sendsms";
const BALANCE_URL = "https://api.sms.net.bd/user/balance/";
const reportUrl = (requestId: string) => `https://api.sms.net.bd/report/request/${encodeURIComponent(requestId)}/`;

export interface AlphaSmsConfig {
  apiKey: string;
  senderId?: string;
  contentId?: string;
}

interface AlphaResponse<T> {
  error: number;
  msg: string;
  data?: T;
}

/**
 * Alpha SMS / sms.net.bd (SMS Provider Upgrade §10/§11). Endpoints are
 * fixed, server-side constants — never admin/frontend-configurable (Security
 * §18: "do not allow frontend to select an arbitrary SMS gateway URL").
 * Uses the platform `fetch` already used by bulksmsbd.provider.ts — no new
 * HTTP dependency.
 */
export function createAlphaProvider(config: AlphaSmsConfig): SmsProvider {
  return {
    name: "alpha",

    async send({ to, message }: SmsSendParams): Promise<SmsSendResult> {
      if (!config.apiKey) {
        return { ok: false, errorMessage: "Alpha SMS API Key কনফিগার করা নেই" };
      }
      try {
        const body = new URLSearchParams({ api_key: config.apiKey, msg: message, to: toGatewayFormat(to) });
        if (config.senderId) body.set("sender_id", config.senderId);
        if (config.contentId) body.set("content_id", config.contentId);

        const res = await fetch(SEND_URL, { method: "POST", body });
        const json = (await res.json().catch(() => undefined)) as AlphaResponse<{ request_id: number }> | undefined;
        if (!json) {
          return { ok: false, errorMessage: "Alpha SMS থেকে অপ্রত্যাশিত সাড়া পাওয়া গেছে" };
        }
        if (json.error === 0) {
          return { ok: true, providerRequestId: json.data?.request_id != null ? String(json.data.request_id) : undefined };
        }
        return { ok: false, errorCode: String(json.error), errorMessage: alphaErrorMessage(json.error) };
      } catch (err) {
        logger.error({ err }, "Alpha SMS send failed");
        return { ok: false, errorMessage: "Alpha SMS-এর সাথে সংযোগ করা যায়নি" };
      }
    },

    async getBalance(): Promise<SmsBalanceResult> {
      if (!config.apiKey) return { ok: false, errorMessage: "Alpha SMS API Key কনফিগার করা নেই" };
      try {
        const qs = new URLSearchParams({ api_key: config.apiKey });
        const res = await fetch(`${BALANCE_URL}?${qs.toString()}`);
        const json = (await res.json().catch(() => undefined)) as AlphaResponse<{ balance: string }> | undefined;
        if (!json) return { ok: false, errorMessage: "Alpha SMS থেকে অপ্রত্যাশিত সাড়া পাওয়া গেছে" };
        if (json.error === 0) return { ok: true, balance: json.data?.balance };
        return { ok: false, errorMessage: alphaErrorMessage(json.error) };
      } catch (err) {
        logger.error({ err }, "Alpha SMS balance check failed");
        return { ok: false, errorMessage: "Alpha SMS-এর সাথে সংযোগ করা যায়নি" };
      }
    },
  };
}

export interface AlphaReportRecipient {
  number: string;
  charge: string;
  status: string;
}

export interface AlphaReportResult {
  ok: boolean;
  requestStatus?: string;
  recipients?: AlphaReportRecipient[];
  errorMessage?: string;
}

/**
 * Delivery report lookup (SMS Provider Upgrade §13) — best-effort, called
 * on demand from the SMS History view using the stored providerRequestId.
 * Never invoked automatically for every SMS (no polling infrastructure is
 * introduced here, per "do not over-engineer" if the system lacks one).
 */
export async function getAlphaReport(apiKey: string, requestId: string): Promise<AlphaReportResult> {
  if (!apiKey) return { ok: false, errorMessage: "Alpha SMS API Key কনফিগার করা নেই" };
  try {
    const qs = new URLSearchParams({ api_key: apiKey });
    const res = await fetch(`${reportUrl(requestId)}?${qs.toString()}`);
    const json = (await res.json().catch(() => undefined)) as
      | AlphaResponse<{ request_status: string; recipients: AlphaReportRecipient[] }>
      | undefined;
    if (!json) return { ok: false, errorMessage: "Alpha SMS থেকে অপ্রত্যাশিত সাড়া পাওয়া গেছে" };
    if (json.error === 0) {
      return { ok: true, requestStatus: json.data?.request_status, recipients: json.data?.recipients };
    }
    return { ok: false, errorMessage: alphaErrorMessage(json.error) };
  } catch (err) {
    logger.error({ err }, "Alpha SMS report lookup failed");
    return { ok: false, errorMessage: "Alpha SMS-এর সাথে সংযোগ করা যায়নি" };
  }
}
