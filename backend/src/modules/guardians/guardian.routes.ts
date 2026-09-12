import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { createGuardianSchema, guardianIdParamSchema, studentIdParamSchema, updateGuardianSchema } from "./guardian.validation";
import * as controller from "./guardian.controller";
import { PERMISSIONS } from "../rbac/permissions";

/** Nested under /students/:studentId/guardians — mounted from student.routes.ts. */
export const nestedGuardianRouter = Router({ mergeParams: true });
nestedGuardianRouter.get("/", requireAuth, requirePermission(PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_READ_OWN_BATCH), validate(studentIdParamSchema), controller.listByStudent);
nestedGuardianRouter.post("/", requireAuth, requirePermission(PERMISSIONS.STUDENTS_UPDATE), validate(createGuardianSchema), controller.create);

/** Standalone /guardians/:id for edit/delete once you already have the guardian's own id. */
const router = Router();
router.use(requireAuth, requirePermission(PERMISSIONS.STUDENTS_UPDATE));
router.patch("/:id", validate(updateGuardianSchema), controller.update);
router.delete("/:id", validate(guardianIdParamSchema), controller.remove);

export default router;
