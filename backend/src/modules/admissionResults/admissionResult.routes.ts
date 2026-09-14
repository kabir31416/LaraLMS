import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { ApiError } from "../../common/utils/ApiError";
import {
  confirmOrCancelParamSchema,
  idParamSchema,
  listChanceStudentsQuerySchema,
  listImportsQuerySchema,
  matchUnmatchedSchema,
  studentIdParamSchema,
  summaryQuerySchema,
  uploadImportSchema,
} from "./admissionResult.validation";
import * as controller from "./admissionResult.controller";
import { PERMISSIONS } from "../rbac/permissions";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — an official result PDF is text, never expected to be larger
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    if (!isPdf) return cb(new ApiError(400, "BAD_REQUEST", "শুধুমাত্র PDF ফাইল আপলোড করা যাবে।"));
    cb(null, true);
  },
});

const router = Router();

router.use(requireAuth);

// Admin-only: upload/process/confirm/cancel/rollback/import-history/unmatched-match.
router.post(
  "/imports",
  requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE),
  upload.single("pdf"),
  validate(uploadImportSchema),
  controller.uploadAndPreview,
);
router.post("/imports/:importId/confirm", requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE), validate(confirmOrCancelParamSchema), controller.confirmImport);
router.post("/imports/:importId/cancel", requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE), validate(confirmOrCancelParamSchema), controller.cancelImport);
router.delete("/imports/:importId/rollback", requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE), validate(confirmOrCancelParamSchema), controller.rollbackImport);
router.get("/imports", requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE), validate(listImportsQuerySchema), controller.listImportHistory);
router.get("/imports/:id", requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE), validate(idParamSchema), controller.getImportDetail);
router.post(
  "/imports/:importId/unmatched/:index/match",
  requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE),
  validate(matchUnmatchedSchema),
  controller.matchUnmatchedRoll,
);

// Read — Admin (all) or Batch Director (own batch only, enforced in the service layer).
router.get(
  "/",
  requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE, PERMISSIONS.ADMISSION_RESULTS_READ_OWN_BATCH),
  validate(listChanceStudentsQuerySchema),
  controller.listChanceStudents,
);
router.get(
  "/stats",
  requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE, PERMISSIONS.ADMISSION_RESULTS_READ_OWN_BATCH),
  validate(summaryQuerySchema),
  controller.getStats,
);
router.get(
  "/institutes",
  requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE, PERMISSIONS.ADMISSION_RESULTS_READ_OWN_BATCH),
  validate(summaryQuerySchema),
  controller.getInstitutesSummary,
);
router.get(
  "/institutes/options",
  requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE, PERMISSIONS.ADMISSION_RESULTS_READ_OWN_BATCH),
  controller.getInstituteOptions,
);
router.get(
  "/batches",
  requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE, PERMISSIONS.ADMISSION_RESULTS_READ_OWN_BATCH),
  validate(summaryQuerySchema),
  controller.getBatchesSummary,
);
router.get(
  "/student/:studentId",
  requirePermission(PERMISSIONS.ADMISSION_RESULTS_MANAGE, PERMISSIONS.ADMISSION_RESULTS_READ_OWN_BATCH),
  validate(studentIdParamSchema),
  controller.getStudentHistory,
);

export default router;
