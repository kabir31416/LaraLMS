import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission, requirePermissionOrSelf } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { PERMISSIONS } from "../rbac/permissions";
import * as controller from "./material.controller";
import {
  addStockSchema,
  adjustStockSchema,
  checkDuplicateSchema,
  createDistributionSchema,
  createMaterialSchema,
  dashboardQuerySchema,
  deactivateMaterialSchema,
  idParamSchema,
  listDistributionsQuerySchema,
  listMaterialsQuerySchema,
  listMovementsQuerySchema,
  reportQuerySchema,
  reverseDistributionSchema,
  studentIdParamSchema,
  updateMaterialSchema,
} from "./material.validation";

const router = Router();

router.use(requireAuth);

// NOTE: every fixed-segment path below (/distributions*, /students/*,
// /dashboard/*, /reports/*) is registered BEFORE the generic "/:id" routes
// at the bottom of this file — Express matches routes in registration
// order, so "/:id" would otherwise swallow e.g. GET /distributions as if
// id === "distributions".

// -------------------- Student Distribution --------------------
router.post("/distributions/check-duplicate", requirePermission(PERMISSIONS.MATERIALS_DISTRIBUTE), validate(checkDuplicateSchema), controller.checkDuplicate);
router.post("/distributions", requirePermission(PERMISSIONS.MATERIALS_DISTRIBUTE), validate(createDistributionSchema), controller.createDistribution);
router.get("/distributions", requirePermission(PERMISSIONS.MATERIALS_DISTRIBUTION_VIEW), validate(listDistributionsQuerySchema), controller.listDistributions);
router.get("/distributions/:id", requirePermission(PERMISSIONS.MATERIALS_DISTRIBUTION_VIEW), validate(idParamSchema), controller.getDistributionById);
router.post(
  "/distributions/:id/reverse",
  requirePermission(PERMISSIONS.MATERIALS_DISTRIBUTION_REVERSE),
  validate(reverseDistributionSchema),
  controller.reverseDistribution,
);

// -------------------- Student Material History (§7/§22 — a Student may view only their own) --------------------
router.get(
  "/students/:studentId/history",
  requirePermissionOrSelf([PERMISSIONS.MATERIALS_DISTRIBUTION_VIEW, PERMISSIONS.MATERIALS_VIEW], PERMISSIONS.MATERIALS_READ_OWN, "studentId", "studentId"),
  validate(studentIdParamSchema),
  controller.getStudentHistory,
);

// -------------------- Dashboard --------------------
router.get("/dashboard/stats", requirePermission(PERMISSIONS.MATERIALS_VIEW, PERMISSIONS.MATERIALS_REPORT_VIEW), validate(dashboardQuerySchema), controller.getDashboardStats);

// -------------------- Reports --------------------
router.get("/reports/stock", requirePermission(PERMISSIONS.MATERIALS_REPORT_VIEW), validate(reportQuerySchema), controller.stockReport);
router.get("/reports/distribution", requirePermission(PERMISSIONS.MATERIALS_REPORT_VIEW), validate(reportQuerySchema), controller.distributionReport);
router.get("/reports/student-wise", requirePermission(PERMISSIONS.MATERIALS_REPORT_VIEW), validate(reportQuerySchema), controller.studentWiseReport);
router.get("/reports/material-wise", requirePermission(PERMISSIONS.MATERIALS_REPORT_VIEW), validate(reportQuerySchema), controller.materialWiseReport);

// -------------------- Material Master --------------------
router.get("/", requirePermission(PERMISSIONS.MATERIALS_VIEW), validate(listMaterialsQuerySchema), controller.list);
router.post("/", requirePermission(PERMISSIONS.MATERIALS_CREATE), validate(createMaterialSchema), controller.create);
router.get("/:id", requirePermission(PERMISSIONS.MATERIALS_VIEW), validate(idParamSchema), controller.getById);
router.patch("/:id", requirePermission(PERMISSIONS.MATERIALS_UPDATE), validate(updateMaterialSchema), controller.update);
router.patch("/:id/status", requirePermission(PERMISSIONS.MATERIALS_DEACTIVATE), validate(deactivateMaterialSchema), controller.setStatus);

// -------------------- Stock Management --------------------
router.post("/:id/stock/add", requirePermission(PERMISSIONS.MATERIALS_STOCK_ADD), validate(addStockSchema), controller.addStock);
router.post("/:id/stock/adjust", requirePermission(PERMISSIONS.MATERIALS_STOCK_ADJUST), validate(adjustStockSchema), controller.adjustStock);
router.get("/:id/stock/movements", requirePermission(PERMISSIONS.MATERIALS_VIEW), validate(listMovementsQuerySchema), controller.listMovements);

export default router;
