import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import * as controller from "./branchLedger.controller";
import { PERMISSIONS } from "../rbac/permissions";
import { createBranchLedgerSchema, idParamSchema, listBranchLedgerQuerySchema, updateBranchLedgerSchema } from "./accounts.validation";

const router = Router();

router.use(requireAuth, requirePermission(PERMISSIONS.BRANCH_LEDGER_MANAGE));

router.get("/", validate(listBranchLedgerQuerySchema), controller.list);
router.get("/summary", controller.summary);
router.post("/", validate(createBranchLedgerSchema), controller.create);
router.patch("/:id", validate(updateBranchLedgerSchema), controller.update);
router.delete("/:id", validate(idParamSchema), controller.remove);

export default router;
