import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import {
  listLogsQuerySchema,
  reportParamSchema,
  testSmsSchema,
  updateAlphaSettingsSchema,
  updateBulkSmsBdSettingsSchema,
  updateEventsSchema,
  updateProviderSchema,
  updateTemplateSchema,
} from "./sms.validation";
import * as controller from "./sms.controller";
import { PERMISSIONS } from "../rbac/permissions";
import { env } from "../../config/env";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { ApiError } from "../../common/utils/ApiError";
import { runBirthdaySweep } from "./birthday.scheduler";

const router = Router();

/**
 * Birthday SMS §8 — Vercel Cron's daily trigger for the serverless
 * deployment (see birthday.scheduler.ts's header comment for why this
 * exists alongside server.ts's setInterval). Deliberately BEFORE the
 * requireAuth/requirePermission gate below: Vercel Cron carries no user
 * session, only this shared-secret header, checked here instead. Fails
 * closed — a blank/unset CRON_SECRET means this endpoint always 403s.
 * GET (not POST) because Vercel Cron Jobs only ever invoke via GET.
 */
router.get(
  "/cron/birthday",
  asyncHandler(async (req, res) => {
    const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!env.CRON_SECRET || provided !== env.CRON_SECRET) {
      throw ApiError.forbidden("Not authorized");
    }
    sendSuccess(res, await runBirthdaySweep());
  }),
);

/**
 * SMS Provider Upgrade §18 — every route below is Admin/Super Admin only
 * (PERMISSIONS.SMS_MANAGE), including the GET, unlike settings.routes.ts's
 * general `/settings` (open to any authenticated role) — this collection
 * carries the Alpha SMS API key, so it never gets that same open GET.
 */
router.use(requireAuth);
router.use(requirePermission(PERMISSIONS.SMS_MANAGE));

router.get("/settings", controller.getSettings);
router.patch("/settings/provider", validate(updateProviderSchema), controller.updateProvider);
router.patch("/settings/bulksmsbd", validate(updateBulkSmsBdSettingsSchema), controller.updateBulkSmsBdSettings);
router.patch("/settings/alpha", validate(updateAlphaSettingsSchema), controller.updateAlphaSettings);
router.patch("/settings/events", validate(updateEventsSchema), controller.updateEvents);
router.patch("/settings/templates/:event", validate(updateTemplateSchema), controller.updateTemplate);
router.get("/settings/balance", controller.checkBalance);

router.post("/test", validate(testSmsSchema), controller.sendTest);
router.get("/report/:requestId", validate(reportParamSchema), controller.getDeliveryReport);
router.get("/logs", validate(listLogsQuerySchema), controller.listLogs);

export default router;
