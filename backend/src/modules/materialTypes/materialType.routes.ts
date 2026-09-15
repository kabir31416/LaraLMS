import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createMaterialTypeSchema, idParamSchema, listQuerySchema, updateMaterialTypeSchema } from "./materialType.validation";
import * as controller from "./materialType.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get("/", validate(listQuerySchema), controller.list);
router.post("/", requirePermission(PERMISSIONS.MATERIAL_TYPES_MANAGE, PERMISSIONS.SETTINGS_MANAGE), validate(createMaterialTypeSchema), controller.create);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.MATERIAL_TYPES_MANAGE, PERMISSIONS.SETTINGS_MANAGE),
  validate(updateMaterialTypeSchema),
  controller.update,
);
router.delete("/:id", requirePermission(PERMISSIONS.MATERIAL_TYPES_MANAGE, PERMISSIONS.SETTINGS_MANAGE), validate(idParamSchema), controller.remove);

export default router;
