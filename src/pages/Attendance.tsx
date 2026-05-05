import { useMemo, useState } from "react";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users, UserCheck, UserX } from "lucide-react";
import { useAttendance } from "@/contexts/AttendanceContext";
import { useBatches } from "@/contexts/BatchContext";
import { useStudents } from "@/contexts/StudentContext";

type Range = "today" | "week" | "month" | "custom";

const Attendance = () => {
  const { entries, attendancePercent } = useAttendance();
  const { batches } = useBatches();
  const { students } = useStudents();

  const [batchFilter, setBatchFilter] = useState("all");
  const [range, setRange] = useState<Range>("month");
  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 6 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const rangeBounds = useMemo(() => {
    if (range === "today") return { from: today, to: today };
    if (range === "week") return { from: weekStart, to: today };
    if (range === "month") return { from: monthStart, to: today };
    return { from, to };
  }, [range, from, to, today, weekStart, monthStart]);

  const pct = (list: typeof entries) => {
    if (list.length === 0) return 0;
    return Math.round((list.filter((e) => e.status === "Present").length / list.length) * 100);
  };

  const filterByBatch = (list: typeof entries) =>
    batchFilter === "all" ? list : list.filter((e) => e.batchId === batchFilter);

  const todayList = filterByBatch(entries.filter((e) => e.date === today));
  const yesterdayList = filterByBatch(entries.filter((e) => e.date === yesterday));
  const weekList = filterByBatch(entries.filter((e) => e.date >= weekStart && e.date <= today));
  const monthList = filterByBatch(entries.filter((e) => e.date >= monthStart && e.date <= today));

  // Daily breakdown for table
  const dailyRows = useMemo(() => {
    const list = filterByBatch(entries.filter((e) => e.date >= rangeBounds.from && e.date <= rangeBounds.to));
    const groups = new Map<string, { date: string; batchId: string; present: number; absent: number }>();
    list.forEach((e) => {
      const key = `${e.date}__${e.batchId}`;
      const cur = groups.get(key) || { date: e.date, batchId: e.batchId, present: 0, absent: 0 };
      if (e.status === "Present") cur.present++; else cur.absent++;
      groups.set(key, cur);
    });
    return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, rangeBounds, batchFilter]);

  // Top 10 students by attendance % within the range
  const topStudents = useMemo(() => {
    const ids = batchFilter === "all"
      ? students.map((s) => s.id)
      : (batches.find((b) => b.id === batchFilter)?.studentIds || []);
    return ids
      .map((sid) => ({ student: students.find((s) => s.id === sid)!, pct: attendancePercent(sid, rangeBounds.from, rangeBounds.to) }))
      .filter((x) => x.student)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [students, batches, batchFilter, rangeBounds, attendancePercent]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">উপস্থিতি ড্যাশবোর্ড</h1>
            <p className="text-sm text-muted-foreground">ব্যাচ ও তারিখ অনুযায়ী উপস্থিতির সারসংক্ষেপ</p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs">ব্যাচ</Label>
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সকল ব্যাচ</SelectItem>
                  {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">পরিসর</Label>
              <Select value={range} onValueChange={(v: Range) => setRange(v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">আজ</SelectItem>
                  <SelectItem value="week">এই সপ্তাহ</SelectItem>
                  <SelectItem value="month">এই মাস</SelectItem>
                  <SelectItem value="custom">কাস্টম</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {range === "custom" && (
              <>
                <div><Label className="text-xs">থেকে</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div><Label className="text-xs">পর্যন্ত</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<CalendarDays className="h-5 w-5" />} label="আজকের উপস্থিতি" value={`${pct(todayList)}%`} />
          <StatCard icon={<CalendarDays className="h-5 w-5" />} label="গতকালের উপস্থিতি" value={`${pct(yesterdayList)}%`} />
          <StatCard icon={<Users className="h-5 w-5" />} label="এই সপ্তাহ" value={`${pct(weekList)}%`} />
          <StatCard icon={<Users className="h-5 w-5" />} label="এই মাস" value={`${pct(monthList)}%`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-base">দৈনিক উপস্থিতি ({rangeBounds.from} → {rangeBounds.to})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>তারিখ</TableHead>
                    <TableHead>ব্যাচ</TableHead>
                    <TableHead className="text-center">উপ.</TableHead>
                    <TableHead className="text-center">অনুপ.</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRows.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">কোনো ডাটা নেই</TableCell></TableRow>
                  ) : dailyRows.slice(0, 30).map((r) => {
                    const total = r.present + r.absent;
                    const p = total ? Math.round((r.present / total) * 100) : 0;
                    return (
                      <TableRow key={`${r.date}_${r.batchId}`}>
                        <TableCell className="text-sm">{r.date}</TableCell>
                        <TableCell className="text-sm">{batches.find((b) => b.id === r.batchId)?.name || "—"}</TableCell>
                        <TableCell className="text-center text-success font-medium">{r.present}</TableCell>
                        <TableCell className="text-center text-destructive">{r.absent}</TableCell>
                        <TableCell className="text-right"><Badge variant="outline">{p}%</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-base">টপ ১০ শিক্ষার্থী (উপস্থিতি)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>নাম</TableHead>
                    <TableHead>আইডি</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topStudents.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">কোনো ডাটা নেই</TableCell></TableRow>
                  ) : topStudents.map((x, i) => (
                    <TableRow key={x.student.id}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>{x.student.name}</TableCell>
                      <TableCell className="font-mono text-xs">{x.student.studentId}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={x.pct >= 80 ? "bg-success/10 text-success border-success/20" : x.pct >= 60 ? "bg-warning/10 text-warning border-warning/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                          {x.pct}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

export default Attendance;