import { Router } from "express";
import { requireAuth } from "../common/middlewares/auth.middleware";
import { requirePermission } from "../common/middlewares/rbac.middleware";
import { validate } from "../common/middlewares/validate.middleware";
import { listAuditLogsQuerySchema } from "./auditLog.validation";
import * as controller from "./auditLog.controller";
import { PERMISSIONS } from "../modules/rbac/permissions";

const router = Router();

router.use(requireAuth);
router.get("/", requirePermission(PERMISSIONS.AUDIT_READ, PERMISSIONS.SETTINGS_MANAGE), validate(listAuditLogsQuerySchema), controller.list);

export default router;
