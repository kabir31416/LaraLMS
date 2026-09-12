import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createExamSchema, idParamSchema, listExamsQuerySchema, saveResultsSchema } from "./exam.validation";
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

export default router;
