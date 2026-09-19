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

/**
 * The public marksheet (publicResults module, Phase 6) — an individual
 * result lookup is heavier than a plain student-info exact match (it joins
 * exam/subject/batch across a date range), and a Roll Number is also a
 * short, guessable value, so this sits between the two limiters above:
 * tighter than the exact-match student search, looser than name search.
 */
export const publicResultLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many requests — slow down" } },
});

/**
 * Public Student Entry's verify step (publicStudentEntry module) checks a
 * registration/roll number + phone pair against a real record — the same
 * brute-force-guessable shape as a login, so it gets the same window/limit
 * as authLimiter rather than one of the lighter public-lookup limiters above.
 */
export const studentEntryVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many attempts — try again later" } },
});
