import { Response } from "express";

interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  [key: string]: unknown;
}

/** Every successful response uses this envelope — see Phase 2 §12. */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200, meta?: Meta) {
  return res.status(statusCode).json({ success: true, data, ...(meta ? { meta } : {}) });
}
