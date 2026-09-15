import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { FileSpreadsheet, Printer } from "lucide-react";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { exportExcel, printReport } from "@/lib/exporters";
import type { ChanceResult, ChanceResultListMeta } from "@/types/chanceResult";
import { ChanceFilters, buildFilterQuery } from "./chanceResultFilters";
import { toast } from "sonner";

const PAGE_SIZE = 20;

function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

function selectionLabel(t: string): string {
  return t === "Merit" ? "মেধা" : "উপজাতি";
}

interface Props {
  filters: ChanceFilters;
  isAdmin: boolean;
  refreshKey: number;
}

export function ChanceStudentsList({ filters, isAdmin, refreshKey }: Props) {
  const [items, setItems] = useState<ChanceResult[]>([]);
  const [meta, setMeta] = useState<ChanceResultListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildFilterQuery(filters, isAdmin, { page: String(page), limit: String(PAGE_SIZE) });
      const res = await api.getWithMeta<ChanceResult[]>(`/admission-results?${qs.toString()}`);
      setItems(res.data);
      setMeta((res.meta as unknown as ChanceResultListMeta) ?? null);
    } catch (err) {
      setError(friendlyError(err, "তালিকা লোড করা যায়নি।"));
    } finally {
      setLoading(false);
    }
  }, [filters, isAdmin, page]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setPage(1); }, [filters]);

  const toRows = (list: ChanceResult[]) => list.map((r) => [
    r.studentName, r.studentRoll || "—", r.batchName || "—", r.phone || "—",
    r.admissionRoll, r.instituteName, r.programName, r.session,
    selectionLabel(r.selectionType), r.resultRound,
  ]);
  const headers = ["নাম", "স্টুডেন্ট রোল", "ব্যাচ", "মোবাইল", "ভর্তি রোল", "ইনস্টিটিউট", "প্রোগ্রাম", "সেশন", "নির্বাচন", "রাউন্ড"];

  /** Export/print always reflects the CURRENT filters across the full result set, not just the page on screen — so this re-fetches every matching row (capped generously) rather than exporting only the visible 20. */
  const fetchAllFiltered = async (): Promise<ChanceResult[]> => {
    const qs = buildFilterQuery(filters, isAdmin, { page: "1", limit: "5000" });
    const res = await api.getWithMeta<ChanceResult[]>(`/admission-results?${qs.toString()}`);
    return res.data;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const all = await fetchAllFiltered();
      if (all.length === 0) { toast.error("এক্সপোর্ট করার মতো কোনো তথ্য নেই।"); return; }
      exportExcel({ filename: "chance-students", title: "চান্স স্টুডেন্ট তালিকা", headers, rows: toRows(all) });
    } catch (err) {
      toast.error(friendlyError(err, "এক্সপোর্ট ব্যর্থ হয়েছে।"));
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    setExporting(true);
    try {
      const all = await fetchAllFiltered();
      if (all.length === 0) { toast.error("প্রিন্ট করার মতো কোনো তথ্য নেই।"); return; }
      printReport("চান্স স্টুডেন্ট তালিকা", headers, toRows(all));
    } catch (err) {
      toast.error(friendlyError(err, "প্রিন্ট ব্যর্থ হয়েছে।"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="border-none shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <p className="text-sm text-muted-foreground">
          {meta ? `মোট ${meta.total.toLocaleString("bn-BD")} জন চান্সপ্রাপ্ত শিক্ষার্থী` : "লোড হচ্ছে..."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={exporting}>
            <Printer className="h-3.5 w-3.5 mr-1.5" /> প্রিন্ট
          </Button>
        </div>
      </div>

      {loading ? (
        <CardContent className="p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      ) : error ? (
        <CardContent className="py-12 text-center space-y-3">
          <p className="text-destructive font-medium">{error}</p>
          <Button variant="outline" onClick={load}>আবার চেষ্টা করুন</Button>
        </CardContent>
      ) : items.length === 0 ? (
        <CardContent className="py-12 text-center text-muted-foreground">কোনো চান্সপ্রাপ্ত শিক্ষার্থী পাওয়া যায়নি।</CardContent>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>নাম</TableHead>
                  <TableHead>স্টুডেন্ট রোল</TableHead>
                  <TableHead>ব্যাচ</TableHead>
                  <TableHead>ভর্তি রোল</TableHead>
                  <TableHead>ইনস্টিটিউট</TableHead>
                  <TableHead>প্রোগ্রাম</TableHead>
                  <TableHead>সেশন</TableHead>
                  <TableHead>নির্বাচন</TableHead>
                  <TableHead>রাউন্ড</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell className="font-mono text-sm">{r.studentRoll || "—"}</TableCell>
                    <TableCell>{r.batchName || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{r.admissionRoll}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{r.instituteName}</span>
                        {r.instituteCode && <span className="text-xs text-muted-foreground">কোড: {r.instituteCode}</span>}
                      </div>
                    </TableCell>
                    <TableCell>{r.programName}</TableCell>
                    <TableCell>{r.session}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.selectionType === "Merit" ? "bg-primary/10 text-primary border-primary/20" : "bg-info/10 text-info border-info/20"}>
                        {selectionLabel(r.selectionType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.resultRound}</Badge>
                      {r.matchedManually && <Badge variant="outline" className="ml-1 text-xs bg-warning/10 text-warning border-warning/20">ম্যানুয়াল</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
              <p className="text-sm text-muted-foreground">
                মোট {meta.total.toLocaleString("bn-BD")} জনের মধ্যে {((meta.page - 1) * meta.limit + 1).toLocaleString("bn-BD")}–
                {Math.min(meta.page * meta.limit, meta.total).toLocaleString("bn-BD")} জন দেখানো হচ্ছে
              </p>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      className={meta.page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      onClick={() => meta.page > 1 && setPage(meta.page - 1)}
                    />
                  </PaginationItem>
                  {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1)
                    .map((p, idx, arr) => (
                      <PaginationItem key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 ? <span className="px-2 text-muted-foreground">…</span> : null}
                        <PaginationLink isActive={p === meta.page} className="cursor-pointer" onClick={() => setPage(p)}>
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      className={meta.page >= meta.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      onClick={() => meta.page < meta.totalPages && setPage(meta.page + 1)}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
