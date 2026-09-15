import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import {
  createExamSchema,
  idParamSchema,
  listExamsQuerySchema,
  resendSmsSchema,
  saveResultSchema,
  saveResultsSchema,
  submitResultSchema,
  updateResultSmsTemplateSchema,
} from "./exam.validation";
import * as controller from "./exam.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(createExamSchema),
  controller.create,
);
// Result Entry's single "Send Result" action — must be registered before
// "/:id" so Express doesn't try to resolve "submit-result" as an exam id.
router.post(
  "/submit-result",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(submitResultSchema),
  controller.submitResult,
);
// "Save Result" (no SMS) — same fixed-path-before-":id" ordering requirement as submit-result above.
router.post(
  "/save-result",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(saveResultSchema),
  controller.saveResult,
);
// Result SMS template (Batch Director's own, or the Admin-editable Settings-wide default) — also fixed paths, before ":id".
router.get(
  "/result-sms-template",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  controller.getResultSmsTemplate,
);
router.patch(
  "/result-sms-template",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(updateResultSmsTemplateSchema),
  controller.updateResultSmsTemplate,
);
router.get(
  "/",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.EXAMS_READ_OWN_BATCH, PERMISSIONS.RESULTS_READ, PERMISSIONS.RESULTS_READ_OWN, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(listExamsQuerySchema),
  controller.list,
);
router.get(
  "/:id",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.EXAMS_READ_OWN_BATCH, PERMISSIONS.RESULTS_READ, PERMISSIONS.RESULTS_READ_OWN, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(idParamSchema),
  controller.getById,
);
router.post(
  "/:id/results",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(saveResultsSchema),
  controller.saveResults,
);
router.post(
  "/:id/resend-sms",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(resendSmsSchema),
  controller.resendSms,
);

export default router;
