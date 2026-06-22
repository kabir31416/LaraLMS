import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStudents } from "@/contexts/StudentContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { ReportToolbar } from "./ReportToolbar";

export default function FeeCollectionReport() {
  const { payments, students } = useStudents();
  const { courses } = useAcademic();
  const { batches } = useBatches();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [course, setCourse] = useState("all");
  const [batch, setBatch] = useState("all");

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (from && p.date < from) return false;
      if (to && p.date > to) return false;
      const s = students.find((x) => x.id === p.studentId);
      if (course !== "all" && s?.course !== course) return false;
      if (batch !== "all" && s?.batch !== batch) return false;
      return true;
    });
  }, [payments, students, from, to, course, batch]);

  const total = filtered.reduce((s, p) => s + p.paidAmount, 0);
  const headers = ["রসিদ নং", "তারিখ", "শিক্ষার্থী", "পরিমাণ", "পদ্ধতি"];
  const rows = filtered.map((p) => {
    const s = students.find((x) => x.id === p.studentId);
    return [p.receiptNo, p.date, s?.name || "—", p.paidAmount, p.method];
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">তারিখ থেকে</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">তারিখ পর্যন্ত</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label className="text-xs">কোর্স</Label>
          <Select value={course} onValueChange={setCourse}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <div><Label className="text-xs">ব্যাচ</Label>
          <Select value={batch} onValueChange={setBatch}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব</SelectItem>{batches.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">মোট আদায়</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-bold">৳ {total.toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">পেমেন্ট সংখ্যা</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-bold">{filtered.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">রসিদ সংখ্যা</CardTitle></CardHeader><CardContent className="pt-0 text-2xl font-bold">{new Set(filtered.map((p) => p.receiptNo)).size}</CardContent></Card>
      </div>

      <div className="flex justify-end"><ReportToolbar data={{ filename: "fee-collection", title: "ফি কালেকশন রিপোর্ট", headers, rows }} /></div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">কোনো তথ্য নেই</TableCell></TableRow> :
              rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{j === 3 ? `৳ ${Number(c).toLocaleString()}` : c}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}