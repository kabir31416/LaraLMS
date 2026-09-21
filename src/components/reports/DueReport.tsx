import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { AlertCircle, Users } from "lucide-react";
import { fromApi, type ApiStudent } from "@/contexts/StudentContext";
import { useBatches } from "@/contexts/BatchContext";
import { api } from "@/lib/apiClient";
import { ReportToolbar } from "./ReportToolbar";

/**
 * Server-computed totals (GET /students/stats/due — the same aggregate
 * FeeManagement.tsx's Due List uses) instead of summing StudentContext's own
 * capped ≤100-row list, which would silently under-report both the total
 * due and the due-student count once total students exceed that cap
 * (Fees/Payment audit §5/§6). The listed rows below are the top 100 by due
 * amount, fetched directly and sorted server-side — a reasonable display cap
 * for a printable report, while the summary numbers above are always exact.
 */
export default function DueReport() {
  const { batches } = useBatches();
  const batchName = (id?: string) => batches.find((b) => b.id === id)?.name || "—";
  const [stats, setStats] = useState({ totalDue: 0, packageDue: 0, monthlyDue: 0 });
  const [dueCount, setDueCount] = useState(0);
  const [rows, setRows] = useState<{ name: string; course: string; batchId?: string; due: number }[]>([]);

  useEffect(() => {
    api.get<typeof stats>("/students/stats/due?dueStatus=has").then(setStats).catch(() => {});
    api
      .getWithMeta<ApiStudent[]>("/students?dueStatus=has&sortBy=due&sortOrder=desc&limit=100")
      .then((res) => {
        setDueCount((res.meta as { total?: number } | undefined)?.total ?? res.data.length);
        setRows(res.data.map(fromApi).map((s) => ({ name: s.name, course: s.course, batchId: s.batchId, due: s.due })));
      })
      .catch(() => {});
  }, []);

  const headers = ["শিক্ষার্থী", "কোর্স", "ব্যাচ", "মোট বকেয়া"];
  const tableRows = rows.map((r) => [r.name, r.course, batchName(r.batchId), r.due]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard title="মোট বকেয়া" value={`৳ ${stats.totalDue.toLocaleString()}`} icon={AlertCircle} variant="warning" />
        <StatCard title="বকেয়া শিক্ষার্থী" value={dueCount.toLocaleString("bn-BD")} icon={Users} variant="primary" />
      </div>
      <div className="flex justify-end">
        <ReportToolbar data={{ filename: "due-report", title: "বকেয়া রিপোর্ট", headers, rows: tableRows }} />
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {tableRows.length === 0 ? <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">কোনো বকেয়া নেই</TableCell></TableRow> :
              tableRows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={j === 3 ? "font-semibold text-destructive" : ""}>{j === 3 ? `৳ ${Number(c).toLocaleString()}` : c}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
