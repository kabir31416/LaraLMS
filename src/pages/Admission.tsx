import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Users, TrendingUp, CalendarDays, CalendarRange, UserCheck, FileSpreadsheet, ListChecks } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useStudents } from "@/contexts/StudentContext";
import { AdmissionForm } from "@/components/students/AdmissionForm";
import { StatCard } from "@/components/StatCard";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AdmissionSummary {
  totalStudents: number;
  todayAdmissions: number;
  weekAdmissions: number;
  monthAdmissions: number;
  newCount: number;
  oldCount: number;
  courseWise: { course: string; count: number }[];
  monthlyTrend: { month: string; count: number }[];
  recentAdmissions: { id: string; name: string; course: string; batchName?: string; admissionDate: string; admissionType: string; registrationId: string }[];
}

const Admission = () => {
  const navigate = useNavigate();
  const { students } = useStudents();
  const [formOpen, setFormOpen] = useState(false);
  const [summary, setSummary] = useState<AdmissionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get<AdmissionSummary>("/dashboard/admission")
      .then(setSummary)
      .catch((err) => toast.error(err instanceof ApiClientError ? err.message : "পরিসংখ্যান লোড করা যায়নি"))
      .finally(() => setLoading(false));
  };

  // Reload whenever the (capped) in-memory student list changes — e.g. right after a new admission is saved — so the server-side stats catch up immediately.
  useEffect(load, [students.length]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ভর্তি</h1>
            <p className="text-sm text-muted-foreground">নতুন শিক্ষার্থী ভর্তি করুন</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/students")}>
              <ListChecks className="mr-2 h-4 w-4" /> ভর্তি তালিকা
            </Button>
            <Button variant="outline" onClick={() => navigate("/admission/import")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel থেকে ভর্তি
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> নতুন ভর্তি
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="আজকের ভর্তি" value={summary ? String(summary.todayAdmissions) : loading ? "…" : "—"} icon={UserPlus} variant="success" />
          <StatCard title="এই সপ্তাহে" value={summary ? String(summary.weekAdmissions) : loading ? "…" : "—"} icon={CalendarDays} variant="info" />
          <StatCard title="এই মাসে" value={summary ? String(summary.monthAdmissions) : loading ? "…" : "—"} icon={CalendarRange} variant="primary" />
          <StatCard title="মোট শিক্ষার্থী" value={summary ? String(summary.totalStudents) : loading ? "…" : "—"} icon={Users} variant="primary" />
          <StatCard title="নতুন শিক্ষার্থী" value={summary ? String(summary.newCount) : loading ? "…" : "—"} icon={UserCheck} variant="success" />
          <StatCard title="পুরাতন শিক্ষার্থী" value={summary ? String(summary.oldCount) : loading ? "…" : "—"} icon={TrendingUp} variant="info" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">মাসিক ভর্তির ট্রেন্ড (৬ মাস)</CardTitle>
            </CardHeader>
            <CardContent className="h-[260px]">
              {summary && summary.monthlyTrend.some((m) => m.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  {loading ? "লোড হচ্ছে..." : "কোনো তথ্য নেই"}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">কোর্স অনুযায়ী ভর্তি</CardTitle>
            </CardHeader>
            <CardContent className="h-[260px]">
              {summary && summary.courseWise.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.courseWise} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis dataKey="course" type="category" width={110} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  {loading ? "লোড হচ্ছে..." : "কোনো তথ্য নেই"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">সাম্প্রতিক ভর্তি</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {!summary || summary.recentAdmissions.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">{loading ? "লোড হচ্ছে..." : "কোনো ভর্তি পাওয়া যায়নি"}</p>
              ) : (
                summary.recentAdmissions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.registrationId} • {s.course} {s.batchName ? `• ${s.batchName}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{s.admissionDate}</p>
                      <p className="text-xs font-medium">{s.admissionType}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <AdmissionForm open={formOpen} onOpenChange={setFormOpen} />
      </div>
    </DashboardLayout>
  );
};

export default Admission;
