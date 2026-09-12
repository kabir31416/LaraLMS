import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/user.routes";
import roleRoutes from "../modules/rbac/role.routes";
import settingsRoutes from "../modules/settings/settings.routes";
import academicSessionRoutes from "../modules/academicSessions/academicSession.routes";
import courseRoutes from "../modules/courses/course.routes";
import subjectRoutes from "../modules/subjects/subject.routes";
import lectureRoutes from "../modules/lectures/lecture.routes";
import studentRoutes from "../modules/students/student.routes";
import guardianRoutes from "../modules/guardians/guardian.routes";
import batchRoutes from "../modules/batches/batch.routes";
import staffRoutes from "../modules/staff/staff.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";

/**
 * Every module's router is mounted here under /api/v1/... — Phase 2 §12.
 * Modules still pending (Fees, Attendance, ...) are added to this same
 * list as each is implemented; see the task tracker. Dashboard only
 * aggregates the stat cards backed by Student/Batch so far — today's
 * collection, attendance stats, and notices stay on the frontend's mock
 * sources until Modules 15-20 and 25 land.
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
router.use("/students", studentRoutes);
router.use("/guardians", guardianRoutes);
router.use("/batches", batchRoutes);
router.use("/staff", staffRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
