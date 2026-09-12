import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createSubjectSchema, idParamSchema, listQuerySchema, updateSubjectSchema } from "./subject.validation";
import * as controller from "./subject.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get("/", validate(listQuerySchema), controller.list);
router.get("/:id", validate(idParamSchema), controller.getById);
router.post("/", requirePermission(PERMISSIONS.SUBJECTS_MANAGE), validate(createSubjectSchema), controller.create);
router.patch("/:id", requirePermission(PERMISSIONS.SUBJECTS_MANAGE), validate(updateSubjectSchema), controller.update);
router.delete("/:id", requirePermission(PERMISSIONS.SUBJECTS_MANAGE), validate(idParamSchema), controller.remove);

export default router;
