import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Layers, ClipboardCheck, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useStudents } from "@/contexts/StudentContext";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";

interface DirectorDashboardSummary {
  totalBatches: number;
  totalStudents: number;
  todayAttendancePct: number;
  overallAttendancePct: number;
  lowAttendance: { studentId: string; pct: number; name?: string; registrationId?: string }[];
  myExams: { id: string; batchId: string; title: string; fullMarks: number; date: string }[];
  batches: {
    id: string;
    name: string;
    courseId?: string;
    courseName?: string;
    batchTime: string;
    days: string[];
    roomNumber?: string;
    studentCount: number;
  }[];
}

const DirectorDashboard = () => {
  const { user } = useAuth();
  const { batches } = useBatches();
  const { students } = useStudents();
  const { getCourse } = useAcademic();

  // Module 4, extended in Modules 18-20: server-side aggregation, scoped to
  // this director's own batches — accurate roster/attendance beyond
  // BatchContext/StudentContext's 100-row list cap, and AttendanceContext no
  // longer caches a global array at all (see its own comment).
  const [summary, setSummary] = useState<DirectorDashboardSummary | null>(null);
  useEffect(() => {
    if (!user || user.role !== "Batch Director") return;
    let cancelled = false;
    api
      .get<DirectorDashboardSummary>("/dashboard/director")
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((err) => {
        if (!(err instanceof ApiClientError)) console.error(err);
      });
    return () => { cancelled = true; };
  }, [user]);

  const myBatches = useMemo(
    () => (user ? batches.filter((b) => b.directorIds?.includes(user.staffId)) : []),
    [batches, user],
  );
  const myBatchIds = new Set(myBatches.map((b) => b.id));
  const myStudents = students.filter((s) => s.batchId && myBatchIds.has(s.batchId));
  const totalBatches = summary?.totalBatches ?? myBatches.length;
  const totalStudents = summary?.totalStudents ?? myStudents.length;
  const rosterBatches = summary?.batches ?? myBatches.map((b) => ({
    id: b.id,
    name: b.name,
    courseName: getCourse(b.courseId)?.name,
    batchTime: b.batchTime,
    days: b.days,
    roomNumber: b.roomNumber,
    studentCount: students.filter((s) => s.batchId === b.id).length,
  }));

  const todayPct = summary?.todayAttendancePct ?? 0;
  const overallPct = summary?.overallAttendancePct ?? 0;
  const myExams = summary?.myExams ?? [];
  const lowAttendance = summary?.lowAttendance ?? [];

  if (!user || user.role !== "Batch Director") {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">স্বাগতম, {user.name}</h1>
          <p className="text-sm text-muted-foreground">আপনার নিয়োগকৃত ব্যাচ এবং শিক্ষার্থীদের সারসংক্ষেপ</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<ClipboardCheck className="h-5 w-5" />} label="আজকের উপস্থিতি" value={`${todayPct}%`} />
          <StatCard icon={<ClipboardCheck className="h-5 w-5" />} label="ব্যাচ উপস্থিতি %" value={`${overallPct}%`} />
          <StatCard icon={<Users className="h-5 w-5" />} label="মোট শিক্ষার্থী" value={String(totalStudents)} />
          <StatCard icon={<Layers className="h-5 w-5" />} label="মোট ব্যাচ" value={String(totalBatches)} />
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">আমার ব্যাচসমূহ</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ব্যাচ</TableHead>
                  <TableHead>কোর্স</TableHead>
                  <TableHead>সময়</TableHead>
                  <TableHead>দিন</TableHead>
                  <TableHead>রুম</TableHead>
                  <TableHead className="text-center">শিক্ষার্থী</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rosterBatches.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">কোনো ব্যাচ নিয়োগ করা হয়নি</TableCell></TableRow>
                ) : (
                  rosterBatches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>{b.courseName || "—"}</TableCell>
                      <TableCell className="text-sm">{b.batchTime}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.days.join(", ") || "—"}</TableCell>
                      <TableCell>{b.roomNumber || "—"}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{b.studentCount}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-base">সাম্প্রতিক এক্সাম</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {myExams.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground text-center">কোনো এক্সাম নেই</p>
                ) : myExams.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">পূর্ণ মান {e.fullMarks} • {e.date}</p>
                    </div>
                    <Badge variant="outline">{batches.find((b) => b.id === e.batchId)?.name}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> কম উপস্থিতি (৬০% এর নিচে)</CardTitle></CardHeader>
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
      </div>
    </DashboardLayout>
  );
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default DirectorDashboard;
