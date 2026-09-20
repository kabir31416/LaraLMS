import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Cake } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { fromApi, type ApiStudent } from "@/contexts/StudentContext";
import { isBirthdayToday } from "@/lib/date";
import { api } from "@/lib/apiClient";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Student } from "@/types/student";

const PAGE_SIZE = 20;

interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * "আমার শিক্ষার্থী" (my students) — server-paginated and server-scoped
 * directly against `/students`, never StudentContext's own capped ≤100-row
 * global list (a Director's students, filtered client-side over that list,
 * would silently drop any of their own students who fall outside the cap
 * once total students across the whole institution grow). The backend
 * itself force-scopes this to the caller's own batches for a Director-only
 * permission holder (student.controller.ts's scopeToOwnBatchIfNeeded), so
 * no explicit directorId needs to be sent — it's already enforced server-side.
 */
const DirectorStudents = () => {
  const { user } = useAuth();
  const { batches } = useBatches();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [batchFilter, setBatchFilter] = useState("all");
  const [birthdayOnly, setBirthdayOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [list, setList] = useState<Student[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const myBatches = useMemo(
    () => (user ? batches.filter((b) => b.directorId === user.staffId) : []),
    [batches, user],
  );

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
    if (batchFilter !== "all") qs.set("batchId", batchFilter);
    if (birthdayOnly) qs.set("birthdayToday", "true");
    api.getWithMeta<ApiStudent[]>(`/students?${qs.toString()}`)
      .then((res) => {
        setList(res.data.map(fromApi));
        setMeta((res.meta as unknown as ListMeta) ?? null);
      })
      .catch(() => { setList([]); setMeta(null); })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, batchFilter, birthdayOnly]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, batchFilter, birthdayOnly]);

  if (!user || user.role !== "Batch Director") {
    return <Navigate to="/login" replace />;
  }

  const batchOf = (batchId?: string) => myBatches.find((b) => b.id === batchId);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">আমার শিক্ষার্থী</h1>
          <p className="text-sm text-muted-foreground">মোট {meta?.total ?? 0} জন</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, আইডি বা মোবাইল..." className="pl-9" />
          </div>
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="ব্যাচ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সকল ব্যাচ</SelectItem>
              {myBatches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <button
            onClick={() => setBirthdayOnly((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              birthdayOnly
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            <Cake className="h-4 w-4" /> আজকের জন্মদিন
          </button>
        </div>

        <Card className="border-none shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">ছবি</TableHead>
                <TableHead>আইডি</TableHead>
                <TableHead>নাম</TableHead>
                <TableHead>রোল</TableHead>
                <TableHead>ব্যাচ</TableHead>
                <TableHead>মোবাইল</TableHead>
                <TableHead>অভিভাবকের নম্বর</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">কোনো শিক্ষার্থী নেই</TableCell></TableRow>
              ) : (
                list.map((s) => {
                  const b = batchOf(s.batchId);
                  const isBirthday = isBirthdayToday(s.dob);
                  return (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/students/${s.id}`)}>
                      <TableCell>
                        <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{s.name.charAt(0)}</AvatarFallback></Avatar>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.studentId}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {s.name}
                          {isBirthday && (
                            <Badge className="bg-pink-500/10 text-pink-600 border-pink-500/20 gap-1">
                              <Cake className="h-3 w-3" /> আজ জন্মদিন
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.rollNumber || "—"}</TableCell>
                      <TableCell>{b?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{s.mobile}</TableCell>
                      <TableCell className="text-sm">{s.guardianMobile || "—"}</TableCell>
                      <TableCell>
                        <Badge className={s.status === "সক্রিয়" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {meta && meta.totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={meta.page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1)
                .map((p, idx, arr) => (
                  <PaginationItem key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 ? <span className="px-2 text-muted-foreground">…</span> : null}
                    <PaginationLink isActive={p === meta.page} onClick={() => setPage(p)} className="cursor-pointer">
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  className={meta.page >= meta.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DirectorStudents;
