/**
 * A small, self-contained fetch helper for the public /studententry page
 * only — deliberately NOT a wrapper around apiClient.ts's `api` object.
 * apiClient.ts manages one long-lived Admin/Portal session (access token +
 * refresh-cookie retry) in module-level state; mixing this page's
 * short-lived, purpose-scoped verification token into that same state would
 * risk it leaking into an unrelated authenticated request, or a stale
 * Admin/Portal token leaking into this one. Kept entirely separate instead
 * (Public Security §15) — its own token variable, its own base URL constant
 * (reused from apiClient.ts, not duplicated), no refresh logic at all: a 401
 * here just means "verify again."
 */
import { ApiClientError, BASE_URL } from "./apiClient";

let entryToken: string | null = null;

export function setStudentEntryToken(token: string | null): void {
  entryToken = token;
}

export function getStudentEntryToken(): string | null {
  return entryToken;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; fields?: Record<string, string[]> };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (entryToken) headers.set("Authorization", `Bearer ${entryToken}`);

  const res = await fetch(`${BASE_URL}/public/student-entry${path}`, { ...options, headers });
  const body = (await res.json().catch(() => ({ success: false, error: { code: "PARSE_ERROR", message: "Invalid server response" } }))) as Envelope<T>;
  if (!body.success) {
    throw new ApiClientError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "Request failed", body.error?.fields);
  }
  return body.data as T;
}

export const studentEntryApi = {
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  postForm: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData }),
};
