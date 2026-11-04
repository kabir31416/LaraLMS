import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  Activity, AlertTriangle, BarChart3, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Download, Eye, Filter, GraduationCap, Info,
  Printer, RefreshCw, Search, TrendingDown, TrendingUp, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChartTooltip, EmptyState, ErrorState, ListSkeleton, Panel, RankedBars } from "@/components/dashboard/DashboardKit";
import { ExamTrendChart, AttendanceTrendChart, StatusBadge, StudentPerformanceSheet, TrendChip, pctText } from "@/components/analytics/PerformanceKit";
import { axisProps } from "@/lib/dashboardFormat";
import { api } from "@/lib/apiClient";
import { exportExcel, printReport } from "@/lib/exporters";
import { ApiClientError } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, TREND_LABELS, type PerformanceOptions, type PerformanceResponse, type PerformanceRow } from "@/types/analytics";

/**
 * Student Performance Analytics (Admin: /analytics, Batch Director:
 * /director/analytics). Everything is computed server-side from existing
 * results/attendance; the backend limits a Batch Director to their own
 * batches. Read-only — no action here changes any academic record.
 */

const FILTER_KEYS = ["sessionId", "courseId", "batchId", "examId", "subjectId", "dateFrom", "dateTo", "attendanceMin", "attendanceMax", "status", "q"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
const PAGE_SIZE = 20;
const ALL = "__all";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "at_risk", label: "ঝুঁকিতে (মনোযোগ প্রয়োজন)" },
  { value: "excellent", label: STATUS_LABELS.excellent },
  { value: "good", label: STATUS_LABELS.good },
  { value: "average", label: STATUS_LABELS.average },
  { value: "needs_improvement", label: STATUS_LABELS.needs_improvement },
  { value: "insufficient", label: STATUS_LABELS.insufficient },
  { value: "improving", label: "ট্রেন্ড: উন্নতি হচ্ছে" },
  { value: "declining", label: "ট্রেন্ড: অবনতি হচ্ছে" },
  { value: "low_attendance", label: "কম উপস্থিতি" },
];

const SORT_OPTIONS = [
  { value: "risk", label: "ঝুঁকি আগে" },
  { value: "percentage_desc", label: "নম্বর (বেশি → কম)" },
  { value: "percentage_asc", label: "নম্বর (কম → বেশি)" },
  { value: "attendance_asc", label: "উপস্থিতি (কম → বেশি)" },
  { value: "attendance_desc", label: "উপস্থিতি (বেশি → কম)" },
  { value: "trend", label: "সবচেয়ে বেশি অবনতি" },
  { value: "name", label: "নাম" },
];

function qs(params: Record<string, string | number | undefined>) {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") s.set(k, String(v)); });
  return s.toString();
}

function FilterSelect({ label, value, onChange, options, placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)} disabled={disabled}>
        <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{placeholder}</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function PerformanceAnalytics() {
  const [params, setParams] = useSearchParams();
  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ""])) as Record<FilterKey, string>;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const sort = params.get("sort") || "risk";
  const [qInput, setQInput] = useState(f.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [fresh, setFresh] = useState(0);
  const [exporting, setExporting] = useState<"" | "excel" | "print" | "risk">("");

  const set = (patch: Partial<Record<FilterKey | "page" | "sort", string>>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  // Debounced search box → URL.
  useEffect(() => { const t = setTimeout(() => { if (qInput !== f.q) set({ q: qInput.trim() }); }, 400); return () => clearTimeout(t); });

  const options = useQuery({
    queryKey: ["analytics", "options", f.courseId, f.batchId],
    queryFn: () => api.get<PerformanceOptions>(`/analytics/performance/options?${qs({ courseId: f.courseId, batchId: f.batchId })}`),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const opt = options.data;

  const filterQs = qs({ ...f });
  const data = useQuery({
    queryKey: ["analytics", "performance", filterQs, page, sort, fresh],
    queryFn: () => api.getWithMeta<PerformanceResponse>(`/analytics/performance?${qs({ ...f, page, limit: PAGE_SIZE, sort, fresh: fresh ? "1" : undefined })}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const d = data.data?.data;
  const meta = data.data?.meta as { total: number; totalPages: number } | undefined;
  const isDirector = opt?.director ?? d?.scope.director ?? false;

  // Dependent options: session → courses → batches → exams.
  const courses = useMemo(() => (opt?.courses ?? []).filter((c) => !f.sessionId || c.sessionId === f.sessionId), [opt, f.sessionId]);
  const batches = useMemo(() => (opt?.batches ?? []).filter((b) => (!f.courseId || b.courseId === f.courseId) && (!f.sessionId || courses.some((c) => c.id === b.courseId))), [opt, f.courseId, f.sessionId, courses]);
  const exams = useMemo(() => (opt?.exams ?? []).filter((e) => (!f.batchId || e.batchId === f.batchId) && (!f.subjectId || e.subjectId === f.subjectId)), [opt, f.batchId, f.subjectId]);
  const activeCount = FILTER_KEYS.filter((k) => f[k]).length;

  const fetchAll = async (extra: Record<string, string> = {}) =>
    (await api.get<PerformanceResponse>(`/analytics/performance?${qs({ ...f, ...extra, export: "1", sort })}`)).items;
  const rowsFor = (items: PerformanceRow[]) => items.map((r) => [
    r.name, r.registrationId, r.rollNumber ?? "", r.courseName ?? "", r.batchName ?? "",
    r.percentage ?? "", r.grade ?? "", r.examsSat, r.examsAbsent, r.attendancePct ?? "", TREND_LABELS[r.trend], STATUS_LABELS[r.status],
    r.riskReasons.map((x) => x.message).join("; "),
  ]);
  const HEADERS = ["নাম", "রেজিস্ট্রেশন", "রোল", "কোর্স", "ব্যাচ", "গড় %", "গ্রেড", "পরীক্ষা", "অনুপস্থিত", "উপস্থিতি %", "ট্রেন্ড", "অবস্থা", "কারণ"];
  const doExport = async (kind: "excel" | "print" | "risk") => {
    setExporting(kind);
    try {
      const items = await fetchAll(kind === "risk" ? { status: "at_risk" } : {});
      if (!items.length) { toast.info("রপ্তানির মতো কোনো শিক্ষার্থী নেই"); return; }
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === "excel") exportExcel({ filename: `performance-${stamp}`, title: "Student Performance", headers: HEADERS, rows: rowsFor(items) });
      else printReport(kind === "risk" ? `মনোযোগ প্রয়োজন এমন শিক্ষার্থী — ${stamp}` : `শিক্ষার্থী পারফরম্যান্স — ${stamp}`, HEADERS, rowsFor(items));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "রপ্তানি করা যায়নি");
    } finally {
      setExporting("");
    }
  };

  const s = d?.summary;
  const noData = !!s && s.totalStudents === 0;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">পারফরম্যান্স অ্যানালিটিক্স</h1>
            <p className="text-sm text-muted-foreground">
              {isDirector ? "আপনার ব্যাচের শিক্ষার্থীদের" : "শিক্ষার্থীদের"} ফলাফল ও উপস্থিতির বিশ্লেষণ — ফলাফল ও উপস্থিতির আসল তথ্য থেকে গণনা
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {d && <span className="text-xs text-muted-foreground">হালনাগাদ {new Date(d.generatedAt).toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" })}</span>}
            <Button variant="outline" size="sm" onClick={() => setFresh(Date.now())} disabled={data.isFetching}><RefreshCw className={cn("h-4 w-4", data.isFetching && "animate-spin")} />রিফ্রেশ</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm" disabled={!!exporting || noData}><Download className="h-4 w-4" />{exporting ? "প্রস্তুত হচ্ছে..." : "রপ্তানি"}</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => doExport("excel")}><Download className="mr-2 h-4 w-4" />ফিল্টার করা তালিকা (Excel)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => doExport("print")}><Printer className="mr-2 h-4 w-4" />ফিল্টার করা তালিকা প্রিন্ট</DropdownMenuItem>
                <DropdownMenuItem onClick={() => doExport("risk")}><AlertTriangle className="mr-2 h-4 w-4" />ঝুঁকিতে থাকা তালিকা প্রিন্ট</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Filters */}
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="রেজিস্ট্রেশন নম্বর, রোল বা নাম" className="pl-9" aria-label="শিক্ষার্থী খুঁজুন" />
            </div>
            <div className="flex gap-2">
              <Select value={f.status || ALL} onValueChange={(v) => set({ status: v === ALL ? "" : v })}>
                <SelectTrigger className="w-full sm:w-56" aria-label="পারফরম্যান্স অবস্থা"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL}>সব অবস্থা</SelectItem>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen} className="shrink-0">
                <Filter className="h-4 w-4" />ফিল্টার{activeCount ? <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{activeCount}</span> : null}
              </Button>
            </div>
          </div>
          {filtersOpen && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect label="সেশন" value={f.sessionId} placeholder="সব সেশন" onChange={(v) => set({ sessionId: v, courseId: "", batchId: "", examId: "" })} options={(opt?.sessions ?? []).map((x) => ({ value: x.id, label: x.name }))} />
              <FilterSelect label="কোর্স" value={f.courseId} placeholder="সব কোর্স" onChange={(v) => set({ courseId: v, batchId: "", examId: "" })} options={courses.map((x) => ({ value: x.id, label: x.name }))} />
              <FilterSelect label="ব্যাচ" value={f.batchId} placeholder="সব ব্যাচ" onChange={(v) => set({ batchId: v, examId: "" })} options={batches.map((x) => ({ value: x.id, label: x.name }))} />
              <FilterSelect label="বিষয়" value={f.subjectId} placeholder="সব বিষয়" onChange={(v) => set({ subjectId: v, examId: "" })} options={(opt?.subjects ?? []).map((x) => ({ value: x.id, label: x.name }))} />
              <FilterSelect
                label="পরীক্ষা"
                value={f.examId}
                placeholder={f.courseId || f.batchId ? "সব পরীক্ষা" : "আগে কোর্স/ব্যাচ বাছুন"}
                disabled={!f.courseId && !f.batchId}
                onChange={(v) => set({ examId: v })}
                options={exams.map((x) => ({ value: x.id, label: `${x.title} · ${x.date}` }))}
              />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">তারিখ থেকে / পর্যন্ত</Label>
                <div className="flex gap-2">
                  <Input type="date" className="h-9" value={f.dateFrom} max={f.dateTo || undefined} onChange={(e) => set({ dateFrom: e.target.value })} aria-label="তারিখ থেকে" />
                  <Input type="date" className="h-9" value={f.dateTo} min={f.dateFrom || undefined} onChange={(e) => set({ dateTo: e.target.value })} aria-label="তারিখ পর্যন্ত" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">উপস্থিতি % (সর্বনিম্ন – সর্বোচ্চ)</Label>
                <div className="flex gap-2">
                  <Input type="number" min={0} max={100} className="h-9" placeholder="0" value={f.attendanceMin} onChange={(e) => set({ attendanceMin: e.target.value })} aria-label="সর্বনিম্ন উপস্থিতি" />
                  <Input type="number" min={0} max={100} className="h-9" placeholder="100" value={f.attendanceMax} onChange={(e) => set({ attendanceMax: e.target.value })} aria-label="সর্বোচ্চ উপস্থিতি" />
                </div>
              </div>
              <div className="flex items-end">
                <Button variant="ghost" className="w-full" disabled={!activeCount} onClick={() => { setQInput(""); setParams(new URLSearchParams(), { replace: true }); }}><X className="h-4 w-4" />সব ফিল্টার মুছুন</Button>
              </div>
            </div>
          )}
        </Card>

        {data.isError && !d ? (
          <Card><ErrorState message={data.error instanceof ApiClientError ? data.error.message : "অ্যানালিটিক্স লোড করা যায়নি"} onRetry={() => data.refetch()} /></Card>
        ) : !d ? (
          <div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <StatCard key={i} title="" value="" icon={Users} variant="primary" loading />)}</div><Card className="p-4"><ListSkeleton rows={6} /></Card></div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatCard title="সক্রিয় শিক্ষার্থী" value={String(s!.totalStudents)} icon={Users} variant="primary" description={`${s!.withResults} জনের ফলাফল আছে`} />
              <StatCard title="গড় নম্বর" value={pctText(s!.avgPercentage)} icon={GraduationCap} variant="info" description={s!.avgPercentage === null ? "এই ফিল্টারে কোনো ফলাফল নেই" : `${s!.exams}টি পরীক্ষা থেকে`} />
              <StatCard title="গড় উপস্থিতি" value={s!.avgAttendance === null ? "—" : `${s!.avgAttendance}%`} icon={ClipboardCheck} variant="info" description={s!.avgAttendance === null ? "উপস্থিতির তথ্য নেই" : `${s!.withAttendance} জনের তথ্য`} />
              <StatCard title="ঝুঁকিতে" value={String(s!.atRisk)} icon={AlertTriangle} variant="danger" description="ব্যাখ্যাসহ — তালিকায় দেখুন" onClick={() => set({ status: "at_risk" })} />
              <StatCard title="উন্নতি হচ্ছে" value={String(s!.improving)} icon={TrendingUp} variant="success" onClick={() => set({ status: "improving" })} />
              <StatCard title="অবনতি হচ্ছে" value={String(s!.declining)} icon={TrendingDown} variant="warning" onClick={() => set({ status: "declining" })} />
              <StatCard title="কম উপস্থিতি" value={String(s!.lowAttendance)} icon={Activity} variant="warning" description={`${d.rules.lowAttendancePct}% এর নিচে`} onClick={() => set({ status: "low_attendance" })} />
              <StatCard title="পর্যাপ্ত তথ্য নেই" value={String(d.charts.bands.insufficient)} icon={Info} variant="info" description={`${d.rules.minExams}টির কম পরীক্ষা`} onClick={() => set({ status: "insufficient" })} />
            </div>

            {noData ? (
              <Card><EmptyState icon={BarChart3} title="এই ফিল্টারে কোনো শিক্ষার্থী নেই" description="ফিল্টার বদলে দেখুন। শুধু সক্রিয় ও ব্যাচে থাকা শিক্ষার্থী গণনা করা হয়।" /></Card>
            ) : (
              <>
                {/* Charts */}
                <div className="grid gap-4 xl:grid-cols-2">
                  <Panel title="পরীক্ষাভিত্তিক গড় নম্বর" description="প্রতিটি পরীক্ষায় অংশ নেওয়া শিক্ষার্থীদের গড় (সর্বশেষ ২০টি)" icon={TrendingUp}>
                    <ExamTrendChart passing={d.passingPercentage} points={d.charts.examTrend.map((e) => ({ key: e.examId, date: e.date, label: `${e.title}${e.batchName ? ` · ${e.batchName}` : ""}`, percentage: e.percentage }))} />
                  </Panel>
                  <Panel title="মাসভিত্তিক উপস্থিতি" description={`কম উপস্থিতির সীমা ${d.rules.lowAttendancePct}%`} icon={ClipboardCheck}>
                    <AttendanceTrendChart months={d.charts.attendanceMonthly} threshold={d.rules.lowAttendancePct} />
                  </Panel>
                  <Panel title="বিষয়ভিত্তিক তুলনা" description="বিষয় অনুযায়ী গড় নম্বর" icon={BarChart3}>
                    <RankedBars rows={d.charts.subjects.map((x) => ({ key: x.subjectId, label: x.name, value: x.percentage, sub: `${x.results}টি ফলাফল` }))} max={100} format={(v) => pctText(v)} emptyText="কোনো বিষয়ের ফলাফল নেই" onRowClick={(id) => set({ subjectId: id })} />
                  </Panel>
                  <Panel title={isDirector ? "আমার ব্যাচ তুলনা" : "ব্যাচ তুলনা"} description="গড় নম্বর — ক্লিক করলে সেই ব্যাচ ফিল্টার হবে" icon={Users}>
                    {d.charts.batches.length < 2 ? (
                      <RankedBars rows={d.charts.batches.filter((b) => b.percentage !== null).map((b) => ({ key: b.batchId, label: b.name, value: b.percentage!, sub: `${b.students} জন · উপস্থিতি ${b.attendancePct ?? "—"}%` }))} max={100} format={(v) => pctText(v)} emptyText="ব্যাচ তুলনার মতো তথ্য নেই" />
                    ) : (
                      <BatchCompareChart rows={d.charts.batches} onPick={(id) => set({ batchId: id })} />
                    )}
                  </Panel>
                </div>

                <Panel title="উন্নতি বনাম অবনতি" description={`শেষ ${d.rules.trendWindow}টি পরীক্ষার গড় বনাম তার আগের ${d.rules.trendWindow}টি (±${d.rules.trendDelta} পয়েন্ট)`} icon={Activity}>
                  <TrendSplit split={d.charts.trendSplit} />
                </Panel>

                {/* Student list */}
                <Card className="overflow-hidden">
                  <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                    <div>
                      <h2 className="font-semibold">শিক্ষার্থী তালিকা</h2>
                      <p className="text-xs text-muted-foreground">{meta?.total ?? 0} জন · সারিতে ক্লিক করলে বিস্তারিত বিশ্লেষণ</p>
                    </div>
                    <Select value={sort} onValueChange={(v) => set({ sort: v })}>
                      <SelectTrigger className="h-9 w-full sm:w-56" aria-label="সাজান"><SelectValue /></SelectTrigger>
                      <SelectContent>{SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {d.items.length === 0 ? (
                    <EmptyState icon={Users} title="এই পৃষ্ঠায় কোনো শিক্ষার্থী নেই" />
                  ) : (
                    <>
                      <div className="hidden overflow-x-auto md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>শিক্ষার্থী</TableHead>
                              <TableHead className="hidden lg:table-cell">ব্যাচ</TableHead>
                              <TableHead className="text-right">গড় নম্বর</TableHead>
                              <TableHead className="text-right">উপস্থিতি</TableHead>
                              <TableHead>ট্রেন্ড</TableHead>
                              <TableHead>অবস্থা ও কারণ</TableHead>
                              <TableHead className="w-12"><span className="sr-only">দেখুন</span></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {d.items.map((r) => (
                              <TableRow key={r.studentId} className="cursor-pointer" onClick={() => setViewing(r.studentId)}>
                                <TableCell><StudentCell r={r} /></TableCell>
                                <TableCell className="hidden text-sm lg:table-cell">{r.batchName ?? "—"}<span className="block text-xs text-muted-foreground">{r.courseName ?? ""}</span></TableCell>
                                <TableCell className="text-right tabular-nums"><b>{pctText(r.percentage)}</b>{r.grade && <span className="block text-xs text-muted-foreground">{r.grade} · {r.examsSat}টি</span>}</TableCell>
                                <TableCell className={cn("text-right tabular-nums", r.attendanceBand === "low" && "font-semibold text-destructive")}>{r.attendancePct === null ? "—" : `${r.attendancePct}%`}</TableCell>
                                <TableCell><TrendChip trend={r.trend} change={r.trendChange} compact /></TableCell>
                                <TableCell className="max-w-[300px]">
                                  <StatusBadge status={r.status} />
                                  {r.riskReasons.length > 0 && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.riskReasons.map((x) => x.message).join(" · ")}</p>}
                                </TableCell>
                                <TableCell><Button variant="ghost" size="icon" aria-label={`${r.name} — বিস্তারিত`} onClick={(e) => { e.stopPropagation(); setViewing(r.studentId); }}><Eye className="h-4 w-4" /></Button></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <ul className="divide-y md:hidden">
                        {d.items.map((r) => (
                          <li key={r.studentId}>
                            <button type="button" className="w-full px-3 py-3 text-left hover:bg-muted/40" onClick={() => setViewing(r.studentId)}>
                              <div className="flex items-start justify-between gap-2"><StudentCell r={r} /><StatusBadge status={r.status} className="shrink-0" /></div>
                              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                <span><span className="block text-muted-foreground">গড়</span><b className="tabular-nums">{pctText(r.percentage)}</b></span>
                                <span><span className="block text-muted-foreground">উপস্থিতি</span><b className={cn("tabular-nums", r.attendanceBand === "low" && "text-destructive")}>{r.attendancePct === null ? "—" : `${r.attendancePct}%`}</b></span>
                                <span><span className="block text-muted-foreground">ট্রেন্ড</span><TrendChip trend={r.trend} change={r.trendChange} compact /></span>
                              </div>
                              {r.riskReasons.length > 0 && <p className="mt-1.5 text-xs text-destructive">{r.riskReasons.map((x) => x.message).join(" · ")}</p>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {meta && meta.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t px-3 py-2.5 text-sm sm:px-4">
                      <span className="text-muted-foreground">পৃষ্ঠা {page} / {meta.totalPages}</span>
                      <span className="flex gap-1">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}><ChevronLeft className="h-4 w-4" />আগের</Button>
                        <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => set({ page: String(page + 1) })}>পরের<ChevronRight className="h-4 w-4" /></Button>
                      </span>
                    </div>
                  )}
                </Card>
              </>
            )}

            <RulesCard d={d} />
          </>
        )}
      </div>
      <StudentPerformanceSheet studentId={viewing} onClose={() => setViewing(null)} />
    </DashboardLayout>
  );
}

function StudentCell({ r }: { r: PerformanceRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-9 w-9 shrink-0">
        {r.photoUrl && <AvatarImage src={r.photoUrl} alt="" className="object-cover" />}
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{r.name.trim().charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0"><span className="block truncate font-medium">{r.name}</span><span className="block truncate text-xs text-muted-foreground">{r.registrationId}{r.batchName ? ` · ${r.batchName}` : ""}</span></span>
    </div>
  );
}

function BatchCompareChart({ rows, onPick }: { rows: PerformanceResponse["charts"]["batches"]; onPick: (id: string) => void }) {
  const data = rows.filter((b) => b.percentage !== null).slice(0, 12);
  return (
    <div style={{ height: Math.max(160, data.length * 34) }} role="img" aria-label={`ব্যাচভিত্তিক গড় নম্বর, ${data.length}টি ব্যাচ`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" domain={[0, 100]} {...axisProps} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" {...axisProps} width={96} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            content={({ active, payload }) => {
              const b = payload?.[0]?.payload as PerformanceResponse["charts"]["batches"][number] | undefined;
              return <ChartTooltip active={active} payload={b ? [{ value: b.percentage!, name: "গড় নম্বর", color: "hsl(var(--chart-1))" }] : []} label={b ? `${b.name} · ${b.students} জন · উপস্থিতি ${b.attendancePct ?? "—"}% · ঝুঁকিতে ${b.atRisk}` : ""} format={(v) => pctText(v)} />;
            }}
          />
          <Bar dataKey="percentage" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} barSize={16} cursor="pointer" onClick={(b: { batchId?: string }) => b.batchId && onPick(b.batchId)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendSplit({ split }: { split: PerformanceResponse["charts"]["trendSplit"] }) {
  const parts = [
    { key: "improving", label: "উন্নতি হচ্ছে", value: split.improving, cls: "bg-success", Icon: TrendingUp },
    { key: "stable", label: "স্থিতিশীল", value: split.stable, cls: "bg-primary/60", Icon: Activity },
    { key: "declining", label: "অবনতি হচ্ছে", value: split.declining, cls: "bg-destructive", Icon: TrendingDown },
    { key: "insufficient", label: "পর্যাপ্ত তথ্য নেই", value: split.insufficient, cls: "bg-muted-foreground/30", Icon: Info },
  ];
  const total = parts.reduce((a, p) => a + p.value, 0);
  const measured = split.improving + split.stable + split.declining;
  if (!measured) return <EmptyState compact icon={Activity} title="ট্রেন্ড নির্ণয়ের মতো তথ্য নেই" description="ট্রেন্ডের জন্য প্রত্যেক শিক্ষার্থীর কমপক্ষে ৪টি পরীক্ষার ফলাফল দরকার।" />;
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {parts.filter((p) => p.value > 0).map((p) => <div key={p.key} className={cn("h-full", p.cls)} style={{ width: `${(p.value / total) * 100}%` }} />)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", p.cls)} aria-hidden />
            <p.Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="truncate">{p.label}</span>
            <b className="ml-auto tabular-nums">{p.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RulesCard({ d }: { d: PerformanceResponse }) {
  const r = d.rules;
  return (
    <Collapsible>
      <Card>
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 p-4 text-left">
          <span className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4 text-primary" aria-hidden />কীভাবে গণনা করা হয়</span>
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-4 border-t p-4 text-sm md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="font-medium">নম্বর</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>গড় নম্বর = মোট প্রাপ্ত নম্বর ÷ মোট পূর্ণমান (মার্কশিটের একই নিয়ম)। অনুপস্থিতি শূন্য ধরা হয় না।</li>
                <li>চমৎকার ≥ {r.excellentMin}%, ভালো ≥ {r.goodMin}%, মোটামুটি ≥ {r.averageMin}%, এর নিচে "উন্নতি প্রয়োজন"। {r.minExams}টির কম পরীক্ষা হলে "পর্যাপ্ত তথ্য নেই"।</li>
                <li>ট্রেন্ড: শেষ {r.trendWindow}টি পরীক্ষার গড় বনাম তার আগের {r.trendWindow}টি (কম পরীক্ষা থাকলে অর্ধেক-অর্ধেক, ন্যূনতম ২+২)। ±{r.trendDelta} পয়েন্ট বা বেশি হলে উন্নতি/অবনতি।</li>
                <li>গ্রেড ও পাস নম্বর ({d.passingPercentage}%) সেটিংসের ফলাফল নিয়ম থেকে।</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium">"ঝুঁকিতে" — যেকোনো একটি হলে (একটি কম নম্বরে কখনো নয়)</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>উপস্থিতি {r.lowAttendancePct}% এর কম (কমপক্ষে {r.minAttendanceEntries} দিনের তথ্য থাকলে)</li>
                <li>শেষ {r.riskLookback}টি পরীক্ষার {r.riskFailCount}টি বা বেশিতে পাস নম্বরের নিচে</li>
                <li>সাম্প্রতিক গড় আগের চেয়ে {r.riskDeclineDelta} পয়েন্ট বা বেশি কম</li>
                <li>শেষ {r.riskLookback}টি পরীক্ষার {r.riskAbsentCount}টি বা বেশিতে অনুপস্থিত (রেকর্ডকৃত অনুপস্থিতি)</li>
              </ul>
              <p className="pt-1 text-xs text-muted-foreground">এটি শুধু সিদ্ধান্তে সহায়তার জন্য — কোনো নম্বর, উপস্থিতি বা ব্যাচ স্বয়ংক্রিয়ভাবে বদলায় না। সীমাগুলো সেটিংস → ফলাফল থেকে পরিবর্তন করা যায়।</p>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
