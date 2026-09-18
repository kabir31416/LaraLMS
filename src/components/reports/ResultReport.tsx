import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { Filter, BarChart3, TrendingUp, TrendingDown, Award } from "lucide-react";
import type { OfflineExam, OfflineResult } from "@/types/attendance";
import { useAttendance } from "@/contexts/AttendanceContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useStudents } from "@/contexts/StudentContext";
import { ReportToolbar } from "./ReportToolbar";

export default function ResultReport() {
  const { listExams, getResultsByExams } = useAttendance();
  const { courses, subjects, lectures, settings } = useAcademic();
  const { students } = useStudents();

  const [subject, setSubject] = useState("all");
  const [lecture, setLecture] = useState("all");
  const [examId, setExamId] = useState("all");
  const [exams, setExams] = useState<OfflineExam[]>([]);
  const [results, setResults] = useState<OfflineResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    listExams().then((data) => { if (!cancelled) setExams(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [listExams]);

  const filteredExams = useMemo(() => exams.filter((e) => {
    if (subject !== "all" && e.subjectId !== subject) return false;
    if (lecture !== "all" && e.lectureId !== lecture) return false;
    if (examId !== "all" && e.id !== examId) return false;
    return true;
  }), [exams, subject, lecture, examId]);

  useEffect(() => {
    let cancelled = false;
    getResultsByExams(filteredExams.map((e) => e.id)).then((data) => { if (!cancelled) setResults(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [filteredExams, getResultsByExams]);

  const stats = useMemo(() => {
    const allMarks: number[] = [];
    let pass = 0, total = 0;
    filteredExams.forEach((ex) => {
      const rs = results.filter((r) => r.examId === ex.id && r.marks != null);
      rs.forEach((r) => {
        allMarks.push(r.marks as number);
        total++;
        if ((r.marks as number) / ex.fullMarks * 100 >= settings.passingPercentage) pass++;
      });
    });
    if (allMarks.length === 0) return { avg: 0, max: 0, min: 0, passRate: 0, total: 0 };
    return {
      avg: Math.round(allMarks.reduce((a, b) => a + b, 0) / allMarks.length),
      max: Math.max(...allMarks),
      min: Math.min(...allMarks),
      passRate: total ? Math.round((pass / total) * 100) : 0,
      total,
    };
  }, [filteredExams, results, settings.passingPercentage]);

  const headers = ["এক্সাম", "শিক্ষার্থী", "নম্বর", "পূর্ণ মান"];
  const rows: (string | number)[][] = [];
  filteredExams.forEach((ex) => {
    results.filter((r) => r.examId === ex.id).forEach((r) => {
      const s = students.find((x) => x.id === r.studentId);
      rows.push([ex.title, s?.name || r.studentId, r.marks ?? "অনুপস্থিত", ex.fullMarks]);
    });
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><Filter className="h-4 w-4" /> ফিল্টার</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label className="text-xs">কোর্স</Label>
            <Select value="all" onValueChange={() => {}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">সাবজেক্ট</Label>
            <Select value={subject} onValueChange={setSubject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব</SelectItem>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">লেকচার</Label>
            <Select value={lecture} onValueChange={setLecture}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব</SelectItem>{lectures.map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">এক্সাম</Label>
            <Select value={examId} onValueChange={setExamId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব</SelectItem>{exams.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="গড় নম্বর" value={String(stats.avg)} icon={BarChart3} variant="primary" />
        <StatCard title="সর্বোচ্চ" value={String(stats.max)} icon={TrendingUp} variant="success" />
        <StatCard title="সর্বনিম্ন" value={String(stats.min)} icon={TrendingDown} variant="warning" />
        <StatCard title="পাশের হার" value={`${stats.passRate}%`} icon={Award} variant="info" />
      </div>

      <div className="flex justify-end"><ReportToolbar data={{ filename: "result-report", title: "ফলাফল রিপোর্ট", headers, rows }} /></div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">কোনো ফলাফল নেই</TableCell></TableRow> :
              rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
