import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

/** Correlates every log line for one request — Phase 2 §17. */
export function requestId(req: Request, res: Response, next: NextFunction) {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
