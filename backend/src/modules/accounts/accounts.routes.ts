import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import * as controller from "./accounts.controller";
import { PERMISSIONS } from "../rbac/permissions";
import {
  createExpenseSchema,
  createIncomeSchema,
  idParamSchema,
  listExpenseQuerySchema,
  listIncomeQuerySchema,
  updateCategoriesSchema,
  updateExpenseSchema,
  updateIncomeSchema,
} from "./accounts.validation";

const router = Router();

router.use(requireAuth, requirePermission(PERMISSIONS.ACCOUNTS_MANAGE));

router.get("/income", validate(listIncomeQuerySchema), controller.listIncome);
router.post("/income", validate(createIncomeSchema), controller.createIncome);
router.patch("/income/:id", validate(updateIncomeSchema), controller.updateIncome);
router.delete("/income/:id", validate(idParamSchema), controller.deleteIncome);

router.get("/expense", validate(listExpenseQuerySchema), controller.listExpense);
router.post("/expense", validate(createExpenseSchema), controller.createExpense);
router.patch("/expense/:id", validate(updateExpenseSchema), controller.updateExpense);
router.delete("/expense/:id", validate(idParamSchema), controller.deleteExpense);

router.get("/categories", controller.getCategories);
router.patch("/categories", validate(updateCategoriesSchema), controller.updateCategories);

export default router;
