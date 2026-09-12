import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createUserSchema, listUsersQuerySchema, updateUserSchema, userIdParamSchema } from "./user.validation";
import * as userController from "./user.controller";
import { PERMISSIONS } from "../rbac/permissions";

const router = Router();

router.use(requireAuth, requirePermission(PERMISSIONS.USERS_MANAGE));

router.get("/", validate(listUsersQuerySchema), userController.listUsers);
router.get("/:id", validate(userIdParamSchema), userController.getUser);
router.post("/", validate(createUserSchema), userController.createUser);
router.patch("/:id", validate(updateUserSchema), userController.updateUser);
router.delete("/:id", validate(userIdParamSchema), userController.deleteUser);

export default router;
