import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),

  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  /**
   * The Student/Staff Portal (auth.service.ts's studentLogin/staffLogin) has
   * no refresh mechanism at all — no httpOnly cookie is ever issued for it,
   * since those logins write nothing server-side to back one with. Reusing
   * the 15-minute admin access-token lifetime there meant a portal session
   * silently died mid-use: a reload after ~15 minutes restored an already-
   * expired token from localStorage, the first request 401'd, the doomed
   * refresh attempt (no cookie to refresh) added a slow round-trip, and the
   * user was logged out. This is a separate, much longer lifetime for those
   * two logins only — Admin/Staff-password logins are unaffected.
   */
  PORTAL_ACCESS_EXPIRES_IN: z.string().default("12h"),
  /**
   * The public Student Entry page (/studententry) issues its own short-lived
   * token after verifying registration/roll + phone (publicStudentEntry
   * module) — separate from every other session lifetime above since it's
   * neither an Admin session nor a Portal login, just enough time to
   * complete one profile/photo update in a single visit.
   */
  STUDENT_ENTRY_TOKEN_EXPIRES_IN: z.string().default("15m"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),

  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),

  ADMIN_SEED_PHONE: z.string().optional().default("01700000000"),
  ADMIN_SEED_PASSWORD: z.string().optional().default("ChangeMe123!"),
  ADMIN_SEED_NAME: z.string().optional().default("Admin"),

  // BulkSMSBD (or compatible) gateway for login-credential SMS. Left blank,
  // sendSms() no-ops (logs and returns) instead of failing — SMS is a
  // best-effort side effect, never something that should block a student
  // being created or a login being (re)set.
  SMS_API_KEY: z.string().optional().default(""),
  SMS_SENDER_ID: z.string().optional().default(""),
  SMS_API_URL: z.string().optional().default("http://bulksmsbd.net/api/smsapi"),
  /**
   * Hard bound on a single provider HTTP call (BulkSMSBD/Alpha's `send`,
   * `getBalance`, and Alpha's report lookup) — neither gateway's client here
   * previously set a timeout at all, so a hung connection could block the
   * caller indefinitely (Node's global fetch has no default timeout). 15s is
   * comfortably above either gateway's typical response time (a few seconds)
   * without being so short that a normal-but-slightly-slow response gets
   * misreported as a failure.
   */
  SMS_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(15000),
  /**
   * How many guardian SMS the Result-SMS loop (exam.service.ts's
   * submitResult/resendSms) sends concurrently instead of one at a time.
   * Sequential sending was the dominant cause of "Send Result" feeling slow
   * for a full class (N students x 1-3s each, awaited one by one). A modest
   * bounded concurrency keeps the guardian gateway from being hit with an
   * unlimited burst (Promise.all over the whole class) while still cutting
   * wall-clock time by roughly this factor.
   */
  SMS_BULK_CONCURRENCY: z.coerce.number().int().positive().optional().default(5),
  /** Closing signature line on the Result Entry guardian SMS (exams/exam.service.ts's buildResultSms) — the coaching centre's own name, not a gateway credential. */
  SMS_SIGNATURE: z.string().optional().default("LaraLMS"),
  /**
   * Shared secret for Vercel Cron's daily hit to POST /sms/cron/birthday
   * (Birthday SMS §8) — Vercel Cron carries no user session/JWT, so this
   * header-compared secret is what proves the request actually came from
   * the configured cron job rather than an arbitrary caller. Left blank,
   * the route always 403s (fails closed, never open) — nothing else in
   * this app depends on it, so an install that only ever runs server.ts's
   * long-lived process (whose own setInterval doesn't need this at all)
   * can simply leave it unset.
   */
  CRON_SECRET: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration — check backend/.env against .env.example");
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
