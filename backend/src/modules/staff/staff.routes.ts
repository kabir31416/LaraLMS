import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createStaffSchema, idParamSchema, listStaffQuerySchema, updateStaffSchema } from "./staff.validation";
import * as controller from "./staff.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth, requirePermission(PERMISSIONS.STAFF_MANAGE));

router.get("/", validate(listStaffQuerySchema), controller.list);
router.get("/directors", controller.listDirectors);
router.get("/:id", validate(idParamSchema), controller.getById);
router.post("/", validate(createStaffSchema), controller.create);
router.patch("/:id", validate(updateStaffSchema), controller.update);
router.delete("/:id", validate(idParamSchema), controller.remove);

export default router;
