import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodEffects } from "zod";

type Schema = AnyZodObject | ZodEffects<AnyZodObject>;

/**
 * Generic zod validation middleware — Phase 2 §15.
 * Pass a schema shaped like { body?, params?, query? }; only the parts you
 * provide are validated and replaced with their parsed (typed, defaulted) values.
 */
export function validate(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.parse({ body: req.body, params: req.params, query: req.query }) as {
      body?: unknown;
      params?: unknown;
      query?: unknown;
    };
    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.params !== undefined) req.params = parsed.params as typeof req.params;
    if (parsed.query !== undefined) req.query = parsed.query as typeof req.query;
    next();
  };
}
