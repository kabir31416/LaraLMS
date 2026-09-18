import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createPaymentSchema, idParamSchema, listPaymentsQuerySchema } from "./payment.validation";
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

export default router;
