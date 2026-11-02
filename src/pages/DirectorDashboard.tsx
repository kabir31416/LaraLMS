import { useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import { Users, Layers, ClipboardCheck, AlertTriangle, CalendarClock, ClipboardList, FileSpreadsheet, ListChecks, CalendarDays, Clock, MapPin, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { api } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, ListSkeleton, Panel, PanelLink, RankedBars, SectionHeader } from "@/components/dashboard/DashboardKit";

interface DirectorDashboardSummary {
  totalBatches: number;
  totalStudents: number;
  todayAttendancePct: number;
  overallAttendancePct: number;
  lowAttendance: { studentId: string; pct: number; name?: string; registrationId?: string }[];
  myExams: { id: string; batchId: string; title: string; fullMarks: number; date: string }[];
  upcomingExams?: { id: string; batchId: string; title: string; fullMarks: number; date: string }[];
  batchAttendance30d?: { batchId: string; pct: number; entries: number }[];
  batches: { id: string; name: string; courseId?: string; courseName?: string; batchTime: string; days: string[]; roomNumber?: string; studentCount: number }[];
}

/**
 * Batch Director home — everything is scoped server-side to the batches this
 * director is assigned to (/dashboard/director); nothing institution-wide
 * or financial is shown here.
 */
const DirectorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { batches } = useBatches();
  const isDirector = user?.role === "Batch Director";
  const q = useQuery({
    queryKey: ["dashboard", "director", user?.staffId],
    queryFn: () => api.get<DirectorDashboardSummary>("/dashboard/director"),
    enabled: isDirector,
    staleTime: 30_000, refetchOnMount: "always",
  });
  const batchName = useMemo(() => new Map((q.data?.batches ?? []).map((b) => [b.id, b.name])), [q.data]);
  const fallbackName = (id: string) => batchName.get(id) ?? batches.find((b) => b.id === id)?.name ?? "—";

  if (!user || !isDirector) return <Navigate to="/staffLogin" replace />;
  const d = q.data;
  const loading = q.isLoading;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden />{format(new Date(), "EEEE, d MMMM yyyy", { locale: bn })}</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">স্বাগতম, {user.name}</h1>
            <p className="text-sm text-muted-foreground">আপনার নিয়োগকৃত ব্যাচ ও শিক্ষার্থীদের সারসংক্ষেপ</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/director/results")}><ClipboardList />রেজাল্ট ও উপস্থিতি এন্ট্রি</Button>
            <Button variant="outline" onClick={() => navigate("/director/result-management")}><FileSpreadsheet />ফলাফল ব্যবস্থাপনা</Button>
            <Button variant="outline" size="icon" onClick={() => void q.refetch()} aria-label="রিফ্রেশ"><RefreshCw className={cn(q.isFetching && "animate-spin")} /></Button>
          </div>
        </header>

        {q.isError && <ErrorState message="ড্যাশবোর্ড লোড করা যায়নি" onRetry={() => void q.refetch()} />}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="আজকের উপস্থিতি" value={`${d?.todayAttendancePct ?? 0}%`} icon={ClipboardCheck} variant="success" loading={loading} description="আমার সব ব্যাচ মিলিয়ে" />
          <StatCard title="সামগ্রিক উপস্থিতি" value={`${d?.overallAttendancePct ?? 0}%`} icon={ClipboardCheck} variant="primary" loading={loading} />
          <StatCard title="মোট শিক্ষার্থী" value={String(d?.totalStudents ?? 0)} icon={Users} variant="info" loading={loading} onClick={() => navigate("/director/students")} />
          <StatCard title="কম উপস্থিতি (<৬০%)" value={String(d?.lowAttendance.length ?? 0)} icon={AlertTriangle} variant="warning" loading={loading} description={`${d?.totalBatches ?? 0}টি ব্যাচ`} />
        </div>

        <section>
          <SectionHeader title="আমার ব্যাচসমূহ" icon={Layers} action={<PanelLink to="/director/students">শিক্ষার্থী তালিকা</PanelLink>} />
          {loading ? <ListSkeleton rows={3} /> : (d?.batches ?? []).length === 0 ? (
            <div className="rounded-lg border bg-card"><EmptyState icon={Layers} title="কোনো ব্যাচ নিয়োগ করা হয়নি" description="অ্যাডমিন ব্যাচে আপনাকে ডিরেক্টর হিসেবে যুক্ত করলে এখানে দেখা যাবে।" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {d!.batches.map((b) => {
                const att = d!.batchAttendance30d?.find((x) => x.batchId === b.id);
                return (
                  <div key={b.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{b.courseName || "—"}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0"><Users className="h-3 w-3" />{b.studentCount}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden />{b.batchTime || "—"}</span>
                      {b.roomNumber && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />রুম {b.roomNumber}</span>}
                      <span>{b.days.join(", ") || "—"}</span>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">উপস্থিতি (৩০ দিন)</span><b className={cn("tabular-nums", att && att.pct < 60 && "text-destructive")}>{att ? `${att.pct}%` : "—"}</b></div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full", att && att.pct < 60 ? "bg-destructive" : "bg-primary")} style={{ width: `${att?.pct ?? 0}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel title="আসন্ন এক্সাম" bodyClassName="px-0 sm:px-0">
            {loading ? <div className="px-5"><ListSkeleton rows={3} /></div> : (d?.upcomingExams ?? []).length === 0 ? <EmptyState compact icon={CalendarClock} title="কোনো আসন্ন এক্সাম নেই" /> : (
              <ul className="divide-y">{d!.upcomingExams!.map((e) => <ExamRow key={e.id} title={e.title} date={e.date} sub={`${fallbackName(e.batchId)} • পূর্ণমান ${e.fullMarks}`} />)}</ul>
            )}
          </Panel>
          <Panel title="সাম্প্রতিক এক্সাম" action={<PanelLink to="/director/results">ফলাফল এন্ট্রি</PanelLink>} bodyClassName="px-0 sm:px-0">
            {loading ? <div className="px-5"><ListSkeleton rows={3} /></div> : (d?.myExams ?? []).length === 0 ? <EmptyState compact icon={ListChecks} title="কোনো এক্সাম নেই" /> : (
              <ul className="divide-y">{d!.myExams.map((e) => <ExamRow key={e.id} title={e.title} date={e.date} sub={`${fallbackName(e.batchId)} • পূর্ণমান ${e.fullMarks}`} />)}</ul>
            )}
          </Panel>
          <Panel title="কম উপস্থিতি" description="৬০% এর নিচে — সবচেয়ে কম আগে">
            {loading ? <ListSkeleton rows={4} /> : (
              <RankedBars rows={(d?.lowAttendance ?? []).slice(0, 8).map((x) => ({ key: x.studentId, label: x.name || "—", sub: x.registrationId, value: x.pct }))} max={100} format={(v) => `${v}%`} tone="destructive" emptyText="কেউ নেই — দারুণ!" />
            )}
          </Panel>
        </div>
      </div>
    </DashboardLayout>
  );
};

function ExamRow({ title, date, sub }: { title: string; date: string; sub: string }) {
  return (
    <li className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
      <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border bg-muted/40 leading-none">
        <span className="text-sm font-bold tabular-nums">{date.slice(8, 10)}</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">{date.slice(5, 7)}/{date.slice(2, 4)}</span>
      </span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title}</span><span className="block truncate text-xs text-muted-foreground">{sub}</span></span>
    </li>
  );
}

export default DirectorDashboard;
