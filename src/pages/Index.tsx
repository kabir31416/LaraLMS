import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, startOfYear, subDays, subMonths, endOfMonth } from "date-fns";
import { bn } from "date-fns/locale";
import {
  Users, UserCheck, UserPlus, UserX, Wallet, CalendarDays, AlertCircle, BadgePercent, GraduationCap, Layers, ClipboardCheck,
  CalendarClock, RefreshCw, Receipt, FileSpreadsheet, ClipboardList, BedDouble, FilePlus2, Megaphone, HandCoins, Cake, Boxes,
  Activity, TrendingUp, Award, Coins, ArrowRight, Bell, Pin, ShieldCheck, Clock,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { hasPermission, useAuth } from "@/contexts/AuthContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { useNotices, filterNoticesFor } from "@/contexts/NoticeContext";
import { api } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import {
  ACCOUNTS_MANAGE, ATTENDANCE_MARK, EXAMS_MANAGE, MATERIALS_VIEW, MESS_BILLING_MANAGE, MESS_MEMBERS_MANAGE, MESS_VIEW, NOTICES_MANAGE,
  PAYMENTS_CREATE, STUDENTS_CREATE, STUDENTS_READ,
} from "@/lib/permissions";
import { MessOverview } from "@/components/dashboard/MessOverview";
import {
  ChartSkeleton, ChartTooltip, EmptyState, ErrorState, ListSkeleton, Panel, PanelLink, RankedBars, SectionHeader, SplitMeter,
} from "@/components/dashboard/DashboardKit";
import { axisProps, dayLabel, monthLabel, taka, takaShort } from "@/lib/dashboardFormat";

// -------------------- API shape (backend: dashboardOverview.service.ts) --------------------

interface Overview {
  range: { from: string; to: string; days: number; prevFrom: string; prevTo: string; today: string };
  header: { today: string; sessionName: string | null; institutionName: string | null };
  students: null | {
    total: number; active: number; inactive: number; newInRange: number; newPrevRange: number; pendingApplications: number;
    due: number; paid: number; discount: number; dueStudents: number;
    byCourse: { id: string | null; name: string; count: number }[];
    byBatch: { id: string; name: string; count: number }[];
    monthlyAdmissions: { month: string; count: number }[];
    recentAdmissions: { id: string; name: string; registrationId: string; course?: string; batchName?: string; admissionDate: string }[];
  };
  finance: null | {
    today: number; todayCount: number; thisMonth: number; lastMonthToDate: number; range: number; rangeCount: number; rangeDiscount: number; prevRange: number;
    daily: { date: string; total: number }[];
    monthly: { month: string; total: number }[];
    byCourse: { name: string; total: number }[];
    byMethod: { method: string; total: number; count: number }[];
    bySource: { source: string; total: number }[];
    dueVsPaid: { due: number; paid: number; totalFee: number };
    recentPayments: { id: string; receiptNo: string; date: string; amount: number; method: string; source: string; studentName?: string; studentRegId?: string }[];
  };
  attendance: null | {
    todayPresent: number; todayAbsent: number; todayPct: number | null; rangePct: number | null; rangeEntries: number; lowAttendanceStudents: number;
    trend: { date: string; pct: number | null; total: number }[];
    byBatch: { id: string; name: string; pct: number; entries: number }[];
  };
  academic: null | {
    activeCourses: number; totalBatches: number; upcomingCount: number;
    upcoming: { id: string; title: string; date: string; fullMarks: number; batchName?: string; subjectName?: string }[];
    recent: { id: string; title: string; date: string; fullMarks: number; batchName?: string; subjectName?: string; isPublished: boolean; resultCount: number }[];
  };
  activity: null | { id: string; action: string; module: string; timestamp: string; actor: string | null; detail: { name?: string; receiptNo?: string; amount?: number; ref?: string; category?: string; created?: number } }[];
}

// -------------------- Date range presets --------------------

type PresetKey = "today" | "7d" | "30d" | "month" | "lastMonth" | "90d" | "year" | "custom";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "আজ" },
  { key: "7d", label: "শেষ ৭ দিন" },
  { key: "30d", label: "শেষ ৩০ দিন" },
  { key: "month", label: "এই মাস" },
  { key: "lastMonth", label: "গত মাস" },
  { key: "90d", label: "শেষ ৯০ দিন" },
  { key: "year", label: "এই বছর" },
  { key: "custom", label: "কাস্টম" },
];
const iso = (d: Date) => format(d, "yyyy-MM-dd");
function presetRange(key: PresetKey, custom: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  switch (key) {
    case "today": return { from: iso(now), to: iso(now) };
    case "7d": return { from: iso(subDays(now, 6)), to: iso(now) };
    case "30d": return { from: iso(subDays(now, 29)), to: iso(now) };
    case "lastMonth": { const lm = subMonths(now, 1); return { from: iso(startOfMonth(lm)), to: iso(endOfMonth(lm)) }; }
    case "90d": return { from: iso(subDays(now, 89)), to: iso(now) };
    case "year": return { from: iso(startOfYear(now)), to: iso(now) };
    case "custom": return custom;
    default: return { from: iso(startOfMonth(now)), to: iso(now) };
  }
}

function greetingFor(hour: number): string {
  if (hour < 12) return "শুভ সকাল";
  if (hour < 17) return "শুভ অপরাহ্ন";
  return "শুভ সন্ধ্যা";
}

/** Bengali description for each real AuditLog action shown in the feed (unknown actions are simply not shown). */
const ACTIVITY_LABELS: Record<string, { label: string; icon: typeof Users; tone: string }> = {
  "student.create": { label: "নতুন শিক্ষার্থী ভর্তি", icon: UserPlus, tone: "text-primary" },
  "student.quick-create": { label: "দ্রুত শিক্ষার্থী যোগ", icon: UserPlus, tone: "text-primary" },
  "student.approve-entry": { label: "শিক্ষার্থীর আবেদন অনুমোদিত", icon: UserCheck, tone: "text-success" },
  "student-import.bulk-approve": { label: "বাল্ক ভর্তি অনুমোদিত", icon: Users, tone: "text-primary" },
  "payment.create": { label: "পেমেন্ট গৃহীত", icon: Wallet, tone: "text-success" },
  "payment.cancel": { label: "পেমেন্ট বাতিল", icon: Wallet, tone: "text-destructive" },
  "enrollment.create": { label: "ব্যাচে শিক্ষার্থী যুক্ত", icon: Layers, tone: "text-foreground/70" },
  "enrollment.transfer": { label: "ব্যাচ পরিবর্তন", icon: Layers, tone: "text-foreground/70" },
  "exam.create": { label: "নতুন এক্সাম", icon: CalendarClock, tone: "text-foreground/70" },
  "exam.save-results": { label: "ফলাফল সংরক্ষিত", icon: Award, tone: "text-primary" },
  "exam.send-result-sms": { label: "ফলাফল প্রকাশ (SMS)", icon: Award, tone: "text-success" },
  "material.distribute": { label: "ম্যাটেরিয়াল বিতরণ", icon: Boxes, tone: "text-foreground/70" },
  "notice.create": { label: "নতুন নোটিশ", icon: Megaphone, tone: "text-foreground/70" },
  "mess.membership.create": { label: "মেসে নতুন সদস্য", icon: BedDouble, tone: "text-primary" },
  "mess.payment.create": { label: "মেস পেমেন্ট গৃহীত", icon: Coins, tone: "text-success" },
  "mess.expense.create": { label: "মেস খরচ যোগ", icon: HandCoins, tone: "text-warning" },
  "mess.bill.generate": { label: "মেস বিল তৈরি", icon: Receipt, tone: "text-foreground/70" },
  "mess.settlement.complete": { label: "মেস চূড়ান্ত নিষ্পত্তি", icon: ShieldCheck, tone: "text-foreground/70" },
};

function relativeTime(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "এইমাত্র";
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} দিন আগে`;
  return format(new Date(ts), "d MMM yyyy", { locale: bn });
}

// -------------------- Page --------------------

const Index = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { courses } = useAcademic();
  const { batches } = useBatches();
  const { notices } = useNotices();
  const now = useMemo(() => new Date(), []);

  const [preset, setPreset] = useState<PresetKey>("month");
  const [custom, setCustom] = useState({ from: iso(startOfMonth(now)), to: iso(now) });
  const [courseId, setCourseId] = useState("all");
  const [batchId, setBatchId] = useState("all");
  const range = presetRange(preset, custom);

  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (courseId !== "all") params.set("courseId", courseId);
  if (batchId !== "all") params.set("batchId", batchId);
  const overview = useQuery({
    queryKey: ["dashboard", "overview", range.from, range.to, courseId, batchId],
    queryFn: () => api.get<Overview>(`/dashboard/overview?${params.toString()}`),
    staleTime: 30_000, refetchOnMount: "always",
    placeholderData: (prev) => prev,
  });

  // Small "needs attention" counts that already have their own cheap endpoints (read via meta.total, never a list).
  const birthdays = useQuery({
    queryKey: ["dashboard", "birthdays"],
    queryFn: () => api.getWithMeta<unknown[]>("/students?birthdayToday=true&limit=1").then((r) => Number((r.meta as { total?: number } | undefined)?.total ?? 0)),
    enabled: hasPermission(user, STUDENTS_READ),
    staleTime: 300_000,
  });
  const materialStats = useQuery({
    queryKey: ["dashboard", "materials"],
    queryFn: () => api.get<{ lowStockCount: number; outOfStockCount: number }>("/materials/dashboard/stats"),
    enabled: hasPermission(user, MATERIALS_VIEW),
    staleTime: 300_000,
  });

  const o = overview.data;
  const loading = overview.isLoading;
  const s = o?.students;
  const f = o?.finance;
  const a = o?.attendance;
  const ac = o?.academic;
  const rangeLabel = PRESETS.find((p) => p.key === preset)?.label ?? "";
  const prevLabel = preset === "today" ? "গতকালের তুলনায়" : "আগের সমান সময়ের তুলনায়";

  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["dashboard"] }); void queryClient.invalidateQueries({ queryKey: ["mess"] }); };

  const quickActions = [
    { label: "নতুন ভর্তি", url: "/admission", icon: UserPlus, perm: STUDENTS_CREATE },
    { label: "পেমেন্ট নিন", url: "/fees", icon: Receipt, perm: PAYMENTS_CREATE },
    { label: "উপস্থিতি", url: "/attendance", icon: ClipboardCheck, perm: ATTENDANCE_MARK },
    { label: "রেজাল্ট এন্ট্রি", url: "/result-entry", icon: ClipboardList, perm: EXAMS_MANAGE },
    { label: "ফলাফল ব্যবস্থাপনা", url: "/result-management", icon: FileSpreadsheet, perm: EXAMS_MANAGE },
    { label: "খরচ যোগ করুন", url: "/accounts", icon: HandCoins, perm: ACCOUNTS_MANAGE },
    { label: "মেস সদস্য ভর্তি", url: "/mess/members", icon: BedDouble, perm: MESS_MEMBERS_MANAGE },
    { label: "মাসিক মেস বিল", url: "/mess/billing", icon: FilePlus2, perm: MESS_BILLING_MANAGE },
    { label: "নোটিশ দিন", url: "/notices", icon: Megaphone, perm: NOTICES_MANAGE },
  ].filter((q) => hasPermission(user, q.perm)).slice(0, 8);

  const attention = [
    s && s.pendingApplications > 0 && { label: "অনুমোদনের অপেক্ষায় শিক্ষার্থী", value: s.pendingApplications, url: "/admission/pending", icon: UserPlus, tone: "warning" },
    s && s.dueStudents > 0 && { label: "বকেয়া আছে এমন শিক্ষার্থী", value: s.dueStudents, url: "/fees", icon: AlertCircle, tone: "danger" },
    a && a.lowAttendanceStudents > 0 && { label: "কম উপস্থিতি (<৬০%)", value: a.lowAttendanceStudents, url: "/attendance", icon: ClipboardCheck, tone: "warning" },
    ac && ac.upcoming.some((e) => e.date === o?.range.today) && { label: "আজকের এক্সাম", value: ac.upcoming.filter((e) => e.date === o?.range.today).length, url: "/exams", icon: CalendarClock, tone: "neutral" },
    (birthdays.data ?? 0) > 0 && { label: "আজকের জন্মদিন", value: birthdays.data!, url: "/students", icon: Cake, tone: "neutral" },
    materialStats.data && materialStats.data.lowStockCount + materialStats.data.outOfStockCount > 0 && { label: "লো/আউট অব স্টক ম্যাটেরিয়াল", value: materialStats.data.lowStockCount + materialStats.data.outOfStockCount, url: "/books", icon: Boxes, tone: "warning" },
  ].filter(Boolean) as { label: string; value: number; url: string; icon: typeof Users; tone: "warning" | "danger" | "neutral" }[];

  const latestNotices = filterNoticesFor(notices, { role: "Admin" }).slice(0, 4);
  const batchOptions = batches.filter((b) => courseId === "all" || b.courseId === courseId);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* ---------- Header ---------- */}
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {format(now, "EEEE, d MMMM yyyy", { locale: bn })}
              {o?.header.sessionName && <><span aria-hidden>•</span><span>সেশন: <b className="text-foreground font-medium">{o.header.sessionName}</b></span></>}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">{greetingFor(now.getHours())}{user?.name && !/^[+\d\s-]+$/.test(user.name) ? `, ${user.name}` : ""}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{o?.header.institutionName ? `${o.header.institutionName} — ` : ""}প্রতিষ্ঠানের আজকের সার্বিক অবস্থা</p>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="ড্যাশবোর্ড ফিল্টার">
            <Select value={preset} onValueChange={(v) => setPreset(v as PresetKey)}>
              <SelectTrigger className="w-[150px] h-9" aria-label="তারিখের পরিসর"><CalendarDays className="h-4 w-4 text-muted-foreground" /><SelectValue /></SelectTrigger>
              <SelectContent>{PRESETS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            {preset === "custom" && (
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-9 tabular-nums">{range.from} → {range.to}</Button></PopoverTrigger>
                <PopoverContent align="end" className="w-64 space-y-3">
                  <div className="space-y-1.5"><Label htmlFor="dash-from">শুরু</Label><Input id="dash-from" type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="dash-to">শেষ</Label><Input id="dash-to" type="date" value={custom.to} min={custom.from} max={iso(now)} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} /></div>
                  <p className="text-xs text-muted-foreground">সর্বোচ্চ ১ বছরের পরিসর।</p>
                </PopoverContent>
              </Popover>
            )}
            <Select value={courseId} onValueChange={(v) => { setCourseId(v); setBatchId("all"); }}>
              <SelectTrigger className="w-[150px] h-9" aria-label="কোর্স"><SelectValue placeholder="কোর্স" /></SelectTrigger>
              <SelectContent><SelectItem value="all">সব কোর্স</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger className="w-[150px] h-9" aria-label="ব্যাচ"><SelectValue placeholder="ব্যাচ" /></SelectTrigger>
              <SelectContent><SelectItem value="all">সব ব্যাচ</SelectItem>{batchOptions.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={refresh} aria-label="রিফ্রেশ" title="রিফ্রেশ">
              <RefreshCw className={cn(overview.isFetching && "animate-spin")} />
            </Button>
          </div>
        </header>

        {overview.isError && !o && <ErrorState message="ড্যাশবোর্ডের তথ্য লোড করা যায়নি" onRetry={() => void overview.refetch()} />}

        {/* ---------- Quick actions + needs attention ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
          {quickActions.length > 0 && (
            <section aria-labelledby="qa-title" className="rounded-lg border bg-card p-4 sm:p-5">
              <h2 id="qa-title" className="text-sm font-semibold mb-3">দ্রুত কাজ</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickActions.map((q) => (
                  <button key={q.url + q.label} type="button" onClick={() => navigate(q.url)} className="group flex flex-col items-start gap-2 rounded-md border border-transparent bg-muted/50 p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5">
                    <q.icon className="h-4 w-4 text-primary" aria-hidden />
                    <span className="text-xs font-medium leading-snug">{q.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <section aria-labelledby="att-title" className="rounded-lg border bg-card p-4 sm:p-5">
            <h2 id="att-title" className="text-sm font-semibold mb-3 flex items-center gap-2"><Bell className="h-4 w-4 text-primary" aria-hidden />আপনার মনোযোগ প্রয়োজন</h2>
            {loading ? <ListSkeleton rows={3} /> : attention.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">এই মুহূর্তে জরুরি কিছু নেই।</p>
            ) : (
              <ul className="divide-y">
                {attention.map((t) => (
                  <li key={t.label}>
                    <button type="button" onClick={() => navigate(t.url)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-muted/40 -mx-1 px-1 rounded-sm">
                      <t.icon className={cn("h-4 w-4 shrink-0", t.tone === "danger" ? "text-destructive" : t.tone === "warning" ? "text-warning" : "text-muted-foreground")} aria-hidden />
                      <span className="flex-1 text-sm">{t.label}</span>
                      <span className={cn("text-sm font-semibold tabular-nums", t.tone === "danger" && "text-destructive")}>{t.value}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---------- Executive overview ---------- */}
        {(s || loading) && (
          <section>
            <SectionHeader title="শিক্ষার্থী" icon={Users} description={`নতুন ভর্তি: ${rangeLabel} (${o?.range.from ?? ""} → ${o?.range.to ?? ""})`} action={<PanelLink to="/students">শিক্ষার্থী তালিকা</PanelLink>} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard title="মোট শিক্ষার্থী" value={String(s?.total ?? 0)} icon={Users} variant="primary" loading={loading} description="অনুমোদিত সব শিক্ষার্থী" onClick={() => navigate("/students")} />
              <StatCard title="সক্রিয় শিক্ষার্থী" value={String(s?.active ?? 0)} icon={UserCheck} variant="success" loading={loading} description={s && s.total ? `মোটের ${Math.round((s.active / s.total) * 100)}%` : undefined} />
              <StatCard title="নতুন ভর্তি" value={String(s?.newInRange ?? 0)} icon={UserPlus} variant="primary" loading={loading} delta={s ? { current: s.newInRange, previous: s.newPrevRange, label: prevLabel } : undefined} />
              <StatCard title="নিষ্ক্রিয় শিক্ষার্থী" value={String(s?.inactive ?? 0)} icon={UserX} variant="info" loading={loading} />
            </div>
          </section>
        )}

        {(f || loading) && (
          <section>
            <SectionHeader title="আর্থিক" icon={Wallet} description="কোর্স ফি / ভর্তি / ম্যাটেরিয়াল পেমেন্ট (বাতিল পেমেন্ট বাদ)। মেসের টাকা আলাদা — নিচের মেস অংশে।" action={<PanelLink to="/fees">ফি ম্যানেজমেন্ট</PanelLink>} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard title="আজকের আদায়" value={taka(f?.today)} icon={Wallet} variant="success" loading={loading} description={f ? `${f.todayCount}টি পেমেন্ট` : undefined} />
              <StatCard title="এই মাসের আদায়" value={taka(f?.thisMonth)} icon={TrendingUp} variant="primary" loading={loading} delta={f ? { current: f.thisMonth, previous: f.lastMonthToDate, label: "গত মাসের একই সময়ের তুলনায়" } : undefined} />
              <StatCard title="মোট বকেয়া" value={taka(s?.due ?? f?.dueVsPaid.due)} icon={AlertCircle} variant="danger" loading={loading} description={s ? `${s.dueStudents} জন শিক্ষার্থীর` : undefined} onClick={() => navigate("/fees")} />
              <StatCard title="মোট ডিসকাউন্ট" value={taka(s?.discount)} icon={BadgePercent} variant="warning" loading={loading} description={f ? `এই পরিসরে পেমেন্টে: ${taka(f.rangeDiscount)}` : undefined} />
            </div>
          </section>
        )}

        {(a || ac || loading) && (
          <section>
            <SectionHeader title="একাডেমিক" icon={GraduationCap} action={<PanelLink to="/exams">এক্সাম</PanelLink>} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard title="সক্রিয় কোর্স" value={String(ac?.activeCourses ?? 0)} icon={GraduationCap} variant="primary" loading={loading} />
              <StatCard title="ব্যাচ" value={String(ac?.totalBatches ?? 0)} icon={Layers} variant="info" loading={loading} onClick={() => navigate("/batches")} />
              <StatCard title="আজকের উপস্থিতি" value={a?.todayPct == null ? "—" : `${a.todayPct}%`} icon={ClipboardCheck} variant="success" loading={loading} description={a ? (a.todayPresent + a.todayAbsent ? `উপস্থিত ${a.todayPresent} • অনুপস্থিত ${a.todayAbsent}` : "আজ এখনো উপস্থিতি নেওয়া হয়নি") : undefined} onClick={() => navigate("/attendance")} />
              <StatCard title="আসন্ন এক্সাম" value={String(ac?.upcomingCount ?? 0)} icon={CalendarClock} variant="warning" loading={loading} description={ac?.upcoming[0] ? `পরবর্তী: ${ac.upcoming[0].date}` : undefined} onClick={() => navigate("/exams")} />
            </div>
          </section>
        )}

        {/* ---------- Mess Management ---------- */}
        {hasPermission(user, MESS_VIEW) && <MessOverview />}

        {/* ---------- Financial analytics ---------- */}
        {(f || loading) && (
          <section>
            <SectionHeader title="আর্থিক বিশ্লেষণ" icon={TrendingUp} description="সব হিসাব প্রকৃত পেমেন্ট লেনদেন থেকে" />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel
                className="xl:col-span-2"
                title={f && f.daily.length > 0 ? "দৈনিক আদায়" : "মাসিক আদায়"}
                description={f ? `${rangeLabel}: মোট ${taka(f.range)} • ${f.rangeCount}টি পেমেন্ট` : undefined}
                action={f && <DeltaText current={f.range} previous={f.prevRange} label={prevLabel} />}
              >
                {loading || !f ? <ChartSkeleton /> : f.range === 0 && f.daily.length > 0 ? <EmptyState compact title="এই পরিসরে কোনো পেমেন্ট নেই" /> : (
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      {f.daily.length > 0 ? (
                        <AreaChart data={f.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="collectionFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.22} />
                              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" {...axisProps} tickFormatter={dayLabel} minTickGap={24} />
                          <YAxis {...axisProps} width={52} tickFormatter={takaShort} />
                          <Tooltip cursor={{ stroke: "hsl(var(--border))" }} content={<ChartTooltip format={taka} labelFormat={dayLabel} />} />
                          <Area type="monotone" dataKey="total" name="আদায়" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#collectionFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                        </AreaChart>
                      ) : (
                        <BarChart data={f.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" {...axisProps} tickFormatter={(m) => monthLabel(m)} />
                          <YAxis {...axisProps} width={52} tickFormatter={takaShort} />
                          <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltip format={taka} labelFormat={(m) => monthLabel(m, true)} />} />
                          <Bar dataKey="total" name="আদায়" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>
              <Panel title="বকেয়া বনাম পরিশোধিত" description="সব শিক্ষার্থীর মোট ফি অনুযায়ী (ফিল্টার প্রযোজ্য)">
                {loading || !f ? <ListSkeleton rows={2} /> : (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs text-muted-foreground">মোট নির্ধারিত ফি</p>
                      <p className="text-2xl font-bold tabular-nums">{taka(f.dueVsPaid.totalFee)}</p>
                    </div>
                    <SplitMeter a={{ label: "পরিশোধিত", value: f.dueVsPaid.paid, className: "bg-success" }} b={{ label: "বকেয়া", value: f.dueVsPaid.due, className: "bg-destructive" }} format={taka} />
                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">পেমেন্টের উৎস ({rangeLabel})</p>
                      <RankedBars
                        rows={f.bySource.map((x) => ({ key: x.source, label: x.source === "admission" ? "ভর্তির সময়" : x.source === "material" ? "ম্যাটেরিয়াল" : "নিয়মিত ফি", value: x.total }))}
                        format={taka}
                        tone="neutral"
                        emptyText="এই পরিসরে পেমেন্ট নেই"
                      />
                    </div>
                  </div>
                )}
              </Panel>
              <Panel title="মাসিক আদায়ের ধারা" description="শেষ ১২ মাস">
                {loading || !f ? <ChartSkeleton height={200} /> : (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={f.monthly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" {...axisProps} tickFormatter={(m) => monthLabel(m)} interval="preserveStartEnd" minTickGap={8} />
                        <YAxis {...axisProps} width={48} tickFormatter={takaShort} />
                        <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltip format={taka} labelFormat={(m) => monthLabel(m, true)} />} />
                        <Bar dataKey="total" name="আদায়" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>
              <Panel title="কোর্সভিত্তিক আদায়" description={rangeLabel}>
                {loading || !f ? <ListSkeleton /> : <RankedBars rows={f.byCourse.map((c, i) => ({ key: `${c.name}-${i}`, label: c.name, value: c.total }))} format={taka} emptyText="এই পরিসরে পেমেন্ট নেই" />}
              </Panel>
              <Panel title="পেমেন্ট পদ্ধতি" description={rangeLabel}>
                {loading || !f ? <ListSkeleton /> : <RankedBars rows={f.byMethod.map((m) => ({ key: m.method, label: m.method, value: m.total, sub: `${m.count}টি` }))} format={taka} emptyText="এই পরিসরে পেমেন্ট নেই" />}
              </Panel>
            </div>
          </section>
        )}

        {/* ---------- Student analytics ---------- */}
        {(s || loading) && (
          <section>
            <SectionHeader title="শিক্ষার্থী বিশ্লেষণ" icon={Users} />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel className="xl:col-span-2" title="মাসিক ভর্তির ধারা" description="শেষ ১২ মাস (ভর্তির তারিখ অনুযায়ী)">
                {loading || !s ? <ChartSkeleton /> : (
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={s.monthlyAdmissions} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" {...axisProps} tickFormatter={(m) => monthLabel(m)} interval="preserveStartEnd" minTickGap={8} />
                        <YAxis {...axisProps} width={36} allowDecimals={false} />
                        <Tooltip cursor={{ stroke: "hsl(var(--border))" }} content={<ChartTooltip format={(v) => `${v} জন`} labelFormat={(m) => monthLabel(m, true)} />} />
                        <Line type="monotone" dataKey="count" name="ভর্তি" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "hsl(var(--chart-1))" }} activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>
              <Panel title="সক্রিয় বনাম নিষ্ক্রিয়">
                {loading || !s ? <ListSkeleton rows={2} /> : s.total === 0 ? <EmptyState compact title="কোনো শিক্ষার্থী নেই" /> : (
                  <div className="space-y-5">
                    <SplitMeter a={{ label: "সক্রিয়", value: s.active, className: "bg-primary" }} b={{ label: "নিষ্ক্রিয়", value: s.inactive, className: "bg-foreground/25" }} format={(v) => `${v}`} />
                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">কোর্সভিত্তিক শিক্ষার্থী</p>
                      <RankedBars rows={s.byCourse.map((c, i) => ({ key: c.id ?? `none-${i}`, label: c.name, value: c.count }))} format={(v) => `${v}`} />
                    </div>
                  </div>
                )}
              </Panel>
              <Panel title="ব্যাচভিত্তিক শিক্ষার্থী" description="বড় ১০টি ব্যাচ" action={<PanelLink to="/batches">ব্যাচ</PanelLink>}>
                {loading || !s ? <ListSkeleton /> : <RankedBars rows={s.byBatch.map((b) => ({ key: b.id, label: b.name, value: b.count }))} format={(v) => `${v} জন`} tone="neutral" emptyText="কোনো ব্যাচে শিক্ষার্থী নেই" />}
              </Panel>
              <Panel className="xl:col-span-2" title="সাম্প্রতিক ভর্তি" action={<PanelLink to="/students">সব দেখুন</PanelLink>} bodyClassName="px-0 sm:px-0">
                {loading || !s ? <div className="px-5"><ListSkeleton /></div> : s.recentAdmissions.length === 0 ? <EmptyState compact title="কোনো ভর্তি নেই" /> : (
                  <ul className="divide-y">
                    {s.recentAdmissions.map((r) => (
                      <li key={r.id}>
                        <button type="button" onClick={() => navigate(`/students/${r.id}`)} className="flex w-full items-center gap-3 px-4 sm:px-5 py-2.5 text-left hover:bg-muted/40">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{r.name.charAt(0)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{r.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{r.registrationId}{r.course ? ` • ${r.course}` : ""}{r.batchName ? ` • ${r.batchName}` : ""}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{r.admissionDate}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </section>
        )}

        {/* ---------- Attendance + academic ---------- */}
        {(a || ac || loading) && (
          <section>
            <SectionHeader title="উপস্থিতি ও একাডেমিক" icon={ClipboardCheck} />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {(a || loading) && (
                <Panel
                  className="xl:col-span-2"
                  title="উপস্থিতির ধারা"
                  description={a ? `${rangeLabel}: গড় ${a.rangePct ?? "—"}%${a.rangeEntries ? ` • ${a.rangeEntries}টি এন্ট্রি` : ""}` : undefined}
                  action={<PanelLink to="/attendance">বিস্তারিত উপস্থিতি</PanelLink>}
                >
                  {loading || !a ? <ChartSkeleton /> : a.trend.every((t) => t.pct === null) ? <EmptyState compact icon={ClipboardCheck} title="এই পরিসরে কোনো উপস্থিতি নেওয়া হয়নি" /> : (
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={a.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" {...axisProps} tickFormatter={dayLabel} minTickGap={24} />
                          <YAxis {...axisProps} width={36} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                          <Tooltip cursor={{ stroke: "hsl(var(--border))" }} content={<ChartTooltip format={(v) => `${v}%`} labelFormat={dayLabel} />} />
                          <Line type="monotone" dataKey="pct" name="উপস্থিতি" connectNulls stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Panel>
              )}
              {(a || loading) && (
                <Panel title="মনোযোগ প্রয়োজন এমন ব্যাচ" description={`সবচেয়ে কম উপস্থিতি • ${rangeLabel}`}>
                  {loading || !a ? <ListSkeleton /> : (
                    <RankedBars
                      rows={a.byBatch.map((b) => ({ key: b.id, label: b.name, value: b.pct, sub: `${b.entries} এন্ট্রি` }))}
                      max={100}
                      format={(v) => `${v}%`}
                      tone="warning"
                      emptyText="এই পরিসরে উপস্থিতির তথ্য নেই"
                      onRowClick={() => navigate("/attendance")}
                    />
                  )}
                </Panel>
              )}
              {(ac || loading) && (
                <Panel title="আসন্ন এক্সাম" action={<PanelLink to="/exams">এক্সাম</PanelLink>} bodyClassName="px-0 sm:px-0">
                  {loading || !ac ? <div className="px-5"><ListSkeleton rows={4} /></div> : ac.upcoming.length === 0 ? <EmptyState compact icon={CalendarClock} title="কোনো আসন্ন এক্সাম নেই" /> : (
                    <ul className="divide-y">
                      {ac.upcoming.map((e) => (
                        <li key={e.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                          <DateTile date={e.date} highlight={e.date === o?.range.today} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{e.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{[e.subjectName, e.batchName, `পূর্ণমান ${e.fullMarks}`].filter(Boolean).join(" • ")}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}
              {(ac || loading) && (
                <Panel
                  className="xl:col-span-2"
                  title="সাম্প্রতিক এক্সাম ও ফলাফল"
                  action={<div className="flex gap-3"><PanelLink to="/result-management">ফলাফল ব্যবস্থাপনা</PanelLink><PanelLink to="/marksheet">মার্কশিট</PanelLink></div>}
                  bodyClassName="px-0 sm:px-0"
                >
                  {loading || !ac ? <div className="px-5"><ListSkeleton rows={4} /></div> : ac.recent.length === 0 ? <EmptyState compact icon={Award} title="এখনো কোনো এক্সাম হয়নি" /> : (
                    <ul className="divide-y">
                      {ac.recent.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:px-5 py-2.5">
                          <DateTile date={e.date} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{e.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{[e.subjectName, e.batchName].filter(Boolean).join(" • ")}</span>
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">{e.resultCount} জনের ফলাফল</span>
                          {e.resultCount === 0 ? (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3" />ফলাফল বাকি</Badge>
                          ) : e.isPublished ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20"><Award className="h-3 w-3" />প্রকাশিত</Badge>
                          ) : (
                            <Badge variant="outline">অপ্রকাশিত</Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}
            </div>
          </section>
        )}

        {/* ---------- Activity, payments, notices ---------- */}
        <section>
          <SectionHeader title="সাম্প্রতিক কার্যক্রম" icon={Activity} />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {(o?.activity || loading) && (
              <Panel title="কার্যক্রমের খতিয়ান" description="অডিট লগ থেকে প্রকৃত ঘটনা" bodyClassName="px-0 sm:px-0">
                {loading || !o?.activity ? <div className="px-5"><ListSkeleton /></div> : o.activity.length === 0 ? <EmptyState compact icon={Activity} title="এখনো কোনো কার্যক্রম নেই" /> : (
                  <ol className="relative px-4 sm:px-5">
                    {o.activity.filter((ev) => ACTIVITY_LABELS[ev.action]).slice(0, 8).map((ev) => {
                      const meta = ACTIVITY_LABELS[ev.action];
                      const detail = [ev.detail.name, ev.detail.ref, ev.detail.category, ev.detail.receiptNo, ev.detail.amount !== undefined ? taka(ev.detail.amount) : undefined, ev.detail.created !== undefined ? `${ev.detail.created}টি` : undefined].filter(Boolean).join(" • ");
                      return (
                        <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0 before:absolute before:left-[13px] before:top-7 before:bottom-0 before:w-px before:bg-border last:before:hidden">
                          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card"><meta.icon className={cn("h-3.5 w-3.5", meta.tone)} aria-hidden /></span>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-sm font-medium leading-tight">{meta.label}</p>
                            {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
                            <p className="text-[11px] text-muted-foreground mt-0.5">{ev.actor ? `${ev.actor} • ` : ""}<time dateTime={ev.timestamp}>{relativeTime(ev.timestamp)}</time></p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Panel>
            )}
            {(f || loading) && (
              <Panel title="সাম্প্রতিক পেমেন্ট" action={<PanelLink to="/fees">সব দেখুন</PanelLink>} bodyClassName="px-0 sm:px-0">
                {loading || !f ? <div className="px-5"><ListSkeleton /></div> : f.recentPayments.length === 0 ? <EmptyState compact icon={Wallet} title="কোনো পেমেন্ট নেই" /> : (
                  <ul className="divide-y">
                    {f.recentPayments.map((p) => (
                      <li key={p.id}>
                        <button type="button" onClick={() => navigate(`/payments/${p.id}/receipt`)} className="flex w-full items-center gap-3 px-4 sm:px-5 py-2.5 text-left hover:bg-muted/40">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{p.studentName || "—"}</span>
                            <span className="block truncate text-xs text-muted-foreground">{p.receiptNo} • {p.date} • {p.method}</span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-success tabular-nums">{taka(p.amount)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
            <Panel title="সর্বশেষ নোটিশ" action={<PanelLink to="/notices">সব নোটিশ</PanelLink>} bodyClassName="px-0 sm:px-0">
              {latestNotices.length === 0 ? <EmptyState compact icon={Megaphone} title="কোনো নোটিশ নেই" /> : (
                <ul className="divide-y">
                  {latestNotices.map((n) => (
                    <li key={n.id} className="px-4 sm:px-5 py-2.5">
                      <p className="text-sm font-medium flex items-center gap-1.5">{n.pinned && <Pin className="h-3 w-3 text-primary" aria-label="পিন করা" />}<span className="truncate">{n.title}</span></p>
                      <p className="text-xs text-muted-foreground truncate">{n.publishDate} • {n.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

function DeltaText({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (!previous && !current) return null;
  const diff = current - previous;
  const pct = previous ? Math.round((Math.abs(diff) / previous) * 100) : null;
  return (
    <span className="text-xs text-right block">
      <span className={cn("font-semibold", diff >= 0 ? "text-success" : "text-destructive")}>{diff >= 0 ? "▲" : "▼"} {pct !== null ? `${pct}%` : diff > 0 ? "বেড়েছে" : "কমেছে"}</span>
      <span className="block text-muted-foreground">{label}</span>
    </span>
  );
}

function DateTile({ date, highlight }: { date: string; highlight?: boolean }) {
  const [, m, d] = date.split("-").map(Number);
  return (
    <span className={cn("flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border text-center leading-none", highlight ? "border-primary bg-primary/10 text-primary" : "bg-muted/40")}>
      <span className="text-sm font-bold tabular-nums">{d}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5">{["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"][(m || 1) - 1]}</span>
    </span>
  );
}

export default Index;
