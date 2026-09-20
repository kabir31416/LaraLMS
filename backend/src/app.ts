import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { logger } from "./logger/logger";
import { env } from "./config/env";
import { requestId } from "./common/middlewares/requestId.middleware";
import { errorHandler, notFoundHandler } from "./common/middlewares/errorHandler.middleware";
import { ApiError } from "./common/utils/ApiError";
import apiRouter from "./routes/index";

/** Origins are compared without a trailing slash so a stray "/" in CORS_ORIGIN's value (a common copy-paste mistake) doesn't silently break an otherwise-correct entry — a browser's Origin header never has a path, so it never carries one either. */
function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, "");
}

export function buildApp() {
  const app = express();

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId as string,
      customLogLevel: (_req, res) => (res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    }),
  );
  app.use(helmet());

  // CORS_ORIGIN is a comma-separated list. Passing it to `cors()` as a raw
  // string (the previous code here) makes the package echo that entire
  // literal string back as Access-Control-Allow-Origin — e.g.
  // "https://a.com,https://b.com" — which isn't a valid single-origin value
  // and every browser rejects it. It must be parsed into a list and matched
  // with a callback instead, exactly like laralms-server's app.ts does.
  const allowedOrigins = env.CORS_ORIGIN
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
          callback(null, true);
        } else {
          logger.warn({ origin, allowedOrigins }, "CORS rejected — origin not in CORS_ORIGIN allow-list");
          callback(ApiError.forbidden(`Origin not allowed: ${origin}. Check the CORS_ORIGIN environment variable.`));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));

  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
