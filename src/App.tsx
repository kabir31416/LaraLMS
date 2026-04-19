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
import NotFound from "./pages/NotFound.tsx";
import { BookProvider } from "@/contexts/BookContext";
import { AccountsProvider } from "@/contexts/AccountsContext";
import { AccountsAutoBridge } from "@/components/accounts/AccountsAutoBridge";
import { BranchLedgerProvider } from "@/contexts/BranchLedgerContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <StudentProvider>
        <RoutineProvider>
          <BookProvider>
            <AccountsProvider>
              <BranchLedgerProvider>
                <AccountsAutoBridge />
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/students" element={<Students />} />
                    <Route path="/students/:id" element={<StudentProfile />} />
                    <Route path="/admission" element={<Admission />} />
                    <Route path="/fees" element={<FeeManagement />} />
                    <Route path="/routine" element={<Routine />} />
                    <Route path="/books" element={<Books />} />
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </BranchLedgerProvider>
            </AccountsProvider>
          </BookProvider>
        </RoutineProvider>
      </StudentProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
