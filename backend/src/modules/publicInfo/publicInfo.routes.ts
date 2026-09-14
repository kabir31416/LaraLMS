import { Router, Request, Response, NextFunction } from "express";
import { validate } from "../../common/middlewares/validate.middleware";
import { publicExactMatchLimiter, publicNameSearchLimiter } from "../../common/middlewares/rateLimit.middleware";
import { publicSearchQuerySchema } from "./publicInfo.validation";
import * as controller from "./publicInfo.controller";

const router = Router();

/**
 * No `requireAuth` anywhere in this router — this is the one deliberately
 * public, unauthenticated surface of the API (Phase 1 §16/§19). The name
 * method is the enumeration-prone one, so it gets the stricter of the two
 * pre-built limiters; anything else (including a missing/invalid method,
 * which validate() below will reject anyway) falls back to the stricter
 * limiter too, erring toward safety rather than leniency.
 */
function publicSearchRateLimit(req: Request, res: Response, next: NextFunction) {
  const limiter = req.query.method === "registrationId" || req.query.method === "phone" ? publicExactMatchLimiter : publicNameSearchLimiter;
  return limiter(req, res, next);
}

router.get("/students", publicSearchRateLimit, validate(publicSearchQuerySchema), controller.search);

// Non-sensitive singleton branding data — no per-visitor lookup/enumeration
// risk, so it isn't behind either search rate limiter (Settings §2).
router.get("/institution", controller.getInstitution);

export default router;
