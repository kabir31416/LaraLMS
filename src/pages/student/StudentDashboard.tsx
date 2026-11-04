import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import {
  ArrowRight, Award, BedDouble, Bell, BookOpen, CalendarClock, CalendarDays, CheckCircle2, ClipboardCheck, Clock, FileText, GraduationCap,
  MapPin, Pin, Receipt, TrendingUp, User, Video, Wallet, XCircle, type LucideIcon,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, ListSkeleton, Panel, PanelLink, SplitMeter } from "@/components/dashboard/DashboardKit";
import { useStudentSelf } from "./useStudentSelf";
import { useAttendance } from "@/contexts/AttendanceContext";
import { usePayments } from "@/contexts/PaymentContext";
import { filterNoticesFor, useNotices } from "@/contexts/NoticeContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { api } from "@/lib/apiClient";
import { taka } from "@/lib/dashboardFormat";
import { cn } from "@/lib/utils";
import type { StudentMaterialHistoryRow } from "@/types/material";
import { COMPLETION_LABELS, useMyPerformance } from "@/components/student/StudentPortalKit";
import { ExamTrendChart, TrendChip, pctText } from "@/components/analytics/PerformanceKit";

/**
 * Student home. Every figure comes from the student's own existing
 * endpoints (the same ones the Results/Attendance/Payments/Notices/
 * Materials/Mess pages use) — nothing here is invented. A section with no
 * data says so instead of showing a placeholder number.
 */

interface MyMessSummary {
  current: null | { status: string; isOpen: boolean; messId?: { name: string }; roomId?: { name: string }; seatId?: { seatNumber: string }; monthlyRent: number };
  balances: null | { due: number; depositBalance: number };
  currentBill: null | { period: string; totalPayable: number; dueAmount?: number; status: string; dueDate: string };
  notices: { isRead?: boolean }[];
}

const WEEKDAY_INDEX: Record<string, number> = { রবিবার: 0, সোমবার: 1, মঙ্গলবার: 2, বুধবার: 3, বৃহস্পতিবার: 4, শুক্রবার: 5, শনিবার: 6 };

/** Next class day from the batch's weekly schedule (real batch data). */
function nextClassLabel(days: string[] | undefined): string | null {
  if (!days?.length) return null;
  const today = new Date().getDay();
  const idx = days.map((d) => WEEKDAY_INDEX[d]).filter((n): n is number => n !== undefined);
  if (!idx.length) return null;
  const offsets = idx.map((d) => (d - today + 7) % 7).sort((a, b) => a - b);
  const off = offsets[0];
  if (off === 0) return "আজ";
  if (off === 1) return "আগামীকাল";
  const d = new Date();
  d.setDate(d.getDate() + off);
  return format(d, "EEEE", { locale: bn });
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 rounded-lg border bg-card px-2 py-3 text-center text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
      <span className="leading-tight">{label}</span>
    </Link>
  );
}

function Kpi({ label, value, sub, tone, icon: Icon, to, loading }: { label: string; value: string; sub?: string; tone?: "success" | "danger" | "primary" | "warning"; icon: LucideIcon; to: string; loading?: boolean }) {
  const toneClass = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <Link to={to} className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" aria-hidden />
      </div>
      {loading ? <Skeleton className="mt-2 h-7 w-20" /> : <p className={cn("mt-1.5 text-2xl font-bold tabular-nums tracking-tight", toneClass)}>{value}</p>}
      {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </Link>
  );
}

export default function StudentDashboard() {
  const { user, student, batch } = useStudentSelf();
  const { getByStudent, listExams } = useAttendance();
  const { getPayments } = usePayments();
  const { notices } = useNotices();
  const { courses, getSubject } = useAcademic();
  const sid = student?.id;
  const enabled = !!sid && user?.role === "Student";

  const attendance = useQuery({ queryKey: ["student-dash", "attendance", sid], queryFn: () => getByStudent(sid!), enabled, staleTime: 60_000 });
  // Overall performance, recent results and trend — the same server calculation as the Results page and the marksheet.
  const perf = useMyPerformance();
  const upcoming = useQuery({
    queryKey: ["student-dash", "upcoming", batch?.id],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      return (await listExams({ batchId: batch!.id })).filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    },
    enabled: enabled && !!batch?.id,
    staleTime: 120_000,
  });
  const materials = useQuery({ queryKey: ["student-dash", "materials", sid], queryFn: () => api.get<StudentMaterialHistoryRow[]>(`/materials/students/${sid}/history`), enabled, staleTime: 120_000, retry: false });
  const mess = useQuery({ queryKey: ["mess", "portal", "me", user?.studentId], queryFn: () => api.get<MyMessSummary>("/mess/portal/me"), enabled: user?.role === "Student", staleTime: 120_000, retry: false });

  const att = useMemo(() => {
    const rows = attendance.data ?? [];
    const present = rows.filter((r) => r.status === "Present").length;
    const cutoff = format(new Date(Date.now() - 30 * 86_400_000), "yyyy-MM-dd");
    const recent = rows.filter((r) => r.date >= cutoff);
    const recentPresent = recent.filter((r) => r.status === "Present").length;
    return {
      total: rows.length,
      present,
      absent: rows.length - present,
      pct: rows.length ? Math.round((present / rows.length) * 100) : null,
      pct30: recent.length ? Math.round((recentPresent / recent.length) * 100) : null,
      last: rows.slice(0, 10),
    };
  }, [attendance.data]);

  if (!user || user.role !== "Student") return <Navigate to="/studentLogin" replace />;
  if (!student) return <DashboardLayout><div className="space-y-4"><Skeleton className="h-36" /><Skeleton className="h-24" /></div></DashboardLayout>;

  const myCourse = courses.find((c) => c.name === student.course);
  const myNotices = filterNoticesFor(notices, { role: "Student", courseId: myCourse?.id, batchId: batch?.id })
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishDate.localeCompare(a.publishDate))
    .slice(0, 4);
  const payments = getPayments(student.id).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const totalFee = student.paid + student.due;
  // Same figure as the Profile page (server-computed profileCompletion).
  const completion = student.profileCompletion?.percent ?? 0;
  const missing = (student.profileCompletion?.missingFields ?? []).map((f) => COMPLETION_LABELS[f] ?? f);
  const p = perf.data;
  const m = mess.data?.current;
  const liveMess = !!m && m.isOpen;
  const nextClass = nextClassLabel(batch?.days);
  const materialsReceived = (materials.data ?? []).filter((x) => x.status !== "REVERSED");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome / identity */}
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="relative bg-[hsl(224_64%_22%)] px-4 pb-14 pt-5 text-white sm:px-6">
            <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:36px_36px]" />
            <p className="relative flex items-center gap-2 text-xs text-white/70"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{format(new Date(), "EEEE, d MMMM yyyy", { locale: bn })}</p>
            <h1 className="relative mt-1 text-xl font-bold sm:text-2xl">স্বাগতম, {student.name}</h1>
          </div>
          <div className="relative -mt-10 flex flex-col gap-4 px-4 pb-5 sm:px-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
              <Avatar className="h-20 w-20 shrink-0 border-4 border-card shadow-sm">
                {student.photo && <AvatarImage src={student.photo} alt="" className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">{initials(student.name)}</AvatarFallback>
              </Avatar>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 pb-1 text-sm sm:grid-cols-4 sm:pt-12">
                <div><dt className="text-[11px] text-muted-foreground">রেজিস্ট্রেশন নং</dt><dd className="font-semibold tabular-nums">{student.rollNumber || "—"}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">সিস্টেম আইডি</dt><dd className="font-semibold tabular-nums">{student.studentId}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">কোর্স</dt><dd className="font-semibold">{student.course || "—"}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">ব্যাচ</dt><dd className="font-semibold">{batch?.name || "নির্ধারিত হয়নি"}</dd></div>
              </dl>
            </div>
            <Link to="/student/profile" className="w-full rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 xl:w-64 xl:shrink-0">
              <div className="flex items-center justify-between text-xs"><span className="font-medium">প্রোফাইল সম্পূর্ণতা</span><b className={cn("tabular-nums", completion < 100 ? "text-warning" : "text-success")}>{completion}%</b></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", completion < 100 ? "bg-warning" : "bg-success")} style={{ width: `${completion}%` }} /></div>
              <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{missing.length ? `বাকি: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` +${missing.length - 3}` : ""}` : "সব তথ্য দেওয়া আছে"}</p>
            </Link>
          </div>
        </section>

        {/* Quick actions */}
        <nav aria-label="দ্রুত লিংক" className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          <QuickAction to="/student/profile" icon={User} label="প্রোফাইল" />
          <QuickAction to="/student/results" icon={Award} label="ফলাফল" />
          <QuickAction to="/student/attendance" icon={ClipboardCheck} label="উপস্থিতি" />
          <QuickAction to="/student/payments" icon={Wallet} label="ফি ও পেমেন্ট" />
          <QuickAction to="/student/results?view=marksheet" icon={FileText} label="মার্কশিট" />
          <QuickAction to="/student/books" icon={BookOpen} label="ম্যাটেরিয়াল" />
          <QuickAction to="/student/notices" icon={Bell} label="নোটিশ" />
          {liveMess ? <QuickAction to="/student/mess" icon={BedDouble} label="আমার মেস" /> : <QuickAction to="/student/videos" icon={Video} label="ভিডিও ক্লাস" />}
        </nav>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="উপস্থিতি" icon={ClipboardCheck} to="/student/attendance" loading={perf.isLoading} value={p?.attendance.pct == null ? "—" : `${p.attendance.pct}%`} tone={p?.attendance.pct == null ? undefined : p.attendance.pct < 60 ? "danger" : "success"} sub={p?.attendance.total ? `${p.attendance.present}/${p.attendance.total} দিন উপস্থিত` : "এখনো কোনো রেকর্ড নেই"} />
          <Kpi label="সামগ্রিক নম্বর" icon={Award} to="/student/results" loading={perf.isLoading} value={pctText(p?.overall.percentage)} tone="primary" sub={p?.overall.examsSat ? `গ্রেড ${p.overall.grade ?? "—"} · ${p.overall.examsSat}টি পরীক্ষা` : "এখনো কোনো ফলাফল নেই"} />
          <Kpi label="পরিশোধিত" icon={Wallet} to="/student/payments" value={taka(student.paid)} tone="success" sub={`মোট ফি ${taka(totalFee)}`} />
          <Kpi label="বকেয়া" icon={Receipt} to="/student/payments" value={taka(student.due)} tone={student.due > 0 ? "danger" : "success"} sub={student.due > 0 ? "অফিসে যোগাযোগ করুন" : "কোনো বকেয়া নেই"} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Academic overview + upcoming */}
          <Panel title="ক্লাস ও আসন্ন পরীক্ষা" icon={CalendarClock} className="xl:col-span-1">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">পরবর্তী ক্লাস</p>
              <p className="mt-0.5 font-semibold">{nextClass ?? "সময়সূচি নেই"}{batch?.batchTime ? ` • ${batch.batchTime}` : ""}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {batch?.days?.length ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden />{batch.days.join(", ")}</span> : null}
                {batch?.roomNumber && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />রুম {batch.roomNumber}</span>}
              </p>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">আসন্ন পরীক্ষা</p>
              {upcoming.isLoading ? <ListSkeleton rows={2} /> : upcoming.isError ? <ErrorState message="পরীক্ষার তালিকা লোড করা যায়নি" onRetry={() => void upcoming.refetch()} /> : (upcoming.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">কোনো আসন্ন পরীক্ষা নেই</p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.data!.map((e) => (
                    <li key={e.id} className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border bg-card leading-none">
                        <span className="text-sm font-bold tabular-nums">{e.date.slice(8, 10)}</span>
                        <span className="mt-0.5 text-[10px] text-muted-foreground">{e.date.slice(5, 7)}/{e.date.slice(2, 4)}</span>
                      </span>
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{e.title}</span><span className="block truncate text-xs text-muted-foreground">{getSubject(e.subjectId)?.name ?? ""} • পূর্ণমান {e.fullMarks}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          {/* My performance (own data only — no rankings, no at-risk labels) */}
          <Panel title="আমার পারফরম্যান্স" icon={TrendingUp} action={<PanelLink to="/student/results">সব ফলাফল</PanelLink>} className="xl:col-span-2">
            {perf.isLoading ? <ListSkeleton rows={4} /> : perf.isError || !p ? <ErrorState message="ফলাফল লোড করা যায়নি" onRetry={() => void perf.refetch()} /> : p.exams.length === 0 ? (
              <EmptyState compact icon={Award} title="এখনো কোনো ফলাফল নেই" description="পরীক্ষার ফলাফল প্রকাশ হলে এখানে দেখা যাবে।" />
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span>সামগ্রিক <b className="tabular-nums">{pctText(p.overall.percentage)}</b>{p.overall.grade && <span className="text-muted-foreground"> · {p.overall.grade}</span>}</span>
                    <TrendChip trend={p.trend.direction} change={p.trend.change} />
                  </div>
                  <ExamTrendChart height={170} passing={p.passingPercentage} points={[...p.exams].reverse().map((e) => ({ key: e.examId, date: e.date, label: e.title, percentage: e.percentage }))} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">সাম্প্রতিক পরীক্ষা</p>
                  <ul className="divide-y">
                    {p.exams.slice(0, 5).map((e) => (
                      <li key={e.examId} className="flex items-center gap-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{e.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{e.subject} • {e.date}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          {e.marks === null ? <Badge variant="outline" className="text-muted-foreground">অনুপস্থিত</Badge> : <><b className="tabular-nums">{e.marks}</b><span className="text-xs text-muted-foreground"> / {e.fullMarks}</span><span className={cn("block text-[11px] tabular-nums", e.status === "অনুত্তীর্ণ" ? "text-destructive" : "text-muted-foreground")}>{pctText(e.percentage, 0)}{e.grade ? ` · ${e.grade}` : ""}</span></>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {/* Attendance summary */}
          <Panel title="উপস্থিতি" icon={ClipboardCheck} action={<PanelLink to="/student/attendance">বিস্তারিত</PanelLink>}>
            {attendance.isLoading ? <ListSkeleton rows={3} /> : attendance.isError ? <ErrorState message="উপস্থিতি লোড করা যায়নি" onRetry={() => void attendance.refetch()} /> : att.total === 0 ? (
              <EmptyState compact icon={ClipboardCheck} title="এখনো কোনো উপস্থিতির রেকর্ড নেই" />
            ) : (
              <>
                <SplitMeter a={{ label: "উপস্থিত", value: att.present, className: "bg-success" }} b={{ label: "অনুপস্থিত", value: att.absent, className: "bg-destructive" }} format={(n) => `${n} দিন`} />
                <p className="mt-3 text-xs text-muted-foreground">গত ৩০ দিনে: <b className="text-foreground">{att.pct30 === null ? "—" : `${att.pct30}%`}</b></p>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="সর্বশেষ ১০ দিনের উপস্থিতি">
                  {att.last.map((e) => (
                    <span key={e.id} title={`${e.date} — ${e.status === "Present" ? "উপস্থিত" : "অনুপস্থিত"}`} className={cn("flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums", e.status === "Present" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                      {e.status === "Present" ? <CheckCircle2 className="h-3.5 w-3.5" aria-label="উপস্থিত" /> : <XCircle className="h-3.5 w-3.5" aria-label="অনুপস্থিত" />}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Panel>

          {/* Fees & payments */}
          <Panel title="ফি ও পেমেন্ট" icon={Wallet} action={<PanelLink to="/student/payments">পেমেন্ট ইতিহাস</PanelLink>}>
            <SplitMeter a={{ label: "পরিশোধিত", value: student.paid, className: "bg-success" }} b={{ label: "বকেয়া", value: student.due, className: "bg-destructive" }} format={taka} />
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">সাম্প্রতিক পেমেন্ট</p>
              {payments.length === 0 ? <p className="text-sm text-muted-foreground">কোনো পেমেন্ট নেই</p> : (
                <ul className="divide-y rounded-md border">
                  {payments.map((p) => (
                    <li key={p.id}>
                      <Link to={`/payments/${p.id}/receipt`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
                        <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm">{p.receiptNo}</span><span className="block text-xs text-muted-foreground">{p.date} • {p.method}</span></span>
                        <b className="shrink-0 text-sm tabular-nums text-success">{taka(p.paidAmount)}</b>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          {/* Notices */}
          <Panel title="নোটিশ" icon={Bell} action={<PanelLink to="/student/notices">সব নোটিশ</PanelLink>} bodyClassName="px-0 sm:px-0" className="lg:col-span-2 xl:col-span-1">
            {myNotices.length === 0 ? <EmptyState compact icon={Bell} title="কোনো নোটিশ নেই" /> : (
              <ul className="divide-y">
                {myNotices.map((n) => (
                  <li key={n.id} className="px-4 py-3 sm:px-5">
                    <p className="flex items-center gap-1.5 text-sm font-medium">{n.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="পিন করা" />}<span className="truncate">{n.title}</span></p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.description}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{n.publishDate}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Materials */}
          <Panel title="লার্নিং ম্যাটেরিয়াল" icon={BookOpen} action={<PanelLink to="/student/books">সব দেখুন</PanelLink>} bodyClassName="px-0 sm:px-0">
            {materials.isLoading ? <div className="px-5"><ListSkeleton rows={3} /></div> : materials.isError ? <div className="px-5"><ErrorState message="ম্যাটেরিয়াল লোড করা যায়নি" onRetry={() => void materials.refetch()} /></div> : materialsReceived.length === 0 ? (
              <EmptyState compact icon={BookOpen} title="এখনো কোনো ম্যাটেরিয়াল পাননি" />
            ) : (
              <ul className="divide-y">
                {materialsReceived.slice(0, 4).map((x) => (
                  <li key={x.distributionId} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm">{x.materialName}</span><span className="block text-xs text-muted-foreground">{x.materialType} • {x.date}</span></span>
                    <span className="shrink-0 text-xs text-muted-foreground">× {x.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Mess (only for a live member) or course details */}
          {liveMess ? (
            <Panel title="আমার মেস" icon={BedDouble} action={<PanelLink to="/student/mess">বিস্তারিত</PanelLink>}>
              <p className="text-sm text-muted-foreground">{m!.messId?.name} • রুম {m!.roomId?.name} • সিট {m!.seatId?.seatNumber}</p>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-md bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">মাসিক ভাড়া</dt><dd className="text-lg font-bold tabular-nums">{taka(m!.monthlyRent)}</dd></div>
                <div className="rounded-md bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">মেস বকেয়া</dt><dd className={cn("text-lg font-bold tabular-nums", (mess.data?.balances?.due ?? 0) > 0 ? "text-destructive" : "text-success")}>{taka(mess.data?.balances?.due)}</dd></div>
                <div className="rounded-md bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">চলতি বিল</dt><dd className="text-lg font-bold tabular-nums">{mess.data?.currentBill ? taka(mess.data.currentBill.totalPayable) : "—"}</dd></div>
                <div className="rounded-md bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">নতুন মেস নোটিশ</dt><dd className="text-lg font-bold tabular-nums">{(mess.data?.notices ?? []).filter((n) => !n.isRead).length}</dd></div>
              </dl>
            </Panel>
          ) : (
            <Panel title="কোর্স ও ব্যাচ" icon={GraduationCap} action={<PanelLink to="/student/profile">প্রোফাইল</PanelLink>}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">কোর্স</dt><dd className="font-medium">{student.course || "—"}</dd></div>
                <div className="rounded-md bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">ব্যাচ</dt><dd className="font-medium">{batch?.name || "—"}</dd></div>
                <div className="rounded-md bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">ক্লাসের সময়</dt><dd className="font-medium">{batch?.batchTime || "—"}</dd></div>
                <div className="rounded-md bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">রুম</dt><dd className="font-medium">{batch?.roomNumber || "—"}</dd></div>
              </dl>
              <Link to="/student/videos" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">ভিডিও ক্লাস দেখুন <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </Panel>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
