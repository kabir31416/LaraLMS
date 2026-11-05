import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { homeRouteFor, ProtectedRoute } from "@/components/ProtectedRoute";
import { hasPermission, useAuth } from "@/contexts/AuthContext";
import { ADMIT_CARDS_MANAGE, ADMISSION_RESULTS_MANAGE, ID_CARDS_MANAGE, MESS_EXPENSES_APPROVE, MESS_EXPENSES_MANAGE, MESS_COMPLAINTS_MANAGE, MESS_NOTICES_MANAGE, MESS_REPORTS_READ, MESS_SETTINGS_MANAGE, MESS_VIEW, REPORTS_READ, RESULTS_READ } from "@/lib/permissions";
import { MessScopeProvider } from "@/components/mess/MessShell";
import Home from "./pages/Home";
import { AdminLoginPage, StaffLoginPage, StudentLoginPage } from "./pages/PortalLogin";
import PublicInfo from "./pages/PublicInfo";
import PublicStudentSearch from "./pages/PublicStudentSearch";
import Marksheet from "./pages/Marksheet";
import StudentEntry from "./pages/StudentEntry";
import NewStudentEntry from "./pages/NewStudentEntry";
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
import PerformanceAnalytics from "./pages/PerformanceAnalytics";
import StudentImportUpload from "./pages/StudentImportUpload";
import StudentImportPreview from "./pages/StudentImportPreview";
import PendingStudents from "./pages/PendingStudents";

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
import StudentIdCard from "./pages/student/StudentIdCard";
import StudentAdmitCards from "./pages/student/StudentAdmitCards";
import IdCards from "./pages/IdCards";
import AdmitCards from "./pages/AdmitCards";
import AdmitCardExam from "./pages/AdmitCardExam";
import VerifyCard from "./pages/VerifyCard";
import StudentAttendance from "./pages/student/StudentAttendance";
import StudentResults from "./pages/student/StudentResults";
import StudentPayments from "./pages/student/StudentPayments";
import StudentBooks from "./pages/student/StudentBooks";
import StudentVideos from "./pages/student/StudentVideos";
import StudentNotices from "./pages/student/StudentNotices";
import StudentMess from "./pages/student/StudentMess";

// Mess / Hostel Management (Admin + Mess staff portal)
import MessDashboard from "./pages/mess/MessDashboard";
import MessSetup from "./pages/mess/MessSetup";
import MessMembers from "./pages/mess/MessMembers";
import MessMemberProfile from "./pages/mess/MessMemberProfile";
import MessBilling from "./pages/mess/MessBilling";
import MessPayments from "./pages/mess/MessPayments";
import MessDeposits from "./pages/mess/MessDeposits";
import MessExpenses from "./pages/mess/MessExpenses";
import MessComplaints from "./pages/mess/MessComplaints";
import MessNotices from "./pages/mess/MessNotices";
import MessReports from "./pages/mess/MessReports";
import MessSettingsPage from "./pages/mess/MessSettingsPage";
import { MessInvoicePage, MessReceiptPage, MessSettlementPrintPage } from "./pages/mess/MessPrint";

/**
 * "/" — the public homepage (login portal chooser) for a signed-out
 * visitor, the Admin dashboard for an Admin (same guard as before), and the
 * user's own home for every other role. Existing "/" links keep working.
 */
function HomeGate() {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  if (!user) return <Home />;
  if (user.role !== "Admin") return <Navigate to={homeRouteFor(user.role)} replace />;
  return <ProtectedRoute roles={["Admin"]}><Index /></ProtectedRoute>;
}

/** The old single /login page → the homepage chooser (or straight to the portal an old link asked for). */
function LegacyLogin() {
  const { user } = useAuth();
  if (user) return <Navigate to={homeRouteFor(user.role)} replace />;
  const tab = new URLSearchParams(window.location.search).get("tab");
  const target = tab === "student" ? "/studentLogin" : tab === "staff" ? "/staffLogin" : tab === "admin" ? "/adminLogin" : "/";
  return <Navigate to={target} replace />;
}

/** Passes when the user holds ANY of the keys (ProtectedRoute's `permission` checks just one). */
function AnyPermission({ perms, children }: { perms: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!perms.some((p) => hasPermission(user, p))) return <Navigate to="/mess" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeGate />} />
      <Route path="/studentLogin" element={<StudentLoginPage />} />
      <Route path="/staffLogin" element={<StaffLoginPage />} />
      <Route path="/adminLogin" element={<AdminLoginPage />} />
      <Route path="/login" element={<LegacyLogin />} />
      <Route path="/info" element={<PublicInfo />} />
      <Route path="/info/search" element={<PublicStudentSearch />} />
      <Route path="/marksheet" element={<Marksheet />} />
      <Route path="/studententry" element={<StudentEntry />} />
      <Route path="/newstudententry" element={<NewStudentEntry />} />
      {/* QR verification for ID / admit cards — public, minimal data, rate-limited on the server. */}
      <Route path="/verify/:kind/:code" element={<VerifyCard />} />

      {/* Admin */}
      <Route element={<ProtectedRoute roles={["Admin"]}><Outlet /></ProtectedRoute>}>
        <Route path="/students" element={<Students />} />
        <Route path="/admission" element={<Admission />} />
        <Route path="/admission/import" element={<StudentImportUpload />} />
        <Route path="/admission/import/:sessionId" element={<StudentImportPreview />} />
        <Route path="/admission/pending" element={<PendingStudents />} />
        <Route path="/fees" element={<FeeManagement />} />
        <Route path="/books" element={<Books />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/notices" element={<Notices />} />
        {/* Result Entry (marks + attendance together) — Admin can act on any batch, not just their own; the backend already allowed this via EXAMS_MANAGE, DirectorResults.tsx is reused as-is (role-aware). */}
        <Route path="/result-entry" element={<DirectorResults />} />
        <Route path="/result-management" element={<ResultManagement />} />
        <Route path="/analytics" element={<ProtectedRoute permission={RESULTS_READ}><PerformanceAnalytics /></ProtectedRoute>} />
        <Route path="/id-cards" element={<ProtectedRoute permission={ID_CARDS_MANAGE}><IdCards /></ProtectedRoute>} />
        <Route path="/admit-cards" element={<ProtectedRoute permission={ADMIT_CARDS_MANAGE}><AdmitCards /></ProtectedRoute>} />
        <Route path="/admit-cards/:id" element={<ProtectedRoute permission={ADMIT_CARDS_MANAGE}><AdmitCardExam /></ProtectedRoute>} />
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

      {/* Mess / Hostel Management — Admin and Mess staff portal logins. The
          route-level permission only stops the page rendering for a caller
          the API would reject anyway; every endpoint (and Mess-level scope)
          is enforced server-side. */}
      <Route element={<ProtectedRoute roles={["Admin", "Mess Staff"]} permission={MESS_VIEW}><MessScopeProvider><Outlet /></MessScopeProvider></ProtectedRoute>}>
        <Route path="/mess" element={<MessDashboard />} />
        <Route path="/mess/setup" element={<MessSetup />} />
        <Route path="/mess/members" element={<MessMembers />} />
        <Route path="/mess/members/:id" element={<MessMemberProfile />} />
        <Route path="/mess/billing" element={<MessBilling />} />
        <Route path="/mess/payments" element={<MessPayments />} />
        <Route path="/mess/deposits" element={<MessDeposits />} />
        <Route path="/mess/reports" element={<ProtectedRoute permission={MESS_REPORTS_READ}><MessReports /></ProtectedRoute>} />
      </Route>
      <Route element={<ProtectedRoute roles={["Admin", "Mess Staff"]}><MessScopeProvider><Outlet /></MessScopeProvider></ProtectedRoute>}>
        <Route path="/mess/expenses" element={<AnyPermission perms={[MESS_EXPENSES_MANAGE, MESS_EXPENSES_APPROVE]}><MessExpenses /></AnyPermission>} />
        <Route path="/mess/complaints" element={<AnyPermission perms={[MESS_COMPLAINTS_MANAGE]}><MessComplaints /></AnyPermission>} />
        <Route path="/mess/notices" element={<AnyPermission perms={[MESS_NOTICES_MANAGE]}><MessNotices /></AnyPermission>} />
        <Route path="/mess/settings" element={<AnyPermission perms={[MESS_SETTINGS_MANAGE]}><MessSettingsPage /></AnyPermission>} />
      </Route>

      {/* Admin or Director can view a student's full profile */}
      <Route
        path="/students/:id"
        element={<ProtectedRoute roles={["Admin", "Batch Director"]}><StudentProfile /></ProtectedRoute>}
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
        {/* Mess print documents — staff (within their Mess scope) or the student who owns them; the backend enforces which. */}
        <Route path="/mess/payments/:id/receipt" element={<MessReceiptPage />} />
        <Route path="/mess/bills/:id/invoice" element={<MessInvoicePage />} />
        <Route path="/mess/settlements/:id/print" element={<MessSettlementPrintPage />} />
      </Route>

      {/* Director */}
      <Route element={<ProtectedRoute roles={["Batch Director"]}><Outlet /></ProtectedRoute>}>
        <Route path="/director" element={<DirectorDashboard />} />
        <Route path="/director/students" element={<DirectorStudents />} />
        <Route path="/director/results" element={<DirectorResults />} />
        <Route path="/director/result-management" element={<ResultManagement />} />
        <Route path="/director/analytics" element={<PerformanceAnalytics />} />
        <Route path="/director/admission-result" element={<AdmissionResult />} />
        <Route path="/director/chance-results" element={<ChanceResults />} />
        {/* ID / admit cards — read & print only, own batches (server-scoped). */}
        <Route path="/director/id-cards" element={<IdCards />} />
        <Route path="/director/admit-cards" element={<AdmitCards />} />
        <Route path="/director/admit-cards/:id" element={<AdmitCardExam />} />
        {/* Attendance is no longer a separate director workflow — it's entered together with marks on Result Entry (Phase 5). */}
        <Route path="/director/attendance" element={<Navigate to="/director/results" replace />} />
      </Route>

      {/* Student */}
      <Route element={<ProtectedRoute roles={["Student"]}><Outlet /></ProtectedRoute>}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/profile" element={<StudentProfileSelf />} />
        <Route path="/student/id-card" element={<StudentIdCard />} />
        <Route path="/student/admit-cards" element={<StudentAdmitCards />} />
        <Route path="/student/attendance" element={<StudentAttendance />} />
        <Route path="/student/results" element={<StudentResults />} />
        <Route path="/student/payments" element={<StudentPayments />} />
        <Route path="/student/books" element={<StudentBooks />} />
        <Route path="/student/notices" element={<StudentNotices />} />
        <Route path="/student/videos" element={<StudentVideos />} />
        <Route path="/student/mess" element={<StudentMess />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}