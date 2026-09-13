/**
 * Thin fetch wrapper for the LaraLMS backend (Phase 3).
 * - Unwraps the `{ success, data, error, meta }` envelope every backend route uses.
 * - Carries the short-lived access token in memory (never localStorage) and
 *   sends the httpOnly refresh cookie automatically via `credentials: "include"`.
 * - Retries exactly once on a 401 by calling /auth/refresh, then gives up and
 *   signals the app to log out — this is what makes "log in once, stay in"
 *   work without ever putting a long-lived token somewhere JS can read it back.
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:5000/api/v1";

export class ApiClientError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string[]>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let refreshInFlight: Promise<boolean> | null = null;
// A Student/Staff Portal session (auth.service.ts's studentLogin/staffLogin)
// has no httpOnly refresh cookie at all — /auth/refresh can never succeed
// for one. Without this flag, a 401 on an expired portal token still tried
// that doomed refresh first, adding a full extra round-trip of visible
// "stuck loading" before the inevitable logout. AuthContext toggles this
// depending on which kind of session is active.
let hasRefreshCapability = true;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function setHasRefreshCapability(v: boolean) {
  hasRefreshCapability = v;
}
/** AuthContext registers this once to hear "the session is gone, log the UI out." */
export function onSessionExpired(cb: () => void) {
  onUnauthorized = cb;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; fields?: Record<string, string[]> };
  meta?: Record<string, unknown>;
}

async function rawRequest<T>(path: string, options: RequestInit): Promise<{ body: Envelope<T>; status: number }> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: "include" });
  const body = (await res.json().catch(() => ({ success: false, error: { code: "PARSE_ERROR", message: "Invalid server response" } }))) as Envelope<T>;
  return { body, status: res.status };
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = rawRequest<{ accessToken: string }>("/auth/refresh", { method: "POST" })
      .then(({ body, status }) => {
        if (status === 200 && body.data?.accessToken) {
          setAccessToken(body.data.accessToken);
          return true;
        }
        return false;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const { body, status } = await rawRequest<T>(path, options);

  if (status === 401 && !isRetry && path !== "/auth/login" && path !== "/auth/refresh") {
    const refreshed = hasRefreshCapability && (await tryRefresh());
    if (refreshed) return request<T>(path, options, true);
    setAccessToken(null);
    onUnauthorized?.();
  }

  if (!body.success) {
    throw new ApiClientError(status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "Request failed", body.error?.fields);
  }
  return body.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
