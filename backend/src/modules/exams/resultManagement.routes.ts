import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import {
  batchResultsQuerySchema,
  listStudentResultsQuerySchema,
  studentIdParamSchema,
  topStudentsQuerySchema,
  updateResultMarkSchema,
} from "./resultManagement.validation";
import * as controller from "./resultManagement.controller";
import { PERMISSIONS } from "../rbac/permissions";

/**
 * Result Management — Admin's/Batch Director's internal viewing + editing
 * screen over the same OfflineExam/OfflineResult data Result Entry writes
 * and the public /marksheet reads (no new result collection). Reuses the
 * exact same permission keys as the rest of the exams module: a caller who
 * can already view/manage exam results there can do the same here, and a
 * Batch Director's own-batch scoping is enforced in resultManagement.
 * service.ts (readScope/assertCanActOnBatch), never left to the frontend.
 */
const router = Router();

router.use(requireAuth);

router.get(
  "/students",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.EXAMS_READ_OWN_BATCH, PERMISSIONS.RESULTS_READ, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(listStudentResultsQuerySchema),
  controller.listStudentResults,
);
router.get(
  "/top-students",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.EXAMS_READ_OWN_BATCH, PERMISSIONS.RESULTS_READ, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(topStudentsQuerySchema),
  controller.getTopStudents,
);
router.get(
  "/students/:studentId",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.EXAMS_READ_OWN_BATCH, PERMISSIONS.RESULTS_READ, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(studentIdParamSchema),
  controller.getStudentResult,
);
router.get(
  "/batch",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.EXAMS_READ_OWN_BATCH, PERMISSIONS.RESULTS_READ, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(batchResultsQuerySchema),
  controller.getBatchResults,
);
router.patch(
  "/results/:resultId",
  requirePermission(PERMISSIONS.EXAMS_MANAGE, PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH),
  validate(updateResultMarkSchema),
  controller.updateResultMark,
);

export default router;
