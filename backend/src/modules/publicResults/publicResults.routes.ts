import { Router } from "express";
import { validate } from "../../common/middlewares/validate.middleware";
import { publicResultLimiter } from "../../common/middlewares/rateLimit.middleware";
import { publicBatchListQuerySchema, publicIndividualResultQuerySchema } from "./publicResults.validation";
import * as controller from "./publicResults.controller";

/**
 * The public Marksheet's API surface (Phase 6) — no `requireAuth` anywhere
 * in this router, same as publicInfo.routes.ts. Mounted at /public/results
 * alongside the existing /public/students search.
 */
const router = Router();

router.get("/individual", publicResultLimiter, validate(publicIndividualResultQuerySchema), controller.getIndividualResult);
router.get("/batches", publicResultLimiter, validate(publicBatchListQuerySchema), controller.listBatches);

export default router;
