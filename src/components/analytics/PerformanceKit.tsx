import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, ClipboardCheck, FileText, Minus, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartTooltip, EmptyState, ErrorState, ListSkeleton, SplitMeter } from "@/components/dashboard/DashboardKit";
import { axisProps, dayLabel, monthLabel } from "@/lib/dashboardFormat";
import { api } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import {
  BAND_LABELS, STATUS_LABELS, TREND_LABELS,
  type PerformanceBand, type PerformanceStatus, type StudentPerformanceProfile, type TrendDirection,
} from "@/types/analytics";

export const pctText = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "—" : `${Number.isInteger(v) ? v : v.toFixed(digits)}%`;

const STATUS_TONE: Record<PerformanceStatus, string> = {
  excellent: "border-success/25 bg-success/10 text-success",
  good: "border-primary/25 bg-primary/10 text-primary",
  average: "border-border bg-secondary text-secondary-foreground",
  needs_improvement: "border-warning/30 bg-warning/10 text-warning",
  insufficient: "border-border bg-muted text-muted-foreground",
  at_risk: "border-destructive/25 bg-destructive/10 text-destructive",
};

export function StatusBadge({ status, className }: { status: PerformanceStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap", STATUS_TONE[status], className)}>
      {status === "at_risk" && <AlertTriangle className="h-3 w-3" aria-hidden />}
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function BandBadge({ band }: { band: PerformanceBand }) {
  return <Badge variant="outline" className={cn("whitespace-nowrap", STATUS_TONE[band])}>{BAND_LABELS[band]}</Badge>;
}

/** Trend with icon + words (never colour alone). */
export function TrendChip({ trend, change, compact }: { trend: TrendDirection; change: number | null; compact?: boolean }) {
  const Icon = trend === "improving" ? ArrowUpRight : trend === "declining" ? ArrowDownRight : trend === "stable" ? ArrowRight : Minus;
  const tone = trend === "improving" ? "text-success" : trend === "declining" ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium", tone)} title={TREND_LABELS[trend]}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {compact ? (change !== null ? `${change > 0 ? "+" : ""}${change}` : "—") : TREND_LABELS[trend]}
      {!compact && change !== null && <span className="tabular-nums">({change > 0 ? "+" : ""}{change})</span>}
    </span>
  );
}

/** Exam-wise percentage line (one series, chronological), with the pass mark as a reference line. */
export function ExamTrendChart({ points, passing, height = 220 }: { points: { key: string; date: string; label: string; percentage: number | null }[]; passing?: number; height?: number }) {
  const data = points.filter((p) => p.percentage !== null);
  if (data.length < 2) return <EmptyState compact icon={FileText} title="ট্রেন্ড দেখাতে কমপক্ষে ২টি পরীক্ষার ফলাফল দরকার" />;
  return (
    <div style={{ height }} role="img" aria-label={`পরীক্ষাভিত্তিক শতকরা নম্বর, ${data.length}টি পরীক্ষা`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="date" {...axisProps} tickFormatter={dayLabel} minTickGap={20} />
          <YAxis {...axisProps} width={40} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} />
          {passing !== undefined && <ReferenceLine y={passing} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: `পাস ${passing}%`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />}
          <Tooltip
            cursor={{ stroke: "hsl(var(--border))" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { label: string; date: string; percentage: number } | undefined;
              return <ChartTooltip active={active} payload={p ? [{ value: p.percentage, name: "নম্বর", color: "hsl(var(--chart-1))" }] : []} label={p ? `${p.label} · ${dayLabel(p.date)}` : ""} format={(v) => pctText(v)} />;
            }}
          />
          <Line type="linear" dataKey="percentage" name="নম্বর" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: "hsl(var(--card))", fill: "hsl(var(--chart-1))" }} activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Monthly attendance % (one series). */
export function AttendanceTrendChart({ months, threshold, height = 200 }: { months: { month: string; pct: number }[]; threshold?: number; height?: number }) {
  if (months.length < 2) return <EmptyState compact icon={ClipboardCheck} title="ট্রেন্ড দেখাতে কমপক্ষে ২ মাসের উপস্থিতি দরকার" />;
  return (
    <div style={{ height }} role="img" aria-label={`মাসভিত্তিক উপস্থিতি, ${months.length} মাস`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={months} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="month" {...axisProps} tickFormatter={(m) => monthLabel(m)} />
          <YAxis {...axisProps} width={40} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} />
          {threshold !== undefined && <ReferenceLine y={threshold} stroke="hsl(var(--warning))" strokeDasharray="4 4" strokeOpacity={0.7} />}
          <Tooltip cursor={{ stroke: "hsl(var(--border))" }} content={<ChartTooltip format={(v) => `${v}%`} labelFormat={(m) => monthLabel(m, true)} />} />
          <Line type="linear" dataKey="pct" name="উপস্থিতি" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: "hsl(var(--card))", fill: "hsl(var(--chart-1))" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Staff drill-down for one student — read-only; links to the existing Student Profile tabs. */
export function StudentPerformanceSheet({ studentId, onClose, profileBase = "/students" }: { studentId: string | null; onClose: () => void; profileBase?: string }) {
  const q = useQuery({
    queryKey: ["analytics", "student", studentId],
    queryFn: () => api.get<StudentPerformanceProfile>(`/analytics/performance/students/${studentId}`),
    enabled: !!studentId,
    staleTime: 60_000,
    retry: false,
  });
  const p = q.data;
  return (
    <Sheet open={!!studentId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {q.isLoading ? (
          <div className="pt-8"><ListSkeleton rows={8} /></div>
        ) : q.isError || !p ? (
          <div className="pt-8"><ErrorState message="শিক্ষার্থীর অ্যানালিটিক্স লোড করা যায়নি" onRetry={() => q.refetch()} /></div>
        ) : (
          <div className="space-y-5">
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  {p.student.photoUrl && <AvatarImage src={p.student.photoUrl} alt="" className="object-cover" />}
                  <AvatarFallback className="bg-primary/10 font-semibold text-primary">{p.student.name.trim().charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{p.student.name}</SheetTitle>
                  <SheetDescription className="text-xs">
                    রেজি. {p.student.registrationId}{p.student.rollNumber ? ` · রোল ${p.student.rollNumber}` : ""} · {p.student.course ?? "—"} · {p.student.batch ?? "—"}
                  </SheetDescription>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">{p.status && <StatusBadge status={p.status} />}<TrendChip trend={p.trend.direction} change={p.trend.change} /></div>
                </div>
              </div>
            </SheetHeader>

            {p.riskReasons && p.riskReasons.length > 0 && (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" aria-hidden />কেন মনোযোগ প্রয়োজন</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm">{p.riskReasons.map((r) => <li key={r.code}>{r.message}</li>)}</ul>
                <p className="mt-2 text-[11px] text-muted-foreground">এটি শুধু সিদ্ধান্তে সহায়তার জন্য — কোনো নম্বর, ব্যাচ বা রেকর্ড স্বয়ংক্রিয়ভাবে পরিবর্তন হয় না।</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="সামগ্রিক নম্বর" value={pctText(p.overall.percentage)} sub={p.overall.grade ? `গ্রেড ${p.overall.grade}` : undefined} />
              <Stat label="উপস্থিতি" value={p.attendance.pct === null ? "—" : `${p.attendance.pct}%`} sub={`${p.attendance.present}/${p.attendance.total} দিন`} />
              <Stat label="সর্বোচ্চ / সর্বনিম্ন" value={`${pctText(p.overall.highest, 0)} / ${pctText(p.overall.lowest, 0)}`} />
              <Stat label="পরীক্ষা" value={`${p.overall.examsSat}টি`} sub={p.overall.examsAbsent ? `${p.overall.examsAbsent}টিতে অনুপস্থিত` : undefined} />
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold">পরীক্ষাভিত্তিক ট্রেন্ড</h3>
              <ExamTrendChart passing={p.passingPercentage} points={[...p.exams].reverse().map((e) => ({ key: e.examId, date: e.date, label: e.title, percentage: e.percentage }))} />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">বিষয়ভিত্তিক</h3>
              {p.subjects.length === 0 ? <EmptyState compact title="কোনো ফলাফল নেই" /> : (
                <ul className="space-y-2">
                  {p.subjects.map((s) => (
                    <li key={s.subjectId}>
                      <div className="flex items-baseline justify-between gap-2 text-xs"><span className="truncate">{s.name} <span className="text-muted-foreground">· {s.exams}টি পরীক্ষা{s.absent ? `, ${s.absent}টিতে অনুপস্থিত` : ""}</span></span><b className="tabular-nums">{pctText(s.percentage)}{s.grade ? ` · ${s.grade}` : ""}</b></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, s.percentage ?? 0)}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">উপস্থিতি</h3>
              <SplitMeter a={{ label: "উপস্থিত", value: p.attendance.present, className: "bg-success" }} b={{ label: "অনুপস্থিত", value: p.attendance.absent, className: "bg-destructive" }} format={(v) => `${v} দিন`} />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">সাম্প্রতিক পরীক্ষা</h3>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>পরীক্ষা</TableHead><TableHead>বিষয়</TableHead><TableHead className="text-right">নম্বর</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {p.exams.slice(0, 8).map((e) => (
                      <TableRow key={e.examId}>
                        <TableCell className="max-w-[180px]"><span className="block truncate font-medium">{e.title}</span><span className="text-xs text-muted-foreground">{e.date}</span></TableCell>
                        <TableCell className="text-sm">{e.subject}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.marks === null ? <span className="text-destructive">অনুপস্থিত</span> : `${e.marks}/${e.fullMarks}`}</TableCell>
                        <TableCell className="text-right tabular-nums">{pctText(e.percentage)}</TableCell>
                      </TableRow>
                    ))}
                    {p.exams.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">কোনো পরীক্ষা নেই</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button asChild variant="outline"><Link to={`${profileBase}/${p.student.id}`}><UserRound className="h-4 w-4" />প্রোফাইল</Link></Button>
              <Button asChild variant="outline"><Link to={`${profileBase}/${p.student.id}?tab=results`}><FileText className="h-4 w-4" />ফলাফল বিস্তারিত</Link></Button>
              <Button asChild variant="outline"><Link to={`${profileBase}/${p.student.id}?tab=attendance`}><ClipboardCheck className="h-4 w-4" />উপস্থিতি বিস্তারিত</Link></Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
