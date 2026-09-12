import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createBatchSchema, enrollBulkSchema, idParamSchema, listBatchesQuerySchema, updateBatchSchema } from "./batch.validation";
import * as controller from "./batch.controller";
import * as enrollmentController from "../enrollments/enrollment.controller";
import { batchIdParamSchema } from "../enrollments/enrollment.validation";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.BATCHES_MANAGE, PERMISSIONS.BATCHES_READ_OWN), validate(listBatchesQuerySchema), controller.list);
router.get("/:id", requirePermission(PERMISSIONS.BATCHES_MANAGE, PERMISSIONS.BATCHES_READ_OWN), validate(idParamSchema), controller.getById);
router.post("/", requirePermission(PERMISSIONS.BATCHES_MANAGE), validate(createBatchSchema), controller.create);
router.patch("/:id", requirePermission(PERMISSIONS.BATCHES_MANAGE), validate(updateBatchSchema), controller.update);
router.delete("/:id", requirePermission(PERMISSIONS.BATCHES_MANAGE), validate(idParamSchema), controller.remove);

// Roster + bulk-enroll — Phase 1 §14/§19 (replaces reading Batch.studentIds).
router.get("/:id/roster", requirePermission(PERMISSIONS.BATCHES_MANAGE, PERMISSIONS.BATCHES_READ_OWN), validate(batchIdParamSchema), enrollmentController.getRoster);
router.post("/:id/enroll-bulk", requirePermission(PERMISSIONS.ENROLLMENTS_MANAGE), validate(enrollBulkSchema), enrollmentController.enrollBulk);

export default router;
