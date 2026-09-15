import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OfflineExam, OfflineResult } from "@/types/attendance";
import { useAttendance } from "@/contexts/AttendanceContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useStudentSelf } from "./useStudentSelf";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { gradeFor } from "@/lib/grading";

export default function StudentResults() {
  const { user, student } = useStudentSelf();
  const { listExams, getResultsByStudent } = useAttendance();
  const { getSubject, getLecture, settings } = useAcademic();
  const [exams, setExams] = useState<OfflineExam[]>([]);
  const [results, setResults] = useState<OfflineResult[]>([]);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    Promise.all([listExams(), getResultsByStudent(student.id)])
      .then(([e, r]) => { if (!cancelled) { setExams(e); setResults(r); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [student, listExams, getResultsByStudent]);

  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;

  type ResultRow = { exam: OfflineExam; result: OfflineResult; subject?: string; lecture?: string };
  const rows = results.map((r): ResultRow | null => {
    const ex = exams.find((e) => e.id === r.examId);
    if (!ex) return null;
    return { exam: ex, result: r, subject: getSubject(ex.subjectId)?.name, lecture: getLecture(ex.lectureId)?.title };
  }).filter((r): r is ResultRow => r !== null);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">আমার ফলাফল</h1>
        <Card><CardHeader><CardTitle className="text-base">এক্সাম ইতিহাস</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>এক্সাম</TableHead><TableHead>সাবজেক্ট</TableHead><TableHead>লেকচার</TableHead><TableHead>তারিখ</TableHead><TableHead>নম্বর</TableHead><TableHead>গ্রেড</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">কোনো ফলাফল নেই</TableCell></TableRow> :
                  rows.map((r) => <TableRow key={r.result.id}>
                    <TableCell className="font-medium">{r.exam.title}</TableCell>
                    <TableCell>{r.subject || "—"}</TableCell>
                    <TableCell>{r.lecture || "—"}</TableCell>
                    <TableCell>{r.exam.date}</TableCell>
                    <TableCell className="font-semibold">{r.result.marks ?? "অনুপস্থিত"} / {r.exam.fullMarks}</TableCell>
                    <TableCell>{r.result.marks != null ? gradeFor((r.result.marks / r.exam.fullMarks) * 100, settings.gradeScale) : "—"}</TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
