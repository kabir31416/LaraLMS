import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Layers, Clock, DoorOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { useStudents } from "@/contexts/StudentContext";

const DirectorDashboard = () => {
  const { user } = useAuth();
  const { batches } = useBatches();
  const { students } = useStudents();

  if (!user || user.role !== "Batch Director") {
    return <Navigate to="/login" replace />;
  }

  const myBatches = batches.filter((b) => b.directorId === user.staffId);
  const myStudentIds = useMemo(() => new Set(myBatches.flatMap((b) => b.studentIds)), [myBatches]);
  const myStudents = students.filter((s) => myStudentIds.has(s.id));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">স্বাগতম, {user.name}</h1>
          <p className="text-sm text-muted-foreground">আপনার নিয়োগকৃত ব্যাচ এবং শিক্ষার্থীদের সারসংক্ষেপ</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Layers className="h-5 w-5" />} label="মোট ব্যাচ" value={String(myBatches.length)} />
          <StatCard icon={<Users className="h-5 w-5" />} label="মোট শিক্ষার্থী" value={String(myStudents.length)} />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="সক্রিয় শিক্ষার্থী"
            value={String(myStudents.filter((s) => s.status === "সক্রিয়").length)}
          />
          <StatCard
            icon={<DoorOpen className="h-5 w-5" />}
            label="রুম সংখ্যা"
            value={String(new Set(myBatches.map((b) => b.roomNumber).filter(Boolean)).size)}
          />
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
