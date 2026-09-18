import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { Filter, Users, UserPlus, RotateCcw } from "lucide-react";
import { useStudents } from "@/contexts/StudentContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { ReportToolbar } from "./ReportToolbar";

export default function AdmissionReport() {
  const { students } = useStudents();
  const { sessions, courses } = useAcademic();
  const { batches } = useBatches();

  const [sessionId, setSessionId] = useState("all");
  const [course, setCourse] = useState("all");
  const [batch, setBatch] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (course !== "all" && s.course !== course) return false;
      if (batch !== "all" && s.batchId !== batch) return false;
      if (from && s.admissionDate < from) return false;
      if (to && s.admissionDate > to) return false;
      return true;
    });
  }, [students, course, batch, from, to]);

  const newCount = filtered.filter((s) => s.admissionType === "নতুন").length;

  const batchName = (id?: string) => batches.find((b) => b.id === id)?.name || "—";
  const headers = ["Student ID", "নাম", "কোর্স", "ব্যাচ", "ভর্তির ধরন", "ভর্তির তারিখ"];
  const rows = filtered.map((s) => [s.studentId, s.name, s.course, batchName(s.batchId), s.admissionType, s.admissionDate]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><Filter className="h-4 w-4" /> ফিল্টার</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div><Label className="text-xs">সেশন</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">সব</SelectItem>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">কোর্স</Label>
            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">সব</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">ব্যাচ</Label>
            <Select value={batch} onValueChange={setBatch}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">সব</SelectItem>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">তারিখ থেকে</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">তারিখ পর্যন্ত</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="মোট ভর্তি" value={filtered.length.toLocaleString("bn-BD")} icon={Users} variant="primary" />
        <StatCard title="নতুন শিক্ষার্থী" value={newCount.toLocaleString("bn-BD")} icon={UserPlus} variant="success" />
        <StatCard title="পুরাতন শিক্ষার্থী" value={(filtered.length - newCount).toLocaleString("bn-BD")} icon={RotateCcw} variant="info" />
      </div>

      <div className="flex justify-end">
        <ReportToolbar data={{ filename: "admission-report", title: "ভর্তি রিপোর্ট", headers, rows }} />
      </div>

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