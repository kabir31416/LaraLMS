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

  const allowedOrigins = env.CORS_ORIGIN
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // A plain Error here used to fall through errorHandler's generic
        // branch as an opaque 500 — indistinguishable from a real server
        // crash, and specifically what makes a browser report a preflight
        // as "does not have HTTP ok status" instead of a normal CORS
        // rejection. Logged directly (not just via errorHandler, which only
        // logs 5xx) so the rejected origin is visible in Runtime Logs
        // regardless of the response status branch it lands in.
        logger.warn({ origin, allowedOrigins }, "CORS rejected — origin not in CORS_ORIGIN allow-list");
        callback(ApiError.forbidden(`Origin not allowed: ${origin}. Check the CORS_ORIGIN environment variable.`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
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
