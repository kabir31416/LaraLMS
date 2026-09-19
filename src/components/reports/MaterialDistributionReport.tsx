import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { Package, PackageCheck, PackageOpen } from "lucide-react";
import { api } from "@/lib/apiClient";
import type { MaterialWiseReportRow } from "@/types/material";
import { ReportToolbar } from "./ReportToolbar";

/** Material-wise distribution report (Coaching Material Inventory §16D) — replaces the old library-style "Book Distribution" report. */
export default function MaterialDistributionReport() {
  const [rows, setRows] = useState<MaterialWiseReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<MaterialWiseReportRow[]>("/materials/reports/material-wise")
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const headers = ["ম্যাটেরিয়াল", "মোট স্টক", "মোট বিতরণ", "বাকি স্টক"];
  const dataRows = rows.map((r) => [r.name, r.totalStock, r.totalDistributed, r.remainingStock]);
  const totals = rows.reduce((acc, r) => ({
    stock: acc.stock + r.totalStock,
    distributed: acc.distributed + r.totalDistributed,
    remaining: acc.remaining + r.remainingStock,
  }), { stock: 0, distributed: 0, remaining: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="মোট স্টক" value={totals.stock.toLocaleString("bn-BD")} icon={Package} variant="primary" />
        <StatCard title="মোট বিতরণ" value={totals.distributed.toLocaleString("bn-BD")} icon={PackageCheck} variant="success" />
        <StatCard title="বাকি স্টক" value={totals.remaining.toLocaleString("bn-BD")} icon={PackageOpen} variant="info" />
      </div>
      <div className="flex justify-end"><ReportToolbar data={{ filename: "material-distribution", title: "ম্যাটেরিয়াল বিতরণ রিপোর্ট", headers, rows: dataRows }} /></div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</TableCell></TableRow>
            ) : dataRows.length === 0 ? (
              <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">কোনো ম্যাটেরিয়াল বিতরণ হয়নি</TableCell></TableRow>
            ) : (
              dataRows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
