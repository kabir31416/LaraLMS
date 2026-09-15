import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requireRole } from "../../common/middlewares/rbac.middleware";
import * as controller from "./dashboard.controller";

const router = Router();

router.use(requireAuth);

router.get("/admin", requireRole("admin"), controller.adminSummary);
router.get("/admission", requireRole("admin"), controller.admissionSummary);
router.get("/director", requireRole("batch_director"), controller.directorSummary);

export default router;
