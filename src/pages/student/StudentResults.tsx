import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAttendance } from "@/contexts/AttendanceContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useStudentSelf } from "./useStudentSelf";
import { Navigate } from "react-router-dom";

export default function StudentResults() {
  const { user, student } = useStudentSelf();
  const { exams, results } = useAttendance();
  const { getSubject, getLecture } = useAcademic();
  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;

  const myResults = results.filter((r) => r.studentId === student.id);
  const rows = myResults.map((r) => {
    const ex = exams.find((e) => e.id === r.examId);
    if (!ex) return null;
    return { exam: ex, result: r, subject: getSubject(ex.subjectId)?.name, lecture: getLecture(ex.lectureId)?.title };
  }).filter(Boolean) as { exam: any; result: any; subject?: string; lecture?: string }[];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">আমার ফলাফল</h1>
        <Card><CardHeader><CardTitle className="text-base">এক্সাম ইতিহাস</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>এক্সাম</TableHead><TableHead>সাবজেক্ট</TableHead><TableHead>লেকচার</TableHead><TableHead>তারিখ</TableHead><TableHead>নম্বর</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">কোনো ফলাফল নেই</TableCell></TableRow> :
                  rows.map((r) => <TableRow key={r.result.id}>
                    <TableCell className="font-medium">{r.exam.title}</TableCell>
                    <TableCell>{r.subject || "—"}</TableCell>
                    <TableCell>{r.lecture || "—"}</TableCell>
                    <TableCell>{r.exam.date}</TableCell>
                    <TableCell className="font-semibold">{r.result.marks ?? "অনুপস্থিত"} / {r.exam.fullMarks}</TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}