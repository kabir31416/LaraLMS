import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createPaymentMethodSchema, idParamSchema, listQuerySchema, updatePaymentMethodSchema } from "./paymentMethod.validation";
import * as controller from "./paymentMethod.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

router.get("/", validate(listQuerySchema), controller.list);
router.post("/", requirePermission(PERMISSIONS.PAYMENT_METHODS_MANAGE, PERMISSIONS.SETTINGS_MANAGE), validate(createPaymentMethodSchema), controller.create);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.PAYMENT_METHODS_MANAGE, PERMISSIONS.SETTINGS_MANAGE),
  validate(updatePaymentMethodSchema),
  controller.update,
);
router.delete("/:id", requirePermission(PERMISSIONS.PAYMENT_METHODS_MANAGE, PERMISSIONS.SETTINGS_MANAGE), validate(idParamSchema), controller.remove);

export default router;
