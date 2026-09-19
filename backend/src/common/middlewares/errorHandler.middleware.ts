import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { MulterError } from "multer";
import { ApiError } from "../utils/ApiError";
import { logger } from "../../logger/logger";
import { isProd } from "../../config/env";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `No route: ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) logger.error({ err, requestId: req.requestId }, err.message);
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, fields: err.fields },
    });
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] = [...(fields[key] || []), issue.message];
    }
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", fields } });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: err.message } });
  }

  // studentImport.routes.ts/student.routes.ts's multer configs throw this
  // directly (not via their own fileFilter's ApiError) when a file exceeds
  // the configured size limit — without this, an oversized upload surfaced
  // as an opaque 500 instead of a clear, expected 400.
  if (err instanceof MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "ফাইলের আকার অনুমোদিত সীমার চেয়ে বড়।" : "ফাইল আপলোড ব্যর্থ হয়েছে।";
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message } });
  }

  if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
    return res.status(409).json({ success: false, error: { code: "DUPLICATE_KEY", message: "A record with this value already exists" } });
  }

  logger.error({ err, requestId: req.requestId }, "Unhandled error");
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL", message: isProd ? "Something went wrong" : String((err as Error)?.message ?? err) },
  });
}
