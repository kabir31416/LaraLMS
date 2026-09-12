import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createRoleSchema, roleIdParamSchema, updateRoleSchema } from "./role.validation";
import * as roleController from "./role.controller";
import { PERMISSIONS } from "./permissions";

const router = Router();

router.use(requireAuth, requirePermission(PERMISSIONS.ROLES_MANAGE));

router.get("/permissions", roleController.listPermissions);
router.get("/", roleController.listRoles);
router.get("/:id", validate(roleIdParamSchema), roleController.getRole);
router.post("/", validate(createRoleSchema), roleController.createRole);
router.patch("/:id", validate(updateRoleSchema), roleController.updateRolePermissions);
router.delete("/:id", validate(roleIdParamSchema), roleController.deleteRole);

export default router;
