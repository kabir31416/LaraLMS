import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StudentProvider } from "@/contexts/StudentContext";
import { RoutineProvider } from "@/contexts/RoutineContext";
import Index from "./pages/Index.tsx";
import Students from "./pages/Students.tsx";
import Admission from "./pages/Admission.tsx";
import StudentProfile from "./pages/StudentProfile.tsx";
import FeeManagement from "./pages/FeeManagement.tsx";
import Routine from "./pages/Routine.tsx";
import Books from "./pages/Books.tsx";
import Accounts from "./pages/Accounts.tsx";
import StaffPage from "./pages/Staff.tsx";
import Batches from "./pages/Batches.tsx";
import Login from "./pages/Login.tsx";
import DirectorDashboard from "./pages/DirectorDashboard.tsx";
import DirectorStudents from "./pages/DirectorStudents.tsx";
import Settings from "./pages/Settings.tsx";
import Exams from "./pages/Exams.tsx";
import VideoClasses from "./pages/VideoClasses.tsx";
import Attendance from "./pages/Attendance.tsx";
import DirectorResults from "./pages/DirectorResults.tsx";
import DirectorAttendance from "./pages/DirectorAttendance.tsx";
import NotFound from "./pages/NotFound.tsx";
import { BookProvider } from "@/contexts/BookContext";
import { AccountsProvider } from "@/contexts/AccountsContext";
import { AccountsAutoBridge } from "@/components/accounts/AccountsAutoBridge";
import { BranchLedgerProvider } from "@/contexts/BranchLedgerContext";
import { StaffProvider } from "@/contexts/StaffContext";
import { BatchProvider } from "@/contexts/BatchContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AcademicProvider } from "@/contexts/AcademicContext";
import { AttendanceProvider } from "@/contexts/AttendanceContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <StudentProvider>
        <StaffProvider>
          <AcademicProvider>
            <BatchProvider>
              <AuthProvider>
                <RoutineProvider>
                  <BookProvider>
                    <AccountsProvider>
                      <BranchLedgerProvider>
                      <AttendanceProvider>
                      <AccountsAutoBridge />
                      <Toaster />
                      <Sonner />
                      <BrowserRouter>
                        <Routes>
                          <Route path="/login" element={<Login />} />

                          {/* Admin routes */}
                          <Route path="/" element={<ProtectedRoute roles={["Admin"]}><Index /></ProtectedRoute>} />
                          <Route path="/students" element={<ProtectedRoute roles={["Admin"]}><Students /></ProtectedRoute>} />
                          <Route path="/students/:id" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
                          <Route path="/admission" element={<ProtectedRoute roles={["Admin"]}><Admission /></ProtectedRoute>} />
                          <Route path="/fees" element={<ProtectedRoute roles={["Admin"]}><FeeManagement /></ProtectedRoute>} />
                          <Route path="/routine" element={<ProtectedRoute roles={["Admin"]}><Routine /></ProtectedRoute>} />
                          <Route path="/books" element={<ProtectedRoute roles={["Admin"]}><Books /></ProtectedRoute>} />
                          <Route path="/accounts" element={<ProtectedRoute roles={["Admin"]}><Accounts /></ProtectedRoute>} />
                          <Route path="/staff" element={<ProtectedRoute roles={["Admin"]}><StaffPage /></ProtectedRoute>} />
                          <Route path="/batches" element={<ProtectedRoute roles={["Admin"]}><Batches /></ProtectedRoute>} />
                          <Route path="/settings" element={<ProtectedRoute roles={["Admin"]}><Settings /></ProtectedRoute>} />
                          <Route path="/attendance" element={<ProtectedRoute roles={["Admin"]}><Attendance /></ProtectedRoute>} />

                          {/* Shared (Admin + Director) */}
                          <Route path="/exams" element={<ProtectedRoute><Exams /></ProtectedRoute>} />
                          <Route path="/videos" element={<ProtectedRoute><VideoClasses /></ProtectedRoute>} />

                          {/* Director routes */}
                          <Route path="/director" element={<ProtectedRoute roles={["Batch Director"]}><DirectorDashboard /></ProtectedRoute>} />
                          <Route path="/director/students" element={<ProtectedRoute roles={["Batch Director"]}><DirectorStudents /></ProtectedRoute>} />
                          <Route path="/director/results" element={<ProtectedRoute roles={["Batch Director"]}><DirectorResults /></ProtectedRoute>} />
                          <Route path="/director/attendance" element={<ProtectedRoute roles={["Batch Director"]}><DirectorAttendance /></ProtectedRoute>} />

                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </BrowserRouter>
                      </AttendanceProvider>
                      </BranchLedgerProvider>
                    </AccountsProvider>
                  </BookProvider>
                </RoutineProvider>
              </AuthProvider>
            </BatchProvider>
          </AcademicProvider>
        </StaffProvider>
      </StudentProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
