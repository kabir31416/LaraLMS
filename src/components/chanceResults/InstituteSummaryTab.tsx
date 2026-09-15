import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Printer, Eye } from "lucide-react";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { exportExcel, printReport } from "@/lib/exporters";
import type { InstituteSummaryRow } from "@/types/chanceResult";
import { ChanceFilters, buildFilterQuery } from "./chanceResultFilters";

interface Props {
  filters: ChanceFilters;
  isAdmin: boolean;
  refreshKey: number;
  onViewStudents: (instituteName: string) => void;
}

export function InstituteSummaryTab({ filters, isAdmin, refreshKey, onViewStudents }: Props) {
  const [rows, setRows] = useState<InstituteSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildFilterQuery(filters, isAdmin);
      const data = await api.get<InstituteSummaryRow[]>(`/admission-results/institutes?${qs.toString()}`);
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "তথ্য লোড করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, [filters, isAdmin]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const headers = ["ইনস্টিটিউট", "কোড", "আসন সংখ্যা", "চান্সপ্রাপ্ত"];
  const toRows = () => rows.map((r) => [r.instituteName, r.instituteCode || "—", r.seatCapacity ?? "—", r.selected]);

  return (
    <Card className="border-none shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <p className="text-sm text-muted-foreground">{rows.length.toLocaleString("bn-BD")}টি ইনস্টিটিউট</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportExcel({ filename: "institute-wise-result", title: "ইনস্টিটিউট অনুযায়ী চান্স রেজাল্ট", headers, rows: toRows() })} disabled={rows.length === 0}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => printReport("ইনস্টিটিউট অনুযায়ী চান্স রেজাল্ট", headers, toRows())} disabled={rows.length === 0}>
            <Printer className="h-3.5 w-3.5 mr-1.5" /> প্রিন্ট
          </Button>
        </div>
      </div>

      {loading ? (
        <CardContent className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent>
      ) : error ? (
        <CardContent className="py-12 text-center space-y-3">
          <p className="text-destructive font-medium">{error}</p>
          <Button variant="outline" onClick={load}>আবার চেষ্টা করুন</Button>
        </CardContent>
      ) : rows.length === 0 ? (
        <CardContent className="py-12 text-center text-muted-foreground">কোনো তথ্য পাওয়া যায়নি।</CardContent>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ইনস্টিটিউট</TableHead>
              <TableHead>কোড</TableHead>
              <TableHead className="text-center">আসন সংখ্যা</TableHead>
              <TableHead className="text-center">চান্সপ্রাপ্ত</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.instituteName}>
                <TableCell className="font-medium">{r.instituteName}</TableCell>
                <TableCell className="font-mono text-sm">{r.instituteCode || "—"}</TableCell>
                <TableCell className="text-center">{r.seatCapacity ?? "—"}</TableCell>
                <TableCell className="text-center font-semibold text-success">{r.selected}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => onViewStudents(r.instituteName)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> স্টুডেন্ট দেখুন
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
