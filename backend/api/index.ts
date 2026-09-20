import type { IncomingMessage, ServerResponse } from "http";
import type { Express } from "express";

/**
 * Vercel serverless entrypoint. `vercel.json`'s catch-all route sends every
 * request here — including `/health` — so this file must never let a
 * downstream failure (a missing environment variable, a broken MongoDB
 * connection, a route module that throws on import) take the whole
 * function down with it.
 *
 * Root cause of the original "500 FUNCTION_INVOCATION_FAILED on every
 * route, including /health": this file used to do
 * `import { buildApp } from "../src/app"` at the top of the module. That
 * import chain pulls in `../src/config/env.ts`, which runs
 * `envSchema.safeParse(process.env)` and `throw`s synchronously if a
 * required variable (MONGO_URI / JWT_ACCESS_SECRET / JWT_REFRESH_SECRET) is
 * missing. A throw during module load happens before this file's own
 * `handler` function ever runs — there is no try/catch in this file (or
 * anywhere) that can catch it — so Node's module loader reports the whole
 * function as failed to initialize, which is exactly what Vercel surfaces
 * as `FUNCTION_INVOCATION_FAILED` / "A function needed by this page
 * failed": a boot-time crash, not an HTTP 500 from Express. A build
 * succeeding never catches this, because building only bundles the code —
 * it doesn't execute it the way an actual invocation does.
 *
 * Fix: `/health` is answered directly below, before anything from `../src`
 * is ever imported, so it can never depend on env validation, MongoDB, or
 * any route module succeeding. Everything else is imported lazily (dynamic
 * `import()`, inside `handler`, wrapped in try/catch) and cached across
 * warm invocations so a cold start only pays the import cost once.
 */

let appPromise: Promise<Express> | null = null;

/** Builds (once) and caches the Express app across warm invocations of this same function instance. A failed attempt is never cached — the next request gets a clean retry instead of being wedged for the container's lifetime. */
function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = import("../src/app")
      .then(({ buildApp }) => buildApp())
      .catch((err) => {
        appPromise = null;
        throw err;
      });
  }
  return appPromise;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function isHealthCheck(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0];
  return path === "/health" || path === "/api/health";
}

/**
 * Every response this file sends *itself* (health, and the two error
 * fallbacks below) bypasses Express entirely, so it never goes through
 * app.ts's `cors` middleware. Without this, a real 500 (env validation
 * failed, MongoDB unreachable) would come back to the browser with zero
 * `Access-Control-Allow-Origin` header — and a browser reports *that* as a
 * generic "blocked by CORS policy" error, completely hiding the actual
 * cause. This reads CORS_ORIGIN straight from `process.env` (not the
 * validated `env` object from `../src/config/env`) so it still works even
 * when env validation itself is what failed.
 */
function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (!origin) return;
  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Applied before anything else can fail, so every response below —
  // success or error — carries CORS headers when the origin is allowed.
  applyCors(req, res);

  // Answered before any other import in this file runs — see the note
  // above. This never touches env.ts, Mongoose, or any route module, so it
  // reports only "is this function itself alive," independent of every
  // other failure mode.
  if (isHealthCheck(req.url)) {
    return sendJson(res, 200, { success: true, data: { status: "ok" } });
  }

  let app: Express;
  try {
    app = await getApp();
  } catch (err) {
    console.error("Server initialization failed while building the app:", err instanceof Error ? err.message : err);
    return sendJson(res, 500, {
      success: false,
      error: {
        code: "SERVER_INIT_FAILED",
        message: "The server failed to initialize. Check the Vercel project's Environment Variables (MONGO_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET) and Runtime Logs.",
      },
    });
  }

  // A CORS preflight never touches the database — answering it here, before
  // connectDB(), means a Mongo outage can never masquerade as a browser
  // "blocked by CORS policy" error on the *actual* request that follows.
  // Express's own cors middleware (app.ts) finishes the preflight handshake.
  if (req.method !== "OPTIONS") {
    try {
      const { connectDB } = await import("../src/config/db");
      await connectDB();
    } catch (err) {
      console.error("Database connection failed:", err instanceof Error ? err.message : err);
      return sendJson(res, 500, {
        success: false,
        error: {
          code: "DB_CONNECTION_FAILED",
          message: "Could not connect to the database. Check MONGO_URI and MongoDB Atlas Network Access settings.",
        },
      });
    }
  }

  // Express's request handler signature is structurally compatible with
  // plain Node req/res (that's how every Node HTTP server framework works)
  // — the cast is only needed because this file intentionally types req/res
  // as the bare `http` types above, not Express's.
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
