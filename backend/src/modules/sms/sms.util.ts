/**
 * Bangladeshi mobile numbers are stored/entered as 11-digit local format
 * (01XXXXXXXXX) everywhere in this app, but every SMS gateway this codebase
 * has integrated (BulkSMSBD, and now Alpha SMS — its own docs show the exact
 * same `8801800000000` example) expects the 88-country-code-prefixed form —
 * this is the one place that translation happens, shared by every provider
 * so neither one silently corrupts a number differently from the other
 * (Alpha SMS Provider Implementation §10 — "reuse the existing phone
 * normalization utility"). Moved here unchanged from the old
 * common/utils/sms.ts (BulkSMSBD's own private copy) when the provider
 * abstraction was introduced.
 */
export function toGatewayFormat(number: string): string {
  const digits = number.replace(/\D/g, "");
  if (digits.startsWith("88")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return digits;
}
