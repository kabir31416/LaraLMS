import { env } from "../../../config/env";
import { logger } from "../../../logger/logger";
import { toGatewayFormat } from "../sms.util";
import { BULKSMSBD_SUCCESS_CODE, bulksmsbdErrorMessage } from "../sms.constants";
import { SmsBalanceResult, SmsProvider, SmsSendParams, SmsSendResult } from "./types";

const BALANCE_URL = "http://bulksmsbd.net/api/getBalanceApi";

export interface BulkSmsBdConfig {
  apiKey: string;
  senderId: string;
}

/** BulkSMSBD's response body can be JSON (`{"response_code":202,...}`) or plain text ("202") depending on account/gateway — both are handled so a real response is never mistaken for a parse failure. */
function extractResponseCode(raw: string): number | undefined {
  const trimmed = raw.trim();
  try {
    const json = JSON.parse(trimmed) as { response_code?: number | string };
    if (json.response_code !== undefined) {
      const code = Number(json.response_code);
      if (!Number.isNaN(code)) return code;
    }
  } catch {
    // not JSON — fall through to plain-number parsing below
  }
  const plain = Number(trimmed);
  return Number.isNaN(plain) ? undefined : plain;
}

function extractBalance(raw: string): string | undefined {
  const trimmed = raw.trim();
  try {
    const json = JSON.parse(trimmed) as { balance?: number | string };
    if (json.balance !== undefined) return String(json.balance);
  } catch {
    // not JSON — the whole body may just be the balance figure
  }
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? trimmed : undefined;
}

/**
 * BulkSMSBD (bulksmsbd.net) — moved unchanged in spirit from the old
 * common/utils/sms.ts's sendSms() when the multi-provider abstraction was
 * introduced (SMS Provider Upgrade §1/§21: "do not remove, break, or
 * rewrite the existing BulkSMSBD integration"), now a config-driven factory
 * so the same credentials can come from Settings (Admin-editable) or the
 * original env vars (sms.service.ts's resolveActiveProvider decides which).
 * Same request shape, same never-throws contract. Response codes (202 =
 * success, everything else documented in sms.constants.ts's
 * BULKSMSBD_ERROR_MESSAGES) are now parsed from the actual response body
 * instead of relying on HTTP status alone, since BulkSMSBD's own API
 * reports success/failure in the body, not the status code.
 */
export function createBulkSmsBdProvider(config: BulkSmsBdConfig): SmsProvider {
  return {
    name: "bulksmsbd",

    async send({ to, message }: SmsSendParams): Promise<SmsSendResult> {
      if (!config.apiKey || !config.senderId) {
        return { ok: false, errorMessage: "BulkSMSBD কনফিগার করা নেই" };
      }

      try {
        const res = await fetch(env.SMS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            api_key: config.apiKey,
            senderid: config.senderId,
            number: toGatewayFormat(to),
            message,
          }),
        });
        const text = await res.text();
        const code = extractResponseCode(text);

        if (code === BULKSMSBD_SUCCESS_CODE) return { ok: true };
        if (code !== undefined) {
          return { ok: false, errorCode: String(code), errorMessage: bulksmsbdErrorMessage(code) };
        }
        // Response body didn't parse as a known code shape — fall back to
        // HTTP status, the only signal available in that case.
        if (!res.ok) {
          logger.warn({ status: res.status, body: text }, "BulkSMSBD returned a non-OK status with an unparseable body");
          return { ok: false, errorMessage: "BulkSMSBD পাঠাতে ব্যর্থ হয়েছে", errorCode: String(res.status) };
        }
        return { ok: true };
      } catch (err) {
        logger.error({ err }, "BulkSMSBD send failed");
        return { ok: false, errorMessage: "BulkSMSBD-এর সাথে সংযোগ করা যায়নি" };
      }
    },

    async getBalance(): Promise<SmsBalanceResult> {
      if (!config.apiKey) return { ok: false, errorMessage: "BulkSMSBD কনফিগার করা নেই" };
      try {
        const qs = new URLSearchParams({ api_key: config.apiKey });
        const res = await fetch(`${BALANCE_URL}?${qs.toString()}`);
        const text = await res.text();
        const balance = extractBalance(text);
        if (balance !== undefined) return { ok: true, balance };
        logger.warn({ status: res.status, body: text }, "BulkSMSBD balance response could not be parsed");
        return { ok: false, errorMessage: "BulkSMSBD থেকে অপ্রত্যাশিত সাড়া পাওয়া গেছে" };
      } catch (err) {
        logger.error({ err }, "BulkSMSBD balance check failed");
        return { ok: false, errorMessage: "BulkSMSBD-এর সাথে সংযোগ করা যায়নি" };
      }
    },
  };
}
