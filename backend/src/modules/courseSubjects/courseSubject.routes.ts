import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { assignSubjectSchema, courseIdParamSchema, courseSubjectIdParamSchema, updateCourseSubjectSchema } from "./courseSubject.validation";
import * as controller from "./courseSubject.controller";
import { PERMISSIONS } from "../rbac/permissions";

// Mounted at /courses/:courseId/subjects (mergeParams — routes/index.ts) — the
// Course → Subjects relationship, conceptually "manage which global Subjects
// this Course has." Reuses SUBJECTS_MANAGE for writes, same as the global
// Subject catalog itself, rather than inventing a separate permission.
const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get("/", validate(courseIdParamSchema), controller.list);
router.post("/", requirePermission(PERMISSIONS.SUBJECTS_MANAGE), validate(assignSubjectSchema), controller.assign);
router.patch("/:courseSubjectId", requirePermission(PERMISSIONS.SUBJECTS_MANAGE), validate(updateCourseSubjectSchema), controller.update);
router.delete("/:courseSubjectId", requirePermission(PERMISSIONS.SUBJECTS_MANAGE), validate(courseSubjectIdParamSchema), controller.remove);

export default router;
