import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/user.routes";
import roleRoutes from "../modules/rbac/role.routes";
import settingsRoutes from "../modules/settings/settings.routes";
import academicSessionRoutes from "../modules/academicSessions/academicSession.routes";
import courseRoutes from "../modules/courses/course.routes";
import subjectRoutes from "../modules/subjects/subject.routes";
import courseSubjectRoutes from "../modules/courseSubjects/courseSubject.routes";
import courseSubjectFlatRoutes from "../modules/courseSubjects/courseSubjectFlat.routes";
import lectureRoutes from "../modules/lectures/lecture.routes";
import studentRoutes from "../modules/students/student.routes";
import studentImportRoutes from "../modules/studentImports/studentImport.routes";
import hscInstitutionRoutes from "../modules/hscInstitutions/hscInstitution.routes";
import guardianRoutes from "../modules/guardians/guardian.routes";
import batchRoutes from "../modules/batches/batch.routes";
import staffRoutes from "../modules/staff/staff.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";
import paymentRoutes from "../modules/payments/payment.routes";
import paymentMethodRoutes from "../modules/paymentMethods/paymentMethod.routes";
import attendanceRoutes from "../modules/attendance/attendance.routes";
import examRoutes from "../modules/exams/exam.routes";
import resultRoutes from "../modules/exams/result.routes";
import resultManagementRoutes from "../modules/exams/resultManagement.routes";
import materialTypeRoutes from "../modules/materialTypes/materialType.routes";
import materialRoutes from "../modules/materials/material.routes";
import branchRoutes from "../modules/branches/branch.routes";
import accountsRoutes from "../modules/accounts/accounts.routes";
import branchLedgerRoutes from "../modules/accounts/branchLedger.routes";
import noticeRoutes from "../modules/notices/notice.routes";
import publicInfoRoutes from "../modules/publicInfo/publicInfo.routes";
import publicResultsRoutes from "../modules/publicResults/publicResults.routes";
import publicStudentEntryRoutes from "../modules/publicStudentEntry/publicStudentEntry.routes";
import auditLogRoutes from "../audit/auditLog.routes";
import admissionResultRoutes from "../modules/admissionResults/admissionResult.routes";

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
// Course → Subjects assignment (Subject/Course Refactor): a flat listing
// across every Course ("/course-subjects") alongside per-Course CRUD
// ("/courses/:courseId/subjects" — mergeParams:true reads :courseId from
// this mount path).
router.use("/course-subjects", courseSubjectFlatRoutes);
router.use("/courses/:courseId/subjects", courseSubjectRoutes);
router.use("/lectures", lectureRoutes);
// Mounted before "/students" so its fixed-segment paths (e.g. /students/import/history)
// are never at risk of a future "/students/:id"-style route swallowing them.
router.use("/students/import", studentImportRoutes);
router.use("/students", studentRoutes);
router.use("/hsc-institutions", hscInstitutionRoutes);
router.use("/guardians", guardianRoutes);
router.use("/batches", batchRoutes);
router.use("/staff", staffRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/payments", paymentRoutes);
router.use("/payment-methods", paymentMethodRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/exams", examRoutes);
router.use("/results", resultRoutes);
router.use("/result-management", resultManagementRoutes);
router.use("/material-types", materialTypeRoutes);
router.use("/materials", materialRoutes);
router.use("/branches", branchRoutes);
router.use("/accounts", accountsRoutes);
router.use("/branch-ledger", branchLedgerRoutes);
router.use("/notices", noticeRoutes);
router.use("/public", publicInfoRoutes);
router.use("/public/results", publicResultsRoutes);
router.use("/public/student-entry", publicStudentEntryRoutes);
router.use("/audit-logs", auditLogRoutes);
router.use("/admission-results", admissionResultRoutes);

export default router;
