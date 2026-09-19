/**
 * Thin fetch wrapper for the LaraLMS backend (Phase 3).
 * - Unwraps the `{ success, data, error, meta }` envelope every backend route uses.
 * - Carries the short-lived access token in memory (never localStorage) and
 *   sends the httpOnly refresh cookie automatically via `credentials: "include"`.
 * - Retries exactly once on a 401 by calling /auth/refresh, then gives up and
 *   signals the app to log out — this is what makes "log in once, stay in"
 *   work without ever putting a long-lived token somewhere JS can read it back.
 */

export const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || "http://neuron-raj.vercel.app/api/v1";




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

async function rawFormRequest<T>(path: string, formData: FormData): Promise<{ body: Envelope<T>; status: number }> {
  const headers = new Headers();
  // No Content-Type here on purpose — the browser sets the correct
  // multipart/form-data boundary itself; setting it manually breaks upload.
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, credentials: "include", body: formData });
  const body = (await res.json().catch(() => ({ success: false, error: { code: "PARSE_ERROR", message: "Invalid server response" } }))) as Envelope<T>;
  return { body, status: res.status };
}

/** Appends which field(s) failed validation to the error message, so a toast never shows a bare "Invalid input" with no indication of what to fix. */
function describeError(message: string | undefined, fields?: Record<string, string[]>): string {
  const base = message ?? "Request failed";
  if (!fields || Object.keys(fields).length === 0) return base;
  const detail = Object.entries(fields)
    .map(([field, msgs]) => `${field === "_" ? "" : field + ": "}${msgs.join(", ")}`)
    .join("; ");
  return `${base} — ${detail}`;
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

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const { body, status } = await rawRequest<T>(path, options);

  if (status === 401 && !isRetry && path !== "/auth/login" && path !== "/auth/refresh") {
    const refreshed = hasRefreshCapability && (await tryRefresh());
    if (refreshed) return request<T>(path, options, true);
    setAccessToken(null);
    onUnauthorized?.();
  }

  if (!body.success) {
    throw new ApiClientError(status, body.error?.code ?? "UNKNOWN", describeError(body.error?.message, body.error?.fields), body.error?.fields);
  }
  return { data: body.data as T, meta: body.meta };
}

async function formRequest<T>(path: string, formData: FormData, isRetry = false): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const { body, status } = await rawFormRequest<T>(path, formData);

  if (status === 401 && !isRetry) {
    const refreshed = hasRefreshCapability && (await tryRefresh());
    if (refreshed) return formRequest<T>(path, formData, true);
    setAccessToken(null);
    onUnauthorized?.();
  }

  if (!body.success) {
    throw new ApiClientError(status, body.error?.code ?? "UNKNOWN", describeError(body.error?.message, body.error?.fields), body.error?.fields);
  }
  return { data: body.data as T, meta: body.meta };
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }).then((r) => r.data),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }).then((r) => r.data),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }).then((r) => r.data),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }).then((r) => r.data),
  /**
   * Same as `get`, but also returns the response envelope's `meta` (page/
   * limit/total/totalPages) — needed by pages that do real server-side
   * pagination instead of the "fetch up to 100, filter client-side" pattern
   * most existing list pages use (Admission Result feature).
   */
  getWithMeta: <T>(path: string) => request<T>(path, { method: "GET" }),
  /**
   * POST with a `multipart/form-data` body (file upload) — used by the
   * Admission Result PDF import. Everything else about auth/refresh/error
   * handling is identical to `post`, just without JSON-encoding the body.
   */
  postForm: <T>(path: string, formData: FormData) => formRequest<T>(path, formData).then((r) => r.data),
  /**
   * GET a binary response (e.g. the Bulk Student Upload .xlsx template) and
   * trigger a browser download — the JSON envelope helpers above can't be
   * used here since the endpoint returns the file bytes directly, not
   * `{success,data}`. No 401-refresh retry (template download isn't worth
   * the complexity); a stale token just surfaces as a toast-able error.
   */
  downloadFile: async (path: string, filename: string): Promise<void> => {
    const headers = new Headers();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    const res = await fetch(`${BASE_URL}${path}`, { headers, credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiClientError(res.status, body?.error?.code ?? "UNKNOWN", describeError(body?.error?.message, body?.error?.fields));
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
