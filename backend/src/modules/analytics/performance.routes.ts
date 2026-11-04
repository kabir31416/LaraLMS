import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { PERMISSIONS } from "../rbac/permissions";
import * as c from "./performance.controller";
import * as v from "./performance.validation";

/**
 * Student Performance Analytics (read-only). Admins need RESULTS_READ;
 * Batch Directors hold it too but performance.service.ts limits them to
 * their own batches inside every query. Students only ever get /me.
 */
const router = Router();
router.use(requireAuth);

router.get("/performance/me", requirePermission(PERMISSIONS.RESULTS_READ_OWN), validate(v.myPerformanceSchema), c.me);
router.get("/performance/options", requirePermission(PERMISSIONS.RESULTS_READ), validate(v.optionsQuerySchema), c.options);
router.get("/performance/students/:id", requirePermission(PERMISSIONS.RESULTS_READ), validate(v.studentProfileSchema), c.studentProfile);
router.get("/performance", requirePermission(PERMISSIONS.RESULTS_READ), validate(v.performanceQuerySchema), c.performance);

export default router;
