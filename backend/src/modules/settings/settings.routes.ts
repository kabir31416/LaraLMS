import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import {
  updateInstitutionSettingsSchema,
  updatePublicInfoSettingsSchema,
  updatePublicResultsSettingsSchema,
  updateSettingsSchema,
} from "./settings.validation";
import * as settingsController from "./settings.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get("/", settingsController.getSettings);
router.patch("/", requirePermission(PERMISSIONS.SETTINGS_MANAGE), validate(updateSettingsSchema), settingsController.updateSettings);

router.get("/institution", settingsController.getInstitutionSettings);
router.patch(
  "/institution",
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate(updateInstitutionSettingsSchema),
  settingsController.updateInstitutionSettings,
);

router.get("/public-info", requirePermission(PERMISSIONS.PUBLIC_INFO_MANAGE, PERMISSIONS.SETTINGS_MANAGE), settingsController.getPublicInfoSettings);
router.patch(
  "/public-info",
  requirePermission(PERMISSIONS.PUBLIC_INFO_MANAGE, PERMISSIONS.SETTINGS_MANAGE),
  validate(updatePublicInfoSettingsSchema),
  settingsController.updatePublicInfoSettings,
);

router.get(
  "/public-results",
  requirePermission(PERMISSIONS.PUBLIC_RESULTS_MANAGE, PERMISSIONS.SETTINGS_MANAGE),
  settingsController.getPublicResultsSettings,
);
router.patch(
  "/public-results",
  requirePermission(PERMISSIONS.PUBLIC_RESULTS_MANAGE, PERMISSIONS.SETTINGS_MANAGE),
  validate(updatePublicResultsSettingsSchema),
  settingsController.updatePublicResultsSettings,
);

export default router;
