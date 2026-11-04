import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, List } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, ListSkeleton, Panel, SplitMeter } from "@/components/dashboard/DashboardKit";
import { AttendanceTrendChart } from "@/components/analytics/PerformanceKit";
import { MiniStat, StudentPage, useMyPerformance } from "@/components/student/StudentPortalKit";
import { useAttendance } from "@/contexts/AttendanceContext";
import { useStudentSelf } from "./useStudentSelf";
import { BN_MONTHS, monthLabel } from "@/lib/dashboardFormat";
import { cn } from "@/lib/utils";
import type { AttendanceEntry } from "@/types/attendance";

/**
 * My Attendance. Totals and percentages come from the backend (same
 * present ÷ total formula as every attendance report); the calendar and
 * history are the student's own existing entries.
 */
const WEEK = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

export default function StudentAttendance() {
  const { student } = useStudentSelf();
  const { getByStudent } = useAttendance();
  const perf = useMyPerformance();
  const entries = useQuery({ queryKey: ["student", "attendance", student?.id], queryFn: () => getByStudent(student!.id), enabled: !!student, staleTime: 60_000 });

  const months = useMemo(() => [...new Set((entries.data ?? []).map((e) => e.date.slice(0, 7)))].sort().reverse(), [entries.data]);
  const [month, setMonth] = useState<string | null>(null);
  const current = month ?? months[0] ?? null;
  const byDate = useMemo(() => {
    const m = new Map<string, AttendanceEntry[]>();
    (entries.data ?? []).forEach((e) => m.set(e.date, [...(m.get(e.date) ?? []), e]));
    return m;
  }, [entries.data]);

  const a = perf.data?.attendance;
  const monthIdx = current ? months.indexOf(current) : -1;

  return (
    <StudentPage icon={ClipboardCheck} title="আমার উপস্থিতি" description="সামগ্রিক উপস্থিতি, মাসভিত্তিক হিসাব ও দিনভিত্তিক ইতিহাস">
      {perf.isLoading || entries.isLoading ? <Card className="p-4"><ListSkeleton rows={6} /></Card> : perf.isError || entries.isError || !a ? (
        <Card><ErrorState message="উপস্থিতি লোড করা যায়নি" onRetry={() => { void perf.refetch(); void entries.refetch(); }} /></Card>
      ) : a.total === 0 ? (
        <Card><EmptyState icon={CalendarDays} title="এখনো কোনো উপস্থিতির তথ্য নেই" description="ক্লাস বা পরীক্ষার উপস্থিতি নেওয়া হলে এখানে দেখা যাবে।" /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="সামগ্রিক উপস্থিতি" value={`${a.pct}%`} tone={a.pct !== null && a.pct >= 75 ? "success" : "warning"} sub={`${a.total} দিনের হিসাব`} />
            <MiniStat label="উপস্থিত" value={a.present} sub="দিন" tone="success" />
            <MiniStat label="অনুপস্থিত" value={a.absent} sub="দিন" tone={a.absent ? "destructive" : undefined} />
            <MiniStat label="এই মাসে" value={a.monthly.length ? `${a.monthly[a.monthly.length - 1].pct}%` : "—"} sub={a.monthly.length ? monthLabel(a.monthly[a.monthly.length - 1].month, true) : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Panel title="মাসভিত্তিক ট্রেন্ড" icon={CalendarDays}>
              <AttendanceTrendChart months={a.monthly} />
            </Panel>
            <Panel title="উপস্থিত বনাম অনুপস্থিত" icon={ClipboardCheck}>
              <SplitMeter a={{ label: "উপস্থিত", value: a.present, className: "bg-success" }} b={{ label: "অনুপস্থিত", value: a.absent, className: "bg-destructive" }} format={(v) => `${v} দিন`} />
              <ul className="mt-4 divide-y text-sm">
                {[...a.monthly].reverse().slice(0, 6).map((m) => (
                  <li key={m.month} className="flex items-center justify-between py-2">
                    <span>{monthLabel(m.month, true)}</span>
                    <span className="tabular-nums text-muted-foreground">{m.present}/{m.total} <Badge variant="outline" className={cn("ml-2", m.pct >= 75 ? "border-success/25 text-success" : "border-warning/30 text-warning")}>{m.pct}%</Badge></span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Card className="overflow-hidden">
            <Tabs defaultValue="calendar">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3 sm:p-4">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="আগের মাস" disabled={monthIdx < 0 || monthIdx >= months.length - 1} onClick={() => setMonth(months[monthIdx + 1])}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="min-w-[110px] text-center font-semibold">{current ? `${BN_MONTHS[Number(current.slice(5)) - 1]} ${current.slice(0, 4)}` : "—"}</span>
                  <Button variant="ghost" size="icon" aria-label="পরের মাস" disabled={monthIdx <= 0} onClick={() => setMonth(months[monthIdx - 1])}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <TabsList>
                  <TabsTrigger value="calendar"><CalendarDays className="mr-1 h-4 w-4" />ক্যালেন্ডার</TabsTrigger>
                  <TabsTrigger value="list"><List className="mr-1 h-4 w-4" />তালিকা</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="calendar" className="m-0 p-3 sm:p-4">
                {current && <MonthGrid month={current} byDate={byDate} />}
                <div className="mx-auto mt-3 flex max-w-2xl flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-success" aria-hidden />উপস্থিত</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-destructive" aria-hidden />অনুপস্থিত</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border bg-card" aria-hidden />তথ্য নেই</span>
                </div>
              </TabsContent>
              <TabsContent value="list" className="m-0">
                <ul className="divide-y">
                  {(entries.data ?? []).filter((e) => current && e.date.startsWith(current)).map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
                      <span className="tabular-nums">{e.date}<span className="ml-2 text-xs text-muted-foreground">{e.source === "Exam" ? "পরীক্ষা" : "ক্লাস"}</span></span>
                      <Badge variant="outline" className={e.status === "Present" ? "border-success/25 bg-success/10 text-success" : "border-destructive/25 bg-destructive/10 text-destructive"}>{e.status === "Present" ? "উপস্থিত" : "অনুপস্থিত"}</Badge>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </Card>
        </>
      )}
    </StudentPage>
  );
}

function MonthGrid({ month, byDate }: { month: string; byDate: Map<string, AttendanceEntry[]> }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div role="grid" className="mx-auto max-w-2xl" aria-label={`${BN_MONTHS[m - 1]} ${y} উপস্থিতি`}>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground" role="row">{WEEK.map((d) => <span key={d} role="columnheader">{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`b${i}`} />;
          const date = `${month}-${String(d).padStart(2, "0")}`;
          const list = byDate.get(date) ?? [];
          const absent = list.some((e) => e.status === "Absent");
          const present = list.length > 0 && !absent;
          const label = list.length ? (absent ? "অনুপস্থিত" : "উপস্থিত") : "তথ্য নেই";
          return (
            <span key={date} role="gridcell" title={`${date}: ${label}`} aria-label={`${d} তারিখ: ${label}`}
              className={cn("flex h-9 items-center justify-center rounded-md border text-xs tabular-nums sm:h-11 sm:text-sm",
                present && "border-success bg-success text-success-foreground", absent && "border-destructive bg-destructive text-destructive-foreground", !list.length && "bg-card text-muted-foreground")}>
              {d}
            </span>
          );
        })}
      </div>
    </div>
  );
}
