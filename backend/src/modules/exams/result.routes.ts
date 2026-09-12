import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { listResultsQuerySchema } from "./exam.validation";
import * as controller from "./exam.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.EXAMS_READ_OWN_BATCH, PERMISSIONS.RESULTS_READ, PERMISSIONS.RESULTS_READ_OWN, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(listResultsQuerySchema),
  controller.listResults,
);

export default router;
