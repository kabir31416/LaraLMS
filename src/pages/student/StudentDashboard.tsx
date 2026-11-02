import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { ClipboardCheck, Wallet, AlertCircle, Award, BedDouble, ArrowRight, CalendarDays, BookOpen, Clock, MapPin } from "lucide-react";
import { useStudentSelf } from "./useStudentSelf";
import { useAttendance } from "@/contexts/AttendanceContext";
import type { OfflineExam, OfflineResult } from "@/types/attendance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { Panel, PanelLink, SplitMeter } from "@/components/dashboard/DashboardKit";
import { taka } from "@/lib/dashboardFormat";

interface MyMessSummary {
  current: null | { status: string; membershipNo: string; isOpen: boolean; messId?: { name: string }; roomId?: { name: string }; seatId?: { seatNumber: string }; monthlyRent: number };
  balances: null | { due: number; advance: number; depositBalance: number };
  currentBill: null | { period: string; totalPayable: number; status: string; dueDate: string };
  notices: { isRead?: boolean }[];
}

const MEMBER_STATUS: Record<string, string> = { approved: "অনুমোদিত", active: "সক্রিয়", on_leave: "ছুটিতে", notice_given: "নোটিশ দিয়েছেন" };

export default function StudentDashboard() {
  const { user, student, batch } = useStudentSelf();
  const navigate = useNavigate();
  const { attendancePercent, getResultsByStudent, listExams } = useAttendance();
  const [pct, setPct] = useState<number | null>(null);
  const [latest, setLatest] = useState<OfflineResult | null>(null);
  const [latestExam, setLatestExam] = useState<OfflineExam | null>(null);
  const [loadingResult, setLoadingResult] = useState(true);

  // Mess information — the portal endpoint is keyed on the student's own token; shown only for a live membership.
  const mess = useQuery({
    queryKey: ["mess", "portal", "me", user?.studentId],
    queryFn: () => api.get<MyMessSummary>("/mess/portal/me"),
    enabled: user?.role === "Student",
    staleTime: 120_000,
    retry: false,
  });

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    attendancePercent(student.id).then((p) => { if (!cancelled) setPct(p); }).catch(() => {
      if (!cancelled) toast.error("উপস্থিতির হার লোড করা যায়নি");
    });
    getResultsByStudent(student.id).then(async (results) => {
      // Results come back newest-first (backend sorts by createdAt desc).
      const mostRecent = results[0];
      if (cancelled) return;
      if (!mostRecent) { setLoadingResult(false); return; }
      setLatest(mostRecent);
      const exams = await listExams();
      if (!cancelled) {
        setLatestExam(exams.find((e) => e.id === mostRecent.examId) || null);
        setLoadingResult(false);
      }
    }).catch(() => {
      if (!cancelled) { setLoadingResult(false); toast.error("ফলাফল লোড করা যায়নি"); }
    });
    return () => { cancelled = true; };
  }, [student, attendancePercent, getResultsByStudent, listExams]);

  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;

  const m = mess.data?.current;
  const liveMess = !!m && m.isOpen;
  const unreadMessNotices = (mess.data?.notices ?? []).filter((n) => !n.isRead).length;
  const totalFee = student.paid + student.due;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header>
          <p className="text-sm text-muted-foreground flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden />{format(new Date(), "EEEE, d MMMM yyyy", { locale: bn })}</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">স্বাগতম, {student.name}</h1>
          <p className="text-sm text-muted-foreground">{student.studentId}{student.rollNumber ? ` • রেজি. ${student.rollNumber}` : ""} • {batch?.name || "ব্যাচ assigned হয়নি"}</p>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="উপস্থিতি" value={pct === null ? "—" : `${pct}%`} icon={ClipboardCheck} variant="success" loading={pct === null} onClick={() => navigate("/student/attendance")} />
          <StatCard title="মোট পরিশোধিত" value={taka(student.paid)} icon={Wallet} variant="primary" onClick={() => navigate("/student/payments")} />
          <StatCard title="মোট বকেয়া" value={taka(student.due)} icon={AlertCircle} variant={student.due > 0 ? "danger" : "success"} description={student.due > 0 ? "অফিসে যোগাযোগ করুন" : "কোনো বকেয়া নেই"} onClick={() => navigate("/student/payments")} />
          <StatCard
            title="সর্বশেষ ফলাফল"
            value={latest && latestExam ? `${latest.marks ?? "অনু."} / ${latestExam.fullMarks}` : "—"}
            icon={Award}
            variant="info"
            loading={loadingResult}
            description={latestExam?.title}
            onClick={() => navigate("/student/results")}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="কোর্স ও ব্যাচ" action={<PanelLink to="/student/profile">প্রোফাইল</PanelLink>}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">কোর্স</dt><dd className="font-medium flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{student.course || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">ব্যাচ</dt><dd className="font-medium">{batch?.name || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">সময়</dt><dd className="font-medium flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{batch?.batchTime || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">রুম</dt><dd className="font-medium flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{batch?.roomNumber || "—"}</dd></div>
            </dl>
          </Panel>
          <Panel title="ফি-র অবস্থা" action={<PanelLink to="/student/payments">পেমেন্ট ইতিহাস</PanelLink>}>
            <p className="text-xs text-muted-foreground">মোট ফি</p>
            <p className="text-2xl font-bold tabular-nums mb-4">{taka(totalFee)}</p>
            <SplitMeter a={{ label: "পরিশোধিত", value: student.paid, className: "bg-success" }} b={{ label: "বকেয়া", value: student.due, className: "bg-destructive" }} format={taka} />
          </Panel>
        </div>

        {liveMess && (
          <section className="rounded-lg border border-primary/25 bg-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b bg-gradient-to-r from-primary/[0.06] to-transparent px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-primary p-2.5 text-primary-foreground"><BedDouble className="h-5 w-5" aria-hidden /></span>
                <div>
                  <h2 className="text-base font-semibold leading-tight">আমার মেস</h2>
                  <p className="text-xs text-muted-foreground">{m!.messId?.name} • রুম {m!.roomId?.name} • সিট {m!.seatId?.seatNumber}</p>
                </div>
                <Badge variant="outline" className="ml-1">{MEMBER_STATUS[m!.status] ?? m!.status}</Badge>
              </div>
              <Button variant="outline" onClick={() => navigate("/student/mess")}>মেসের বিস্তারিত <ArrowRight /></Button>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 sm:p-5">
              <div><dt className="text-xs text-muted-foreground">মাসিক ভাড়া</dt><dd className="text-lg font-bold tabular-nums">{taka(m!.monthlyRent)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">মেস বকেয়া</dt><dd className={`text-lg font-bold tabular-nums ${(mess.data?.balances?.due ?? 0) > 0 ? "text-destructive" : "text-success"}`}>{taka(mess.data?.balances?.due)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">চলতি বিল</dt><dd className="text-lg font-bold tabular-nums">{mess.data?.currentBill ? taka(mess.data.currentBill.totalPayable) : "—"}</dd>{mess.data?.currentBill && <dd className="text-[11px] text-muted-foreground">{mess.data.currentBill.period} • শেষ তারিখ {mess.data.currentBill.dueDate}</dd>}</div>
              <div><dt className="text-xs text-muted-foreground">নতুন মেস নোটিশ</dt><dd className="text-lg font-bold tabular-nums">{unreadMessNotices}</dd></div>
            </dl>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
