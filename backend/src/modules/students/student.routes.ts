import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission, requirePermissionOrSelf, requireSelf } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { photoUpload } from "../../common/middlewares/imageUpload.middleware";
import {
  admissionRollStatsQuerySchema,
  createStudentSchema,
  dueStatsQuerySchema,
  idParamSchema,
  listStudentsQuerySchema,
  quickCreateStudentSchema,
  updateAdmissionRollSchema,
  updateRollSchema,
  updateSelfSchema,
  updateStatusSchema,
  updateStudentSchema,
} from "./student.validation";
import * as controller from "./student.controller";
import * as enrollmentController from "../enrollments/enrollment.controller";
import { enrollSchema, studentIdParamSchema, transferSchema, withdrawSchema } from "../enrollments/enrollment.validation";
import { nestedGuardianRouter } from "../guardians/guardian.routes";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_READ_OWN_BATCH), validate(listStudentsQuerySchema), controller.list);
router.post("/quick", requirePermission(PERMISSIONS.STUDENTS_CREATE), validate(quickCreateStudentSchema), controller.quickCreate);
router.post("/", requirePermission(PERMISSIONS.STUDENTS_CREATE), validate(createStudentSchema), controller.create);

// Student Portal self-profile (Phase 3, Module 27) — must precede "/:id" so
// Express doesn't try to resolve "me" as an :id.
router.get("/me", requirePermission(PERMISSIONS.STUDENTS_UPDATE_SELF), controller.getMyProfile);
// Student Photo Management's self-service upload — identity comes from the
// session (req.user.studentId in the controller/service), never the URL, so
// there's no "/me/photo" vs "/:id/photo" ambiguity to worry about; still
// must precede "/:id/photo" below for the same routing reason as "/me" itself.
router.post("/me/photo", requirePermission(PERMISSIONS.STUDENTS_UPDATE_SELF), photoUpload.single("photo"), controller.uploadMyPhoto);
router.delete("/me/photo", requirePermission(PERMISSIONS.STUDENTS_UPDATE_SELF), controller.removeMyPhoto);

// Admission Result feature's summary cards — must also precede "/:id".
router.get(
  "/stats/admission-roll",
  requirePermission(PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_READ_OWN_BATCH),
  validate(admissionRollStatsQuerySchema),
  controller.admissionRollStats,
);

// Student List's filtered Print/Export — must also precede "/:id".
router.get(
  "/export",
  requirePermission(PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_READ_OWN_BATCH),
  validate(listStudentsQuerySchema),
  controller.exportList,
);

// Fee Management's due-list summary cards — must also precede "/:id".
router.get(
  "/stats/due",
  requirePermission(PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_READ_OWN_BATCH),
  validate(dueStatsQuerySchema),
  controller.dueStats,
);

// Batches page's per-row roster count — must also precede "/:id".
router.get(
  "/stats/batch-counts",
  requirePermission(PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_READ_OWN_BATCH),
  controller.batchStudentCounts,
);

router.get(
  "/:id",
  requirePermissionOrSelf([PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_READ_OWN_BATCH], PERMISSIONS.STUDENTS_UPDATE_SELF, "id"),
  validate(idParamSchema),
  controller.getById,
);
router.patch("/:id", requirePermission(PERMISSIONS.STUDENTS_UPDATE), validate(updateStudentSchema), controller.update);
router.patch("/:id/self", requirePermission(PERMISSIONS.STUDENTS_UPDATE_SELF), requireSelf("id"), validate(updateSelfSchema), controller.updateSelf);
router.patch("/:id/roll", requirePermission(PERMISSIONS.STUDENTS_MANAGE_ROLL), validate(updateRollSchema), controller.updateRoll);
router.patch(
  "/:id/admission-roll",
  requirePermission(PERMISSIONS.STUDENTS_UPDATE, PERMISSIONS.STUDENTS_MANAGE_ADMISSION_ROLL_OWN_BATCH),
  validate(updateAdmissionRollSchema),
  controller.updateAdmissionRoll,
);
router.patch("/:id/status", requirePermission(PERMISSIONS.STUDENTS_UPDATE), validate(updateStatusSchema), controller.updateStatus);
// Admin upload/replace/remove — same STUDENTS_UPDATE permission every other
// admin edit to this student already requires, no separate privilege.
router.post("/:id/photo", requirePermission(PERMISSIONS.STUDENTS_UPDATE), validate(idParamSchema), photoUpload.single("photo"), controller.uploadPhoto);
router.delete("/:id/photo", requirePermission(PERMISSIONS.STUDENTS_UPDATE), validate(idParamSchema), controller.removePhoto);
router.delete("/:id", requirePermission(PERMISSIONS.STUDENTS_DELETE), validate(idParamSchema), controller.remove);

// Batch enrollment & transfer history — Phase 1 §14.
router.get(
  "/:id/enrollments",
  requirePermissionOrSelf([PERMISSIONS.STUDENTS_READ], PERMISSIONS.ENROLLMENTS_READ_OWN, "id"),
  validate(studentIdParamSchema),
  enrollmentController.listByStudent,
);
router.post("/:id/enroll", requirePermission(PERMISSIONS.ENROLLMENTS_MANAGE), validate(enrollSchema), enrollmentController.enroll);
router.post("/:id/transfer", requirePermission(PERMISSIONS.ENROLLMENTS_MANAGE), validate(transferSchema), enrollmentController.transfer);
router.post("/:id/withdraw", requirePermission(PERMISSIONS.ENROLLMENTS_MANAGE), validate(withdrawSchema), enrollmentController.withdraw);

// Guardians — Phase 1 §17.
router.use("/:studentId/guardians", nestedGuardianRouter);

export default router;
