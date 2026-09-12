import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createAcademicSessionSchema, idParamSchema, listQuerySchema, updateAcademicSessionSchema } from "./academicSession.validation";
import * as controller from "./academicSession.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get("/", validate(listQuerySchema), controller.list);
router.get("/:id", validate(idParamSchema), controller.getById);
router.post("/", requirePermission(PERMISSIONS.SESSIONS_MANAGE), validate(createAcademicSessionSchema), controller.create);
router.patch("/:id", requirePermission(PERMISSIONS.SESSIONS_MANAGE), validate(updateAcademicSessionSchema), controller.update);
router.delete("/:id", requirePermission(PERMISSIONS.SESSIONS_MANAGE), validate(idParamSchema), controller.remove);

export default router;
