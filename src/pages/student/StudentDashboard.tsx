import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, DollarSign, AlertCircle, Award } from "lucide-react";
import { useStudentSelf } from "./useStudentSelf";
import { useAttendance } from "@/contexts/AttendanceContext";
import { Badge } from "@/components/ui/badge";
import { Navigate } from "react-router-dom";

export default function StudentDashboard() {
  const { user, student, batch } = useStudentSelf();
  const { attendancePercent, results, exams } = useAttendance();

  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;

  const pct = attendancePercent(student.id);
  const myResults = results.filter((r) => r.studentId === student.id);
  const latest = myResults[myResults.length - 1];
  const latestExam = latest ? exams.find((e) => e.id === latest.examId) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">স্বাগতম, {student.name}</h1>
          <p className="text-sm text-muted-foreground">{student.studentId} • {batch?.name || "ব্যাচ assigned হয়নি"}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="উপস্থিতি %" value={`${pct}%`} icon={ClipboardCheck} variant="success" />
          <StatCard title="মোট পরিশোধিত" value={`৳ ${student.paid.toLocaleString()}`} icon={DollarSign} variant="info" />
          <StatCard title="মোট বকেয়া" value={`৳ ${student.due.toLocaleString()}`} icon={AlertCircle} variant="warning" />
          <StatCard title="সর্বশেষ ফলাফল" value={latest && latestExam ? `${latest.marks ?? "অনু."} / ${latestExam.fullMarks}` : "—"} icon={Award} variant="primary" />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">কোর্স তথ্য</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">কোর্স</p><Badge variant="outline">{student.course}</Badge></div>
            <div><p className="text-xs text-muted-foreground">ব্যাচ</p><Badge variant="outline">{batch?.name || "—"}</Badge></div>
            <div><p className="text-xs text-muted-foreground">সময়</p><span>{batch?.batchTime || "—"}</span></div>
            <div><p className="text-xs text-muted-foreground">রুম</p><span>{batch?.roomNumber || "—"}</span></div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}