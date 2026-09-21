/**
 * Provider abstraction (SMS Provider Upgrade §2/§10) — every gateway
 * (BulkSMSBD, Alpha SMS, and anything added later) implements exactly this
 * shape. sms.service.ts is the ONLY caller of `.send()`/`.getBalance()` —
 * Admission/Payment/Birthday/Result SMS never import a provider directly.
 */
export interface SmsSendParams {
  to: string;
  message: string;
}

export interface SmsSendResult {
  ok: boolean;
  /** The gateway's own id for this send (Alpha's request_id) — stored on SmsLog for future delivery-report lookups, never used for anything security-sensitive. */
  providerRequestId?: string;
  /** Safe-to-display failure reason (already mapped from any raw provider error code) — never the raw provider response body. */
  errorMessage?: string;
  /** The raw provider error code, kept for backend logs/SmsLog only (§11) — never shown to a role below Admin, never returned in a public API. */
  errorCode?: string;
}

export interface SmsBalanceResult {
  ok: boolean;
  balance?: string;
  errorMessage?: string;
}

export interface SmsProvider {
  name: string;
  send(params: SmsSendParams): Promise<SmsSendResult>;
  /** Optional — not every gateway exposes a balance API (BulkSMSBD doesn't have one wired up in this codebase). */
  getBalance?(): Promise<SmsBalanceResult>;
}
