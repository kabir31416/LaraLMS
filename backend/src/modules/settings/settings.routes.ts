import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { updatePublicInfoSettingsSchema, updateSettingsSchema } from "./settings.validation";
import * as settingsController from "./settings.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get("/", settingsController.getSettings);
router.patch("/", requirePermission(PERMISSIONS.SETTINGS_MANAGE), validate(updateSettingsSchema), settingsController.updateSettings);

router.get("/public-info", requirePermission(PERMISSIONS.PUBLIC_INFO_MANAGE, PERMISSIONS.SETTINGS_MANAGE), settingsController.getPublicInfoSettings);
router.patch(
  "/public-info",
  requirePermission(PERMISSIONS.PUBLIC_INFO_MANAGE, PERMISSIONS.SETTINGS_MANAGE),
  validate(updatePublicInfoSettingsSchema),
  settingsController.updatePublicInfoSettings,
);

export default router;
