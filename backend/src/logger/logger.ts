import pino from "pino";

/**
 * pino's `transport` option resolves its target module (pino-pretty) in a
 * worker thread by file path. That works fine in local dev, but breaks the
 * moment the app is bundled into a single file by a serverless build (e.g.
 * @vercel/node) — the worker thread can no longer locate "pino-pretty" on
 * disk relative to the bundle, and pino throws synchronously on import
 * ("unable to determine transport target for pino-pretty"), taking down
 * the whole app before it can serve a single request. `VERCEL` is set by
 * Vercel for every one of its own deployments (Production and Preview
 * alike), so gating on it — rather than trusting NODE_ENV alone — means
 * pino-pretty is never even attempted there.
 */
const isServerless = Boolean(process.env.VERCEL);
const isProd = process.env.NODE_ENV === "production" || isServerless;

export const logger = pino({
  level: isProd ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      // SMS Provider Upgrade §18 — Alpha SMS's api_key must never reach logs,
      // whatever shape the object carrying it happens to have.
      "*.apiKey",
      "*.api_key",
    ],
    censor: "[redacted]",
  },
  transport: isProd ? undefined : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});
