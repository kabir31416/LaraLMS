import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Layers, ClipboardCheck, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { useStudents } from "@/contexts/StudentContext";
import { useAttendance } from "@/contexts/AttendanceContext";

const DirectorDashboard = () => {
  const { user } = useAuth();
  const { batches } = useBatches();
  const { students } = useStudents();
  const { entries, exams, attendancePercent } = useAttendance();

  const myBatches = useMemo(
    () => (user ? batches.filter((b) => b.directorId === user.staffId) : []),
    [batches, user],
  );
  const myStudentIds = useMemo(() => new Set(myBatches.flatMap((b) => b.studentIds)), [myBatches]);
  const myStudents = students.filter((s) => myStudentIds.has(s.id));
  const myBatchIds = new Set(myBatches.map((b) => b.id));

  const today = format(new Date(), "yyyy-MM-dd");
  const todayEntries = entries.filter((e) => myBatchIds.has(e.batchId) && e.date === today);
  const todayPct = todayEntries.length ? Math.round((todayEntries.filter((e) => e.status === "Present").length / todayEntries.length) * 100) : 0;
  const allMine = entries.filter((e) => myBatchIds.has(e.batchId));
  const overallPct = allMine.length ? Math.round((allMine.filter((e) => e.status === "Present").length / allMine.length) * 100) : 0;

  const myExams = exams.filter((e) => myBatchIds.has(e.batchId)).slice(0, 5);
  const lowAttendance = myStudents
    .map((s) => ({ s, pct: attendancePercent(s.id) }))
    .filter((x) => x.pct > 0 && x.pct < 60)
    .sort((a, b) => a.pct - b.pct);

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
          <StatCard icon={<Users className="h-5 w-5" />} label="মোট শিক্ষার্থী" value={String(myStudents.length)} />
          <StatCard icon={<Layers className="h-5 w-5" />} label="মোট ব্যাচ" value={String(myBatches.length)} />
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
                {myBatches.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">কোনো ব্যাচ নিয়োগ করা হয়নি</TableCell></TableRow>
                ) : (
                  myBatches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>{b.course}</TableCell>
                      <TableCell className="text-sm">{b.batchTime}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.days.join(", ") || "—"}</TableCell>
                      <TableCell>{b.roomNumber || "—"}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{b.studentIds.length}</Badge></TableCell>
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
                  <div key={x.s.id} className="flex items-center justify-between px-5 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{x.s.name}</p>
                      <p className="text-xs text-muted-foreground">{x.s.studentId}</p>
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
