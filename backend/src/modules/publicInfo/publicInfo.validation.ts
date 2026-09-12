import { z } from "zod";

/**
 * No-login public search (Phase 1 §16/§19). A short min length on `query`
 * keeps a single-character request from being a cheap way to probe the
 * rate limiter; `name` needs a slightly longer minimum since it's the
 * enumeration-prone method (Registration ID / phone are exact matches).
 */
export const publicSearchQuerySchema = z.object({
  query: z.object({
    method: z.enum(["registrationId", "phone", "name"]),
    q: z.string().trim().min(2).max(100),
  }),
});
