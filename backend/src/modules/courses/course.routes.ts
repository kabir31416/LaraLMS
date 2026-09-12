import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createCourseSchema, idParamSchema, listQuerySchema, updateCourseSchema } from "./course.validation";
import * as controller from "./course.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get("/", validate(listQuerySchema), controller.list);
router.get("/:id", validate(idParamSchema), controller.getById);
router.post("/", requirePermission(PERMISSIONS.COURSES_MANAGE), validate(createCourseSchema), controller.create);
router.patch("/:id", requirePermission(PERMISSIONS.COURSES_MANAGE), validate(updateCourseSchema), controller.update);
router.delete("/:id", requirePermission(PERMISSIONS.COURSES_MANAGE), validate(idParamSchema), controller.remove);

export default router;
