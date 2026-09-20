/**
 * A small, self-contained fetch helper for the public /newstudententry page
 * only — same reasoning as studentEntryClient.ts: never routed through
 * apiClient.ts's `api` object, which manages one long-lived Admin/Portal
 * session. This page needs no session/token at all (unlike /studententry's
 * verify-then-edit flow) — every call here is a single anonymous request.
 */
import { ApiClientError, BASE_URL } from "./apiClient";

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; fields?: Record<string, string[]> };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const res = await fetch(`${BASE_URL}/public/new-student-entry${path}`, { ...options, headers });
  const body = (await res.json().catch(() => ({ success: false, error: { code: "PARSE_ERROR", message: "Invalid server response" } }))) as Envelope<T>;
  if (!body.success) {
    throw new ApiClientError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "Request failed", body.error?.fields);
  }
  return body.data as T;
}

export const newStudentEntryApi = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
};
