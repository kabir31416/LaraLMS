import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { cancelPaymentSchema, createPaymentSchema, idParamSchema, listPaymentsQuerySchema, paymentStatsQuerySchema } from "./payment.validation";
import * as controller from "./payment.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  requirePermission(PERMISSIONS.PAYMENTS_READ, PERMISSIONS.PAYMENTS_READ_OWN),
  validate(listPaymentsQuerySchema),
  controller.list,
);
// Mounted before "/:id" so this fixed-segment path is never at risk of the
// ":id" route swallowing it (same convention as routes/index.ts's own
// "/students/import" vs "/students/:id").
router.get(
  "/stats/collection",
  requirePermission(PERMISSIONS.PAYMENTS_READ, PERMISSIONS.PAYMENTS_READ_OWN),
  validate(paymentStatsQuerySchema),
  controller.stats,
);
router.get(
  "/:id",
  requirePermission(PERMISSIONS.PAYMENTS_READ, PERMISSIONS.PAYMENTS_READ_OWN),
  validate(idParamSchema),
  controller.getById,
);
router.get(
  "/:id/receipt",
  requirePermission(PERMISSIONS.PAYMENTS_READ, PERMISSIONS.PAYMENTS_READ_OWN),
  validate(idParamSchema),
  controller.getReceipt,
);
router.post("/", requirePermission(PERMISSIONS.PAYMENTS_CREATE), validate(createPaymentSchema), controller.create);
router.patch(
  "/:id/cancel",
  requirePermission(PERMISSIONS.PAYMENTS_DELETE),
  validate(cancelPaymentSchema),
  controller.cancel,
);

export default router;
