import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createBranchSchema, idParamSchema, listBranchesQuerySchema, updateBranchSchema } from "./branch.validation";
import * as controller from "./branch.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth);

// Reading the branch list is low-sensitivity reference data (name/address/phone), needed
// wherever a branch picker appears (Accounts) — any authenticated user may read it.
router.get("/", validate(listBranchesQuerySchema), controller.list);
router.get("/:id", validate(idParamSchema), controller.getById);
router.post("/", requirePermission(PERMISSIONS.BRANCHES_MANAGE), validate(createBranchSchema), controller.create);
router.patch("/:id", requirePermission(PERMISSIONS.BRANCHES_MANAGE), validate(updateBranchSchema), controller.update);
router.delete("/:id", requirePermission(PERMISSIONS.BRANCHES_MANAGE), validate(idParamSchema), controller.remove);

export default router;
