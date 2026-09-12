import { env } from "../../config/env";
import { logger } from "../../logger/logger";

/**
 * Bangladeshi mobile numbers are stored/entered as 11-digit local format
 * (01XXXXXXXXX) everywhere in this app, but BulkSMSBD's API expects the
 * 88-country-code-prefixed form (8801XXXXXXXXX) — this is the one place
 * that translation happens.
 */
function toGatewayFormat(number: string): string {
  const digits = number.replace(/\D/g, "");
  if (digits.startsWith("88")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return digits;
}

/**
 * Best-effort SMS send via BulkSMSBD (or a compatible gateway). Never
 * throws — a failed or unconfigured SMS gateway must never block the
 * student/login operation that triggered it; callers just get `{ok:false}`
 * back to log or ignore.
 */
export async function sendSms(numbers: string | string[], message: string): Promise<{ ok: boolean; response?: unknown }> {
  if (!env.SMS_API_KEY || !env.SMS_SENDER_ID) {
    logger.warn("SMS gateway not configured (SMS_API_KEY/SMS_SENDER_ID missing) — skipping send");
    return { ok: false };
  }

  const numberParam = (Array.isArray(numbers) ? numbers : [numbers]).map(toGatewayFormat).join(",");

  try {
    const res = await fetch(env.SMS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        api_key: env.SMS_API_KEY,
        senderid: env.SMS_SENDER_ID,
        number: numberParam,
        message,
      }),
    });
    const response = await res.json().catch(() => undefined);
    if (!res.ok) logger.warn({ status: res.status, response }, "SMS gateway returned a non-OK status");
    return { ok: res.ok, response };
  } catch (err) {
    logger.error({ err }, "SMS send failed");
    return { ok: false };
  }
}
