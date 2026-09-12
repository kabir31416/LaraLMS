import rateLimit from "express-rate-limit";

/** Generic auth-endpoint limiter — slows brute-force login attempts. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many attempts — try again later" } },
});

/**
 * Tiered limits for the unauthenticated /public/students search (Phase 1 §19):
 * exact-match lookups (Registration ID / phone) get a generous limit; the
 * name-search path (the enumeration vector) is throttled far harder and is
 * wired to the stricter limiter in the publicInfo routes.
 */
export const publicExactMatchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many requests — slow down" } },
});

export const publicNameSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many requests — slow down" } },
});
