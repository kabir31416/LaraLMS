import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/user.routes";
import roleRoutes from "../modules/rbac/role.routes";
import settingsRoutes from "../modules/settings/settings.routes";
import academicSessionRoutes from "../modules/academicSessions/academicSession.routes";
import courseRoutes from "../modules/courses/course.routes";
import subjectRoutes from "../modules/subjects/subject.routes";
import lectureRoutes from "../modules/lectures/lecture.routes";

/**
 * Every module's router is mounted here under /api/v1/... — Phase 2 §12.
 * Modules still pending (Dashboard's real aggregation, Students, Batches,
 * Fees, ...) are added to this same list as each is implemented; see the
 * task tracker. Dashboard is deliberately built last among Modules 4-9
 * since it aggregates data owned by modules that don't exist yet.
 */
const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/settings", settingsRoutes);
router.use("/sessions", academicSessionRoutes);
router.use("/courses", courseRoutes);
router.use("/subjects", subjectRoutes);
router.use("/lectures", lectureRoutes);

export default router;
