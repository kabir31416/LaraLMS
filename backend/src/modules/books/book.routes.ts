import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import * as controller from "./book.controller";
import { PERMISSIONS } from "../rbac/permissions";
import {
  createBookSchema,
  idParamSchema,
  issueToStudentSchema,
  listBookIssuesQuerySchema,
  listBooksQuerySchema,
  listBranchStockQuerySchema,
  listHistoryQuerySchema,
  returnBookSchema,
  stockAdjustSchema,
  transferToBranchSchema,
  updateBookSchema,
} from "./book.validation";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission(PERMISSIONS.BOOKS_MANAGE, PERMISSIONS.BOOKS_READ_OWN), validate(listBooksQuerySchema), controller.list);
router.post("/", requirePermission(PERMISSIONS.BOOKS_MANAGE), validate(createBookSchema), controller.create);
router.patch("/:id", requirePermission(PERMISSIONS.BOOKS_MANAGE), validate(updateBookSchema), controller.update);
router.delete("/:id", requirePermission(PERMISSIONS.BOOKS_MANAGE), validate(idParamSchema), controller.remove);
router.post("/:id/stock", requirePermission(PERMISSIONS.BOOKS_MANAGE), validate(stockAdjustSchema), controller.adjustStock);

router.get("/branch-stock/list", requirePermission(PERMISSIONS.BOOKS_MANAGE), validate(listBranchStockQuerySchema), controller.listBranchStock);
router.post("/branch-stock/transfer", requirePermission(PERMISSIONS.BOOKS_MANAGE), validate(transferToBranchSchema), controller.transferToBranch);

router.get("/issues/list", requirePermission(PERMISSIONS.BOOKS_MANAGE, PERMISSIONS.BOOKS_READ_OWN), validate(listBookIssuesQuerySchema), controller.listIssues);
router.post("/issues", requirePermission(PERMISSIONS.BOOKS_MANAGE), validate(issueToStudentSchema), controller.issueToStudent);
router.post("/issues/:id/return", requirePermission(PERMISSIONS.BOOKS_MANAGE), validate(returnBookSchema), controller.returnFromStudent);

router.get("/history/list", requirePermission(PERMISSIONS.BOOKS_MANAGE), validate(listHistoryQuerySchema), controller.listHistory);

export default router;
