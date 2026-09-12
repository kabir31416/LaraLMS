import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { AttendanceEntry } from "@/types/attendance";
import { useAttendance } from "@/contexts/AttendanceContext";
import { useStudentSelf } from "./useStudentSelf";
import { Navigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

export default function StudentAttendance() {
  const { user, student } = useStudentSelf();
  const { getByStudent, attendancePercent } = useAttendance();
  const [list, setList] = useState<AttendanceEntry[]>([]);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    getByStudent(student.id).then((entries) => { if (!cancelled) setList(entries); }).catch(() => {});
    attendancePercent(student.id).then((p) => { if (!cancelled) setPct(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [student, getByStudent, attendancePercent]);

  const monthly = useMemo(() => {
    const m = new Map<string, { p: number; total: number }>();
    list.forEach((e) => {
      const key = e.date.slice(0, 7);
      const v = m.get(key) || { p: 0, total: 0 };
      v.total++;
      if (e.status === "Present") v.p++;
      m.set(key, v);
    });
    return Array.from(m.entries()).map(([k, v]) => ({ month: k, pct: Math.round((v.p / v.total) * 100), p: v.p, total: v.total }));
  }, [list]);

  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">আমার উপস্থিতি</h1>

        <Card><CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">সামগ্রিক উপস্থিতি</p>
          <p className="text-5xl font-bold text-success">{pct}%</p>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-base">মাসিক উপস্থিতি</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>মাস</TableHead><TableHead>উপস্থিত / মোট</TableHead><TableHead>%</TableHead></TableRow></TableHeader>
              <TableBody>
                {monthly.map((m) => <TableRow key={m.month}><TableCell>{m.month}</TableCell><TableCell>{m.p} / {m.total}</TableCell><TableCell><Badge variant="outline">{m.pct}%</Badge></TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-base">উপস্থিতির ইতিহাস</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>তারিখ</TableHead><TableHead>স্ট্যাটাস</TableHead><TableHead>উৎস</TableHead></TableRow></TableHeader>
              <TableBody>
                {list.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">কোনো তথ্য নেই</TableCell></TableRow> :
                  list.map((e) => <TableRow key={e.id}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell><Badge className={e.status === "Present" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>{e.status === "Present" ? "উপস্থিত" : "অনুপস্থিত"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.source === "Exam" ? "এক্সাম" : "ম্যানুয়াল"}</TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
