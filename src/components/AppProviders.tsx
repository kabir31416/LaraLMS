import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AcademicProvider } from "@/contexts/AcademicContext";
import { StaffProvider } from "@/contexts/StaffContext";
import { StudentProvider } from "@/contexts/StudentContext";
import { BatchProvider } from "@/contexts/BatchContext";
import { RoutineProvider } from "@/contexts/RoutineContext";
import { BookProvider } from "@/contexts/BookContext";
import { AccountsProvider } from "@/contexts/AccountsContext";
import { BranchLedgerProvider } from "@/contexts/BranchLedgerContext";
import { AttendanceProvider } from "@/contexts/AttendanceContext";
import { NoticeProvider } from "@/contexts/NoticeContext";
import { AccountsAutoBridge } from "@/components/accounts/AccountsAutoBridge";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

const queryClient = new QueryClient();

/**
 * Single flattened provider tree. Order matters:
 *   Auth → Academic (master data) → Staff → Student → Batch (needs staff+student)
 *   → Routine/Book/Accounts/BranchLedger/Attendance/Notice (feature layers)
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AcademicProvider>
            <StaffProvider>
              <StudentProvider>
                <BatchProvider>
                  <RoutineProvider>
                    <BookProvider>
                      <AccountsProvider>
                        <BranchLedgerProvider>
                          <AttendanceProvider>
                            <NoticeProvider>
                              <AccountsAutoBridge />
                              <Toaster />
                              <Sonner />
                              {children}
                            </NoticeProvider>
                          </AttendanceProvider>
                        </BranchLedgerProvider>
                      </AccountsProvider>
                    </BookProvider>
                  </RoutineProvider>
                </BatchProvider>
              </StudentProvider>
            </StaffProvider>
          </AcademicProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}