import { Users, UserPlus, DollarSign, AlertCircle, Package, TrendingUp, UserCheck, UserX, Layers, ClipboardCheck, Bell, Pin } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudents } from "@/contexts/StudentContext";
import { usePayments } from "@/contexts/PaymentContext";
import { useBatches } from "@/contexts/BatchContext";
import { useNotices, filterNoticesFor } from "@/contexts/NoticeContext";
import { format, subDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";

interface AdminDashboardSummary {
  totalStudents: number;
  todayAdmissions: number;
  totalBatches: number;
  totalDue: number;
  packageDue: number;
  monthlyDue: number;
  todayCollection: number;
  monthlyCollection: { month: string; total: number }[];
  todayPresent: number;
  todayAbsent: number;
  todayAttendancePct: number;
  attendanceTrend: { date: string; pct: number }[];
  topAttendance: { studentId: string; pct: number; name?: string; registrationId?: string }[];
  lowAttendance: { studentId: string; pct: number; name?: string; registrationId?: string }[];
  recentAdmissions: { id: string; name: string; class?: string; course?: string; admissionDate: string; registrationId: string }[];
  recentPayments: { id: string; receiptNo: string; studentName?: string; date: string; paidAmount: number; method: string }[];
}

const Index = () => {
  const { students } = useStudents();
  const { payments } = usePayments();
  const { batches } = useBatches();
  const { notices } = useNotices();

  // Module 4 (extended in Modules 15-20): server-side aggregation for
  // everything that already has a real collection (Student, Batch, Payment,
  // Attendance) — StudentContext/BatchContext/PaymentContext cap their list
  // fetch at 100 rows for the table views, and Attendance isn't cached
  // client-side at all (see AttendanceContext), so these stat cards and
  // charts are computed server-side instead. Only notices stay mock until
  // Module 25 exists.
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .get<AdminDashboardSummary>("/dashboard/admin")
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((err) => {
        if (!(err instanceof ApiClientError)) console.error(err);
      });
    return () => { cancelled = true; };
  }, []);

  const totalStudents = summary?.totalStudents ?? students.length;
  const todayAdmissions = summary?.todayAdmissions ?? 0;
  const todayCollection = summary?.todayCollection ?? 0;
  const totalDue = summary?.totalDue ?? students.reduce((sum, s) => sum + s.due, 0);
  const packageDue = summary?.packageDue ?? students.filter((s) => s.feeType === "এককালীন").reduce((sum, s) => sum + s.due, 0);
  const monthlyDue = summary?.monthlyDue ?? students.filter((s) => s.feeType === "মাসিক").reduce((sum, s) => sum + s.due, 0);
  const totalBatches = summary?.totalBatches ?? batches.length;

  const todayPresent = summary?.todayPresent ?? 0;
  const todayAbsent = summary?.todayAbsent ?? 0;
  const todayPct = summary?.todayAttendancePct ?? 0;
  const trend = summary?.attendanceTrend ?? [];
  const top10 = summary?.topAttendance ?? [];
  const lowAttendance = summary?.lowAttendance ?? [];

  const recentAdmissions = summary?.recentAdmissions ?? [...students]
    .sort((a, b) => b.admissionDate.localeCompare(a.admissionDate))
    .slice(0, 5);

  const recentPayments = summary?.recentPayments ?? [...payments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      receiptNo: p.receiptNo,
      studentName: students.find((s) => s.id === p.studentId)?.name,
      date: p.date,
      paidAmount: p.paidAmount,
      method: p.method,
    }));
  const latestNotices = filterNoticesFor(notices, { role: "Admin" }).slice(0, 5);

  // Monthly collection (last 6 months)
  const monthly = useMemo(() => {
    if (summary?.monthlyCollection) return summary.monthlyCollection;
    const m = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = subDays(new Date(), i * 30);
      const key = format(d, "yyyy-MM");
      m.set(key, 0);
    }
    payments.forEach((p) => {
      const key = p.date.slice(0, 7);
      if (m.has(key)) m.set(key, (m.get(key) || 0) + p.paidAmount);
    });
    return Array.from(m.entries()).map(([month, total]) => ({ month: month.slice(5), total }));
  }, [payments, summary]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">ড্যাশবোর্ড</h1>
          <p className="text-muted-foreground text-sm">স্বাগতম! আজকের সারসংক্ষেপ দেখুন</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard title="মোট শিক্ষার্থী" value={String(totalStudents)} icon={Users} variant="primary" />
          <StatCard title="আজকের ভর্তি" value={String(todayAdmissions)} icon={UserPlus} variant="success" />
          <StatCard title="আজকের আদায়" value={`৳ ${todayCollection.toLocaleString()}`} icon={DollarSign} variant="info" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="আজকের উপস্থিতি %" value={`${todayPct}%`} icon={ClipboardCheck} variant="success" />
          <StatCard title="মোট উপস্থিত" value={String(todayPresent)} icon={UserCheck} variant="info" />
          <StatCard title="অনুপস্থিত" value={String(todayAbsent)} icon={UserX} variant="warning" />
          <StatCard title="মোট ব্যাচ" value={String(totalBatches)} icon={Layers} variant="primary" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="মোট বকেয়া" value={`৳ ${totalDue.toLocaleString()}`} icon={AlertCircle} variant="warning" />
          <StatCard title="প্যাকেজ বকেয়া" value={`৳ ${packageDue.toLocaleString()}`} icon={Package} variant="info" />
          <StatCard title="মাসিক বকেয়া" value={`৳ ${monthlyDue.toLocaleString()}`} icon={TrendingUp} variant="primary" />
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">দৈনিক উপস্থিতি (গত ৭ দিন)</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="pct" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">মাসিক কালেকশন (৬ মাস)</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">টপ ১০ শিক্ষার্থী (উপস্থিতি)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {top10.map((x, i) => (
                  <div key={x.studentId} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-muted-foreground w-5">{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{x.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{x.registrationId}</p>
                      </div>
                    </div>
                    <Badge className="bg-success/10 text-success border-success/20">{x.pct}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">কম উপস্থিতি (৬০% এর নিচে)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {lowAttendance.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground text-center">কেউ নেই</p>
                ) : lowAttendance.map((x) => (
                  <div key={x.studentId} className="flex items-center justify-between px-5 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{x.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{x.registrationId}</p>
                    </div>
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20">{x.pct}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">সাম্প্রতিক ভর্তি</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recentAdmissions.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.class} — {item.course}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.admissionDate}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">সাম্প্রতিক পেমেন্ট</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recentPayments.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground text-center">কোনো পেমেন্ট নেই</p> :
                  recentPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium">{p.studentName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.receiptNo} • {p.date}</p>
                      </div>
                      <span className="text-xs text-success font-semibold">৳ {p.paidAmount.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2"><Bell className="h-4 w-4" /> সর্বশেষ নোটিশ</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {latestNotices.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground text-center">কোনো নোটিশ নেই</p> :
                latestNotices.map((n) => (
                  <div key={n.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium flex items-center gap-1">{n.pinned && <Pin className="h-3 w-3 text-primary" />}{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">{n.publishDate}</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Index;
