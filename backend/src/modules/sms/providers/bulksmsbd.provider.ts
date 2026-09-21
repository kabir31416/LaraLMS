import { env } from "../../../config/env";
import { logger } from "../../../logger/logger";
import { toGatewayFormat } from "../sms.util";
import { SmsProvider, SmsSendParams, SmsSendResult } from "./types";

/**
 * BulkSMSBD (or a compatible gateway) — moved unchanged from the old
 * common/utils/sms.ts's sendSms() when the multi-provider abstraction was
 * introduced (SMS Provider Upgrade §1/§21: "do not remove, break, or
 * rewrite the existing BulkSMSBD integration"). Same env vars
 * (SMS_API_KEY/SMS_SENDER_ID/SMS_API_URL), same request shape, same
 * silent-no-op-when-unconfigured behavior, same never-throws contract.
 */
export const bulkSmsBdProvider: SmsProvider = {
  name: "bulksmsbd",

  async send({ to, message }: SmsSendParams): Promise<SmsSendResult> {
    if (!env.SMS_API_KEY || !env.SMS_SENDER_ID) {
      logger.warn("BulkSMSBD not configured (SMS_API_KEY/SMS_SENDER_ID missing) — skipping send");
      return { ok: false, errorMessage: "BulkSMSBD কনফিগার করা নেই" };
    }

    try {
      const res = await fetch(env.SMS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          api_key: env.SMS_API_KEY,
          senderid: env.SMS_SENDER_ID,
          number: toGatewayFormat(to),
          message,
        }),
      });
      const response = await res.json().catch(() => undefined);
      if (!res.ok) {
        logger.warn({ status: res.status, response }, "BulkSMSBD returned a non-OK status");
        return { ok: false, errorMessage: "BulkSMSBD পাঠাতে ব্যর্থ হয়েছে", errorCode: String(res.status) };
      }
      return { ok: true };
    } catch (err) {
      logger.error({ err }, "BulkSMSBD send failed");
      return { ok: false, errorMessage: "BulkSMSBD-এর সাথে সংযোগ করা যায়নি" };
    }
  },

  // No documented balance endpoint for BulkSMSBD in this codebase (Alpha SMS
  // Balance §12 — "if provider is BulkSMSBD, use the existing BulkSMSBD
  // balance mechanism if already available"; none exists, so none is added).
};
