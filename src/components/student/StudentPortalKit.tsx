import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/dashboard/DashboardKit";
import { api } from "@/lib/apiClient";
import { useStudentSelf } from "@/pages/student/useStudentSelf";
import type { StudentPerformanceProfile } from "@/types/analytics";

/**
 * Shared Student Portal shell: the Student-only guard, the page header
 * (icon + title + description + actions) and consistent loading / error
 * states, so every /student/* page looks and behaves the same.
 */
export function StudentPageHeader({ icon: Icon, title, description, actions }: { icon: LucideIcon; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StudentPage({ icon, title, description, actions, children }: { icon: LucideIcon; title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  const { user, student, loading, refresh } = useStudentSelf();
  if (!user || user.role !== "Student") return <Navigate to="/studentLogin" replace />;
  return (
    <DashboardLayout>
      <div className="space-y-5">
        <StudentPageHeader icon={icon} title={title} description={description} actions={student ? actions : undefined} />
        {student ? children : loading ? (
          <div className="space-y-4" aria-busy="true" aria-label="লোড হচ্ছে"><Skeleton className="h-28" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>
        ) : (
          <Card><ErrorState message="আপনার তথ্য লোড করা যায়নি — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন" onRetry={() => { void refresh(); }} /></Card>
        )}
      </div>
    </DashboardLayout>
  );
}

/** The signed-in student's own performance (GET /analytics/performance/me — identity from the session; no at-risk labels). */
export function useMyPerformance() {
  const { user } = useStudentSelf();
  return useQuery({
    queryKey: ["analytics", "me", user?.studentId],
    queryFn: () => api.get<StudentPerformanceProfile>("/analytics/performance/me"),
    enabled: user?.role === "Student",
    staleTime: 60_000,
    retry: 1,
  });
}

/** Labels for the backend's profileCompletion.missingFields (student.service.ts COMPLETION_FIELDS + guardianName). */
export const COMPLETION_LABELS: Record<string, string> = {
  photoUrl: "ছবি",
  presentAddress: "বর্তমান ঠিকানা",
  permanentAddress: "স্থায়ী ঠিকানা",
  hscInstitution: "HSC প্রতিষ্ঠান",
  sscInstitution: "SSC প্রতিষ্ঠান",
  guardianName: "অভিভাবকের নাম",
};

export function MiniStat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "success" | "destructive" | "warning" | "primary" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : tone === "primary" ? "text-primary" : "";
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
