import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { StudentSelfProvider } from "@/contexts/StudentSelfContext";
import { AcademicProvider } from "@/contexts/AcademicContext";
import { StaffProvider } from "@/contexts/StaffContext";
import { StudentProvider } from "@/contexts/StudentContext";
import { PaymentProvider } from "@/contexts/PaymentContext";
import { BatchProvider } from "@/contexts/BatchContext";
import { RoutineProvider } from "@/contexts/RoutineContext";
import { BranchProvider } from "@/contexts/BranchContext";
import { MaterialProvider } from "@/contexts/MaterialContext";
import { AccountsProvider } from "@/contexts/AccountsContext";
import { BranchLedgerProvider } from "@/contexts/BranchLedgerContext";
import { AttendanceProvider } from "@/contexts/AttendanceContext";
import { NoticeProvider } from "@/contexts/NoticeContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

const queryClient = new QueryClient();

/**
 * Single flattened provider tree. Order matters:
 *   Auth → StudentSelf (needs only Auth; the Student Portal's one call) →
 *   Academic (master data) → Staff → Student → Payment (needs Student)
 *   → Batch (needs staff+student) → Routine/Branch/Material/Accounts/
 *   BranchLedger (need Branch) → Attendance/Notice (feature layers)
 *
 * There is no AccountsAutoBridge component anymore — payments are mirrored
 * into the accounts ledger server-side now (payment.service.ts), not by a
 * client component watching the payments array (Modules 23-24).
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <StudentSelfProvider>
            <AcademicProvider>
              <StaffProvider>
                <StudentProvider>
                  <PaymentProvider>
                    <BatchProvider>
                      <RoutineProvider>
                        <BranchProvider>
                          <MaterialProvider>
                            <AccountsProvider>
                              <BranchLedgerProvider>
                                <AttendanceProvider>
                                  <NoticeProvider>
                                    <Toaster />
                                    <Sonner />
                                    {children}
                                  </NoticeProvider>
                                </AttendanceProvider>
                              </BranchLedgerProvider>
                            </AccountsProvider>
                          </MaterialProvider>
                        </BranchProvider>
                      </RoutineProvider>
                    </BatchProvider>
                  </PaymentProvider>
                </StudentProvider>
              </StaffProvider>
            </AcademicProvider>
          </StudentSelfProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}