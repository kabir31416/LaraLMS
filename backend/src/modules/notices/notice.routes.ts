import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createNoticeSchema, idParamSchema, listNoticesQuerySchema, updateNoticeSchema } from "./notice.validation";
import * as controller from "./notice.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.NOTICES_MANAGE, PERMISSIONS.NOTICES_READ), validate(listNoticesQuerySchema), controller.list);
router.post("/", requirePermission(PERMISSIONS.NOTICES_MANAGE), validate(createNoticeSchema), controller.create);
router.patch("/:id", requirePermission(PERMISSIONS.NOTICES_MANAGE), validate(updateNoticeSchema), controller.update);
router.patch("/:id/toggle-pin", requirePermission(PERMISSIONS.NOTICES_MANAGE), validate(idParamSchema), controller.togglePin);
router.delete("/:id", requirePermission(PERMISSIONS.NOTICES_MANAGE), validate(idParamSchema), controller.remove);

export default router;
