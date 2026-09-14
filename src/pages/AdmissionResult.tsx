import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Users, CheckCircle2, AlertTriangle, Pencil, Plus, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { api } from "@/lib/apiClient";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { AdmissionResultStudent, AdmissionRollStats, AdmissionRollStatusFilter, ListMeta } from "@/types/admissionResult";
import { toast } from "sonner";

/**
 * Admission Result (Admin + Batch Director portals). Unlike the existing
 * Students page (which loads up to 100 rows and filters/searches entirely
 * client-side), this page does real server-side pagination/search/filter
 * against GET /students — required because a coaching centre's admission
 * cohort can run into the hundreds, and because a Batch Director's
 * authorization must be enforced by the backend query itself (student.
 * controller.ts already forces `directorId` server-side for any caller
 * without STUDENTS_READ), never by hiding a batch selector in this UI.
 *
 * Foundation for the future Admission Result PDF import: the stored
 * `admissionRoll` on each Student is exactly what a parsed official result
 * will be matched against.
 */
const PAGE_SIZE = 20;

function normalizeDigits(input: string): string {
  const bn = "০১২৩৪৫৬৭৮৯";
  return input.replace(/[০-৯]/g, (d) => String(bn.indexOf(d)));
}

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message;
  return fallback;
}

export default function AdmissionResult() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const { batches } = useBatches();
  const { courses } = useAcademic();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [batchId, setBatchId] = useState("all");
  const [course, setCourse] = useState("all");
  const [status, setStatus] = useState<AdmissionRollStatusFilter>("all");
  const [page, setPage] = useState(1);

  const [students, setStudents] = useState<AdmissionResultStudent[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [stats, setStats] = useState<AdmissionRollStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<AdmissionResultStudent | null>(null);
  const [rollInput, setRollInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const batchName = useCallback((id?: string) => batches.find((b) => b.id === id)?.name || "—", [batches]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listParams = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      const statsParams = new URLSearchParams();
      if (debouncedSearch.trim()) listParams.set("search", debouncedSearch.trim());
      if (status !== "all") listParams.set("admissionRollStatus", status);
      // Batch/course scoping is admin-only UI — a Batch Director never sends
      // these at all, and the backend force-scopes to their own batch(es)
      // regardless of what a manipulated request might try to send anyway.
      if (isAdmin && batchId !== "all") { listParams.set("batchId", batchId); statsParams.set("batchId", batchId); }
      if (isAdmin && course !== "all") { listParams.set("course", course); statsParams.set("course", course); }

      const [listRes, statsData] = await Promise.all([
        api.getWithMeta<AdmissionResultStudent[]>(`/students?${listParams.toString()}`),
        api.get<AdmissionRollStats>(`/students/stats/admission-roll?${statsParams.toString()}`),
      ]);
      setStudents(listRes.data);
      setMeta((listRes.meta as unknown as ListMeta) ?? null);
      setStats(statsData);
    } catch (err) {
      setError(friendlyError(err, "শিক্ষার্থী তালিকা লোড করা যায়নি।"));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, batchId, course, isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  if (!user || (user.role !== "Admin" && user.role !== "Batch Director")) {
    return <Navigate to="/login" replace />;
  }

  const openEditor = (s: AdmissionResultStudent) => {
    setEditTarget(s);
    setRollInput(s.admissionRoll || "");
  };

  const handleSaveClick = () => {
    const trimmed = rollInput.trim();
    if (!trimmed) { toast.error("ভর্তি রোল আবশ্যক।"); return; }
    if (!/^[0-9০-৯]+$/.test(trimmed)) { toast.error("ভর্তি রোল শুধুমাত্র সংখ্যা হতে হবে।"); return; }
    setConfirmOpen(true);
  };

  const doSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const isEdit = !!editTarget.admissionRoll;
      const updated = await api.patch<AdmissionResultStudent>(`/students/${editTarget._id}/admission-roll`, {
        admissionRoll: normalizeDigits(rollInput.trim()),
      });
      setStudents((prev) => prev.map((s) => (s._id === updated._id ? { ...s, admissionRoll: updated.admissionRoll } : s)));
      toast.success(isEdit ? "ভর্তি রোল হালনাগাদ করা হয়েছে।" : "ভর্তি রোল যোগ করা হয়েছে।");
      setConfirmOpen(false);
      setEditTarget(null);
      const statsParams = new URLSearchParams();
      if (isAdmin && batchId !== "all") statsParams.set("batchId", batchId);
      if (isAdmin && course !== "all") statsParams.set("course", course);
      api.get<AdmissionRollStats>(`/students/stats/admission-roll?${statsParams.toString()}`).then(setStats).catch(() => {});
    } catch (err) {
      toast.error(friendlyError(err, "সংরক্ষণ ব্যর্থ হয়েছে।"));
    } finally {
      setSaving(false);
    }
  };

  const uniqueCourseNames = Array.from(new Set(courses.map((c) => c.name)));

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">ভর্তি ফলাফল (Admission Result)</h1>
          <p className="text-sm text-muted-foreground">প্রতিটি শিক্ষার্থীর অফিসিয়াল ভর্তি পরীক্ষার রোল নম্বর সংরক্ষণ করুন</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="মোট শিক্ষার্থী" value={stats ? stats.total.toLocaleString("bn-BD") : "—"} icon={Users} variant="primary" />
          <StatCard title="ভর্তি রোল যোগ হয়েছে" value={stats ? stats.added.toLocaleString("bn-BD") : "—"} icon={CheckCircle2} variant="success" />
          <StatCard title="ভর্তি রোল বাকি" value={stats ? stats.missing.toLocaleString("bn-BD") : "—"} icon={AlertTriangle} variant="warning" />
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="নাম, স্টুডেন্ট রোল, মোবাইল বা ভর্তি রোল দিয়ে খুঁজুন..."
                  className="pl-9"
                />
              </div>

              {isAdmin && (
                <Select value={batchId} onValueChange={(v) => { setBatchId(v); setPage(1); }}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="ব্যাচ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সকল ব্যাচ</SelectItem>
                    <SelectItem value="unassigned">Batch assigned হয়নি</SelectItem>
                    {batches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}

              {isAdmin && (
                <Select value={course} onValueChange={(v) => { setCourse(v); setPage(1); }}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="কোর্স" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সকল কোর্স</SelectItem>
                    {uniqueCourseNames.map((name) => (<SelectItem key={name} value={name}>{name}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}

              <Select value={status} onValueChange={(v) => { setStatus(v as AdmissionRollStatusFilter); setPage(1); }}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="ভর্তি রোল স্ট্যাটাস" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সকল স্ট্যাটাস</SelectItem>
                  <SelectItem value="added">Added</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={load} title="রিফ্রেশ"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          {loading ? (
            <CardContent className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground text-center pb-2">শিক্ষার্থী লোড হচ্ছে...</p>
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </CardContent>
          ) : error ? (
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-destructive font-medium">{error}</p>
              <Button variant="outline" onClick={load}>আবার চেষ্টা করুন</Button>
            </CardContent>
          ) : students.length === 0 ? (
            <CardContent className="py-12 text-center text-muted-foreground">কোনো শিক্ষার্থী পাওয়া যায়নি।</CardContent>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>স্টুডেন্ট রোল</TableHead>
                    <TableHead>নাম</TableHead>
                    <TableHead>ব্যাচ</TableHead>
                    <TableHead>মোবাইল</TableHead>
                    <TableHead>ভর্তি রোল</TableHead>
                    <TableHead>স্ট্যাটাস</TableHead>
                    <TableHead className="text-right">অ্যাকশন</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell className="font-mono text-sm">{s.currentRollNumber || "—"}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{batchName(s.currentBatchId)}</TableCell>
                      <TableCell className="text-sm">{s.phone}</TableCell>
                      <TableCell className="font-mono text-sm">{s.admissionRoll || "—"}</TableCell>
                      <TableCell>
                        {s.admissionRoll ? (
                          <Badge className="bg-success/10 text-success border-success/20">Added</Badge>
                        ) : (
                          <Badge className="bg-warning/10 text-warning border-warning/20">Missing</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEditor(s)}>
                          {s.admissionRoll ? (<><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</>) : (<><Plus className="h-3.5 w-3.5 mr-1" /> Add</>)}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

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
      </div>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget?.admissionRoll ? "ভর্তি রোল সম্পাদনা" : "ভর্তি রোল যোগ করুন"}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/40 rounded-lg p-3">
                <div><p className="text-xs text-muted-foreground">শিক্ষার্থীর নাম</p><p className="font-medium">{editTarget.name}</p></div>
                <div><p className="text-xs text-muted-foreground">স্টুডেন্ট রোল</p><p className="font-medium">{editTarget.currentRollNumber || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">ব্যাচ</p><p className="font-medium">{batchName(editTarget.currentBatchId)}</p></div>
                <div><p className="text-xs text-muted-foreground">মোবাইল</p><p className="font-medium">{editTarget.phone}</p></div>
              </div>
              <div className="space-y-1.5">
                <Label>ভর্তি রোল (Admission Roll) *</Label>
                <Input
                  value={rollInput}
                  onChange={(e) => setRollInput(e.target.value.replace(/[^0-9০-৯]/g, ""))}
                  inputMode="numeric"
                  placeholder="যেমন: ১১১০৬৩৭"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditTarget(null)}>বাতিল</Button>
                <Button onClick={handleSaveClick}>{editTarget.admissionRoll ? "হালনাগাদ" : "সংরক্ষণ"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ভর্তি রোল নিশ্চিত করুন</AlertDialogTitle>
            <AlertDialogDescription>
              {editTarget?.name}-এর জন্য ভর্তি রোল <span className="font-semibold text-foreground">{rollInput}</span> {editTarget?.admissionRoll ? "হালনাগাদ" : "সংরক্ষণ"} করতে চান?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={doSave} disabled={saving}>
              {saving ? "সংরক্ষণ হচ্ছে..." : editTarget?.admissionRoll ? "হালনাগাদ" : "সংরক্ষণ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
