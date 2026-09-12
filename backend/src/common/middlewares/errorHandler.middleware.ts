import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
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

  if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
    return res.status(409).json({ success: false, error: { code: "DUPLICATE_KEY", message: "A record with this value already exists" } });
  }

  logger.error({ err, requestId: req.requestId }, "Unhandled error");
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL", message: isProd ? "Something went wrong" : String((err as Error)?.message ?? err) },
  });
}
