import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createLectureSchema, idParamSchema, listQuerySchema, updateLectureSchema } from "./lecture.validation";
import * as controller from "./lecture.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get("/", validate(listQuerySchema), controller.list);
router.get("/:id", validate(idParamSchema), controller.getById);
router.post("/", requirePermission(PERMISSIONS.LECTURES_MANAGE), validate(createLectureSchema), controller.create);
router.patch("/:id", requirePermission(PERMISSIONS.LECTURES_MANAGE), validate(updateLectureSchema), controller.update);
router.delete("/:id", requirePermission(PERMISSIONS.LECTURES_MANAGE), validate(idParamSchema), controller.remove);

export default router;
