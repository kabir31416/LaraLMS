import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { Filter, Percent, CheckCircle2, XCircle } from "lucide-react";
import { useAttendance } from "@/contexts/AttendanceContext";
import { useBatches } from "@/contexts/BatchContext";
import { useStudents } from "@/contexts/StudentContext";
import { ReportToolbar } from "./ReportToolbar";
import { format, subDays } from "date-fns";

export default function AttendanceReport() {
  const { getStats, getByStudentStats } = useAttendance();
  const { batches } = useBatches();
  const { students } = useStudents();

  const [batch, setBatch] = useState("all");
  const [range, setRange] = useState<"weekly" | "monthly" | "custom">("weekly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { actualFrom, actualTo } = useMemo(() => {
    const today = new Date();
    if (range === "weekly") return { actualFrom: format(subDays(today, 7), "yyyy-MM-dd"), actualTo: format(today, "yyyy-MM-dd") };
    if (range === "monthly") return { actualFrom: format(subDays(today, 30), "yyyy-MM-dd"), actualTo: format(today, "yyyy-MM-dd") };
    return { actualFrom: from, actualTo: to };
  }, [range, from, to]);

  const batchId = batch === "all" ? undefined : batch;

  const [summary, setSummary] = useState({ present: 0, absent: 0, pct: 0 });
  const [perStudentRaw, setPerStudentRaw] = useState<{ studentId: string; present: number; absent: number; pct: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getStats({ batchId, from: actualFrom, to: actualTo }),
      getByStudentStats({ batchId, from: actualFrom, to: actualTo }),
    ])
      .then(([stats, byStudent]) => {
        if (cancelled) return;
        setSummary({ present: stats.present, absent: stats.absent, pct: stats.pct });
        setPerStudentRaw(byStudent);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [batchId, actualFrom, actualTo, getStats, getByStudentStats]);

  const perStudent = useMemo(() => perStudentRaw.map((r) => {
    const s = students.find((x) => x.id === r.studentId);
    return { name: s?.name || r.studentId, sid: s?.studentId || r.studentId, present: r.present, absent: r.absent, pct: r.pct };
  }), [perStudentRaw, students]);

  const headers = ["শিক্ষার্থী", "Student ID", "উপস্থিত", "অনুপস্থিত", "%"];
  const rows = perStudent.map((r) => [r.name, r.sid, r.present, r.absent, `${r.pct}%`]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><Filter className="h-4 w-4" /> ফিল্টার</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label className="text-xs">ব্যাচ</Label>
            <Select value={batch} onValueChange={setBatch}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব</SelectItem>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">রেঞ্জ</Label>
            <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">সাপ্তাহিক</SelectItem>
                <SelectItem value="monthly">মাসিক</SelectItem>
                <SelectItem value="custom">কাস্টম</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {range === "custom" && <>
            <div><Label className="text-xs">থেকে</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label className="text-xs">পর্যন্ত</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="উপস্থিতি %" value={`${summary.pct}%`} icon={Percent} variant="primary" />
        <StatCard title="উপস্থিত" value={summary.present.toLocaleString("bn-BD")} icon={CheckCircle2} variant="success" />
        <StatCard title="অনুপস্থিত" value={summary.absent.toLocaleString("bn-BD")} icon={XCircle} variant="warning" />
      </div>

      <div className="flex justify-end"><ReportToolbar data={{ filename: "attendance-report", title: "উপস্থিতি রিপোর্ট", headers, rows }} /></div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">কোনো তথ্য নেই</TableCell></TableRow> :
              rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
