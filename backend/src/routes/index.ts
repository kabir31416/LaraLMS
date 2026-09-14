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
import paymentRoutes from "../modules/payments/payment.routes";
import attendanceRoutes from "../modules/attendance/attendance.routes";
import examRoutes from "../modules/exams/exam.routes";
import resultRoutes from "../modules/exams/result.routes";
import bookRoutes from "../modules/books/book.routes";
import branchRoutes from "../modules/branches/branch.routes";
import accountsRoutes from "../modules/accounts/accounts.routes";
import branchLedgerRoutes from "../modules/accounts/branchLedger.routes";
import noticeRoutes from "../modules/notices/notice.routes";
import publicInfoRoutes from "../modules/publicInfo/publicInfo.routes";
import publicResultsRoutes from "../modules/publicResults/publicResults.routes";

/**
 * Every module's router is mounted here under /api/v1/... — Phase 2 §12.
 * `/public` is the one router group without a `requireAuth` gate anywhere
 * inside it — see publicInfo.routes.ts.
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
router.use("/payments", paymentRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/exams", examRoutes);
router.use("/results", resultRoutes);
router.use("/books", bookRoutes);
router.use("/branches", branchRoutes);
router.use("/accounts", accountsRoutes);
router.use("/branch-ledger", branchLedgerRoutes);
router.use("/notices", noticeRoutes);
router.use("/public", publicInfoRoutes);
router.use("/public/results", publicResultsRoutes);

export default router;
