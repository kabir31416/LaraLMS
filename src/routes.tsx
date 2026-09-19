import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ADMISSION_RESULTS_MANAGE, REPORTS_READ } from "@/lib/permissions";
import Login from "./pages/Login";
import PublicInfo from "./pages/PublicInfo";
import Marksheet from "./pages/Marksheet";
import NotFound from "./pages/NotFound";

// Admin pages
import Index from "./pages/Index";
import Students from "./pages/Students";
import Admission from "./pages/Admission";
import StudentProfile from "./pages/StudentProfile";
import FeeManagement from "./pages/FeeManagement";
import PaymentReceipt from "./pages/PaymentReceipt";
import Books from "./pages/Books";
import Accounts from "./pages/Accounts";
import StaffPage from "./pages/Staff";
import Batches from "./pages/Batches";
import Settings from "./pages/Settings";
import Attendance from "./pages/Attendance";
import Notices from "./pages/Notices";
import Reports from "./pages/Reports";
import AdmissionResult from "./pages/AdmissionResult";
import ChanceResults from "./pages/ChanceResults";
import ResultManagement from "./pages/ResultManagement";
import StudentImportUpload from "./pages/StudentImportUpload";
import StudentImportPreview from "./pages/StudentImportPreview";

// Shared (Admin + Director)
import Exams from "./pages/Exams";
import VideoClasses from "./pages/VideoClasses";

// Director pages
import DirectorDashboard from "./pages/DirectorDashboard";
import DirectorStudents from "./pages/DirectorStudents";
import DirectorResults from "./pages/DirectorResults";

// Student portal
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentProfileSelf from "./pages/student/StudentProfile";
import StudentAttendance from "./pages/student/StudentAttendance";
import StudentResults from "./pages/student/StudentResults";
import StudentPayments from "./pages/student/StudentPayments";
import StudentBooks from "./pages/student/StudentBooks";
import StudentVideos from "./pages/student/StudentVideos";
import StudentNotices from "./pages/student/StudentNotices";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/info" element={<PublicInfo />} />
      <Route path="/marksheet" element={<Marksheet />} />

      {/* Admin */}
      <Route element={<ProtectedRoute roles={["Admin"]}><Outlet /></ProtectedRoute>}>
        <Route path="/" element={<Index />} />
        <Route path="/students" element={<Students />} />
        <Route path="/admission" element={<Admission />} />
        <Route path="/admission/import" element={<StudentImportUpload />} />
        <Route path="/admission/import/:sessionId" element={<StudentImportPreview />} />
        <Route path="/fees" element={<FeeManagement />} />
        <Route path="/books" element={<Books />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/notices" element={<Notices />} />
        <Route path="/result-management" element={<ResultManagement />} />
      </Route>

      {/* Admin — Admission Result (upload/preview/confirm/process pipeline + its roll-bookkeeping front page) can be individually disabled per-Admin (User.deniedPermissions), so it's gated by its own dedicated permission on top of the Admin role. */}
      <Route element={<ProtectedRoute roles={["Admin"]} permission={ADMISSION_RESULTS_MANAGE}><Outlet /></ProtectedRoute>}>
        <Route path="/admission-result" element={<AdmissionResult />} />
        <Route path="/chance-results" element={<ChanceResults />} />
      </Route>

      {/* Admin — Reports has no dedicated backend route of its own (it aggregates
          other modules' own permission-gated endpoints), so REPORTS_READ only
          controls this page/nav-item's visibility, not a real server-side
          boundary — matching the module picker in StaffForm.tsx. */}
      <Route element={<ProtectedRoute roles={["Admin"]} permission={REPORTS_READ}><Outlet /></ProtectedRoute>}>
        <Route path="/reports" element={<Reports />} />
      </Route>

      {/* Admin or Director can view a student's full profile */}
      <Route
        path="/students/:id"
        element={<ProtectedRoute><StudentProfile /></ProtectedRoute>}
      />

      {/* Shared (any authenticated) */}
      <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
        <Route path="/exams" element={<Exams />} />
        <Route path="/videos" element={<VideoClasses />} />
        {/* Dedicated print-ready Payment Receipt (Coaching Reg No / Roll vs
            System ID spec §11/§18/§20) — not wrapped in DashboardLayout, so
            no sidebar/navbar ever renders on this route at all. Reachable by
            Admin (Fee Management) and a Student viewing their own payment
            (backend enforces the ownership check either way). */}
        <Route path="/payments/:paymentId/receipt" element={<PaymentReceipt />} />
      </Route>

      {/* Director */}
      <Route element={<ProtectedRoute roles={["Batch Director"]}><Outlet /></ProtectedRoute>}>
        <Route path="/director" element={<DirectorDashboard />} />
        <Route path="/director/students" element={<DirectorStudents />} />
        <Route path="/director/results" element={<DirectorResults />} />
        <Route path="/director/result-management" element={<ResultManagement />} />
        <Route path="/director/admission-result" element={<AdmissionResult />} />
        <Route path="/director/chance-results" element={<ChanceResults />} />
        {/* Attendance is no longer a separate director workflow — it's entered together with marks on Result Entry (Phase 5). */}
        <Route path="/director/attendance" element={<Navigate to="/director/results" replace />} />
      </Route>

      {/* Student */}
      <Route element={<ProtectedRoute roles={["Student"]}><Outlet /></ProtectedRoute>}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/profile" element={<StudentProfileSelf />} />
        <Route path="/student/attendance" element={<StudentAttendance />} />
        <Route path="/student/results" element={<StudentResults />} />
        <Route path="/student/payments" element={<StudentPayments />} />
        <Route path="/student/books" element={<StudentBooks />} />
        <Route path="/student/notices" element={<StudentNotices />} />
        <Route path="/student/videos" element={<StudentVideos />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}