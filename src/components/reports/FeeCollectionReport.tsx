import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { Filter, Wallet, Receipt, Hash } from "lucide-react";
import { fromApi, type ApiStudent } from "@/contexts/StudentContext";
import { fromApi as paymentFromApi, type ApiPayment } from "@/contexts/PaymentContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { api } from "@/lib/apiClient";
import type { Payment, Student } from "@/types/student";
import { ReportToolbar } from "./ReportToolbar";

/**
 * Every number here comes straight from the backend (GET /payments/stats/
 * collection for the totals, GET /payments for the listed rows), filtered
 * server-side by the exact same course/batch/date params — never summed
 * from PaymentContext's own capped ≤100-row cache, which would silently
 * under-count once matching payments exceed that cap (Fees/Payment audit
 * §5/§12). The listed rows are the most recent 100 matches — a reasonable
 * display cap for a printable report — while the summary stats above are
 * always exact for the full filtered set.
 */
export default function FeeCollectionReport() {
  const { courses } = useAcademic();
  const { batches } = useBatches();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [course, setCourse] = useState("all");
  const [batch, setBatch] = useState("all");

  const [stats, setStats] = useState({ total: 0, count: 0, receiptCount: 0 });
  const [rows, setRows] = useState<Payment[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, Student>>({});

  const buildParams = useCallback(() => {
    const qs = new URLSearchParams();
    if (from) qs.set("dateFrom", from);
    if (to) qs.set("dateTo", to);
    if (course !== "all") qs.set("courseId", course);
    if (batch !== "all") qs.set("batchId", batch);
    return qs;
  }, [from, to, course, batch]);

  useEffect(() => {
    const qs = buildParams();
    api.get<typeof stats>(`/payments/stats/collection?${qs.toString()}`).then(setStats).catch(() => {});
    const listQs = buildParams();
    listQs.set("sortBy", "date");
    listQs.set("sortOrder", "desc");
    listQs.set("limit", "100");
    api
      .get<ApiPayment[]>(`/payments?${listQs.toString()}`)
      .then((docs) => setRows(docs.map(paymentFromApi)))
      .catch(() => setRows([]));
  }, [buildParams]);

  useEffect(() => {
    const ids = Array.from(new Set(rows.map((p) => p.studentId))).filter(Boolean);
    if (ids.length === 0) { setStudentsById({}); return; }
    let cancelled = false;
    api
      .get<ApiStudent[]>(`/students?ids=${ids.join(",")}&limit=${ids.length}`)
      .then((docs) => {
        if (cancelled) return;
        const map: Record<string, Student> = {};
        for (const doc of docs) map[doc._id] = fromApi(doc);
        setStudentsById(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [rows]);

  const headers = ["রসিদ নং", "তারিখ", "শিক্ষার্থী", "পরিমাণ", "পদ্ধতি"];
  const tableRows = rows.map((p) => [p.receiptNo, p.date, studentsById[p.studentId]?.name || "—", p.paidAmount, p.method]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><Filter className="h-4 w-4" /> ফিল্টার</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label className="text-xs">তারিখ থেকে</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">তারিখ পর্যন্ত</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div><Label className="text-xs">কোর্স</Label>
            <Select value={course} onValueChange={setCourse}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">ব্যাচ</Label>
            <Select value={batch} onValueChange={setBatch}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব</SelectItem>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="মোট আদায়" value={`৳ ${stats.total.toLocaleString()}`} icon={Wallet} variant="success" />
        <StatCard title="পেমেন্ট সংখ্যা" value={stats.count.toLocaleString("bn-BD")} icon={Receipt} variant="primary" />
        <StatCard title="রসিদ সংখ্যা" value={stats.receiptCount.toLocaleString("bn-BD")} icon={Hash} variant="info" />
      </div>

      <div className="flex justify-end"><ReportToolbar data={{ filename: "fee-collection", title: "ফি কালেকশন রিপোর্ট", headers, rows: tableRows }} /></div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {tableRows.length === 0 ? <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">কোনো তথ্য নেই</TableCell></TableRow> :
              tableRows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{j === 3 ? `৳ ${Number(c).toLocaleString()}` : c}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
