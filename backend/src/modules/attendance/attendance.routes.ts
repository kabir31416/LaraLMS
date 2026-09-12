import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { listAttendanceQuerySchema, percentQuerySchema, saveAttendanceSchema } from "./attendance.validation";
import * as controller from "./attendance.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  requirePermission(PERMISSIONS.ATTENDANCE_MARK, PERMISSIONS.ATTENDANCE_MARK_OWN_BATCH),
  validate(saveAttendanceSchema),
  controller.save,
);
router.get(
  "/",
  requirePermission(PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_READ_OWN),
  validate(listAttendanceQuerySchema),
  controller.list,
);
router.get(
  "/percentages",
  requirePermission(PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_READ_OWN),
  validate(percentQuerySchema),
  controller.percentages,
);
router.get(
  "/stats",
  requirePermission(PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_READ_OWN),
  validate(percentQuerySchema),
  controller.stats,
);
router.get(
  "/by-student",
  requirePermission(PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_READ_OWN),
  validate(percentQuerySchema),
  controller.byStudent,
);

export default router;
