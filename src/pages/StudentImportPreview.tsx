import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatCard } from "@/components/StatCard";
import { ArrowLeft, CheckCircle2, ExternalLink, RotateCcw, Users, FileCheck2, AlertTriangle, Clock, XCircle, Ban, Loader2, X } from "lucide-react";
import { useAuth, ApiClientError } from "@/contexts/AuthContext";
import { useStudents } from "@/contexts/StudentContext";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";
import type {
  BulkApprovalOutcome, BulkApprovalSummary, PopulatedStudentRef, StudentImportListMeta,
  StudentImportRow, StudentImportSession, ValidRowIdsResponse,
} from "@/types/studentImport";

/**
 * Bulk Student Upload — preview + individual row approval
 * (/admission/import/:sessionId). This is the ONLY page that can turn
 * a previewed row into a real Student — it never trusts anything cached in
 * this component; every approve/reject re-fetches the row's authoritative
 * state from the backend (the backend re-validates on every approve too —
 * see studentImport.service.ts's revalidateRowForApproval), so a refresh or
 * a second admin acting on the same session can never desync this view for
 * long.
 */
function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

const VALIDATION_META: Record<StudentImportRow["validationStatus"], { label: string; className: string }> = {
  VALID: { label: "সঠিক", className: "bg-success/10 text-success border-success/20" },
  WARNING: { label: "সতর্কতা", className: "bg-warning/10 text-warning border-warning/20" },
  ERROR: { label: "ত্রুটি", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const IMPORT_STATUS_META: Record<StudentImportRow["importStatus"], { label: string; className: string }> = {
  PENDING: { label: "অপেক্ষমাণ", className: "bg-muted text-muted-foreground" },
  PROCESSING: { label: "প্রসেস হচ্ছে", className: "bg-info/10 text-info border-info/20" },
  APPROVED: { label: "✓ অনুমোদিত", className: "bg-success/10 text-success border-success/20" },
  REJECTED: { label: "বাতিল", className: "bg-muted text-muted-foreground" },
  FAILED: { label: "ব্যর্থ", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

function refName(ref?: string | PopulatedStudentRef): PopulatedStudentRef | undefined {
  return ref && typeof ref === "object" ? ref : undefined;
}

const BULK_OUTCOME_LABEL: Record<BulkApprovalOutcome, string> = {
  APPROVED: "অনুমোদিত",
  DUPLICATE: "ডুপ্লিকেট",
  INVALID: "অবৈধ",
  FAILED: "ব্যর্থ",
  SKIPPED: "বাদ পড়েছে",
};

export default function StudentImportPreview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const { refreshStudents } = useStudents();
  const navigate = useNavigate();

  const [session, setSession] = useState<StudentImportSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [rows, setRows] = useState<StudentImportRow[]>([]);
  const [rowsMeta, setRowsMeta] = useState<StudentImportListMeta | null>(null);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [importStatusFilter, setImportStatusFilter] = useState<string>("all");

  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<StudentImportRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<StudentImportRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Bulk approval — selection persists across page turns (a Set of row IDs,
  // not "current page only") so "Approve Selected" can act on a selection
  // built across several pages, not just whatever 20 rows happen to be
  // visible right now.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<{ rowIds: string[]; label: string } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [fetchingValidIds, setFetchingValidIds] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<BulkApprovalSummary | null>(null);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    setSessionLoading(true);
    try {
      setSession(await api.get<StudentImportSession>(`/students/import/${sessionId}`));
    } catch (err) {
      toast.error(friendlyError(err, "সেশন লোড করা যায়নি।"));
    } finally {
      setSessionLoading(false);
    }
  }, [sessionId]);

  const loadRows = useCallback(async () => {
    if (!sessionId) return;
    setRowsLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "20" });
      if (importStatusFilter !== "all") qs.set("importStatus", importStatusFilter);
      const res = await api.getWithMeta<StudentImportRow[]>(`/students/import/${sessionId}/rows?${qs.toString()}`);
      setRows(res.data);
      setRowsMeta((res.meta as unknown as StudentImportListMeta) ?? null);
    } catch (err) {
      toast.error(friendlyError(err, "সারিগুলো লোড করা যায়নি।"));
    } finally {
      setRowsLoading(false);
    }
  }, [sessionId, page, importStatusFilter]);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => { loadRows(); }, [loadRows]);

  if (!user || user.role !== "Admin") {
    return <Navigate to="/login" replace />;
  }
  if (!sessionId) {
    return <Navigate to="/admission/import" replace />;
  }

  const replaceRow = (updated: StudentImportRow) => {
    setRows((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
  };

  const doApprove = async () => {
    if (!approveTarget) return;
    const rowId = approveTarget._id;
    setBusyRowId(rowId);
    try {
      const updated = await api.post<StudentImportRow>(`/students/import/${sessionId}/rows/${rowId}/approve`);
      replaceRow(updated);
      if (updated.importStatus === "APPROVED") {
        toast.success("শিক্ষার্থী সফলভাবে যুক্ত করা হয়েছে।");
        // Bulk import creates the Student through its own backend endpoint,
        // never through StudentContext's addStudent/upsertLocal — without
        // this, the newly-created student would be invisible everywhere
        // else that reads the shared StudentContext cache (Student Profile,
        // Batch Assignment, Fee Management) until a full page reload.
        refreshStudents().catch(() => {});
      } else {
        toast.error(updated.failureReason || "অনুমোদন ব্যর্থ হয়েছে।");
      }
      loadSession();
    } catch (err) {
      toast.error(friendlyError(err, "অনুমোদন করা যায়নি।"));
      loadRows();
    } finally {
      setBusyRowId(null);
      setApproveTarget(null);
    }
  };

  const doReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) { toast.error("বাতিলের কারণ লিখুন।"); return; }
    const rowId = rejectTarget._id;
    setBusyRowId(rowId);
    try {
      const updated = await api.post<StudentImportRow>(`/students/import/${sessionId}/rows/${rowId}/reject`, { reason: rejectReason.trim() });
      replaceRow(updated);
      toast.success("সারিটি বাতিল করা হয়েছে।");
      loadSession();
    } catch (err) {
      toast.error(friendlyError(err, "বাতিল করা যায়নি।"));
      loadRows();
    } finally {
      setBusyRowId(null);
      setRejectTarget(null);
      setRejectReason("");
    }
  };

  const canApprove = (row: StudentImportRow) => row.importStatus === "PENDING" || row.importStatus === "FAILED";
  const canReject = (row: StudentImportRow) => row.importStatus === "PENDING" || row.importStatus === "FAILED";
  // A row must be approvable AND not already known-invalid (validationStatus
  // "ERROR" — missing required fields, an in-file duplicate, or a phone/roll
  // that already matches an existing Student) to be selectable for bulk
  // approval. "WARNING" rows (e.g. a new HSC institution, a roll-only
  // in-file repeat) stay selectable — the single-row approve flow already
  // allows approving those, this just extends the same rule to bulk.
  const isSelectable = (row: StudentImportRow) => canApprove(row) && row.validationStatus !== "ERROR";

  const selectableOnPage = rows.filter(isSelectable);
  const selectedOnPageCount = selectableOnPage.filter((r) => selectedIds.has(r._id)).length;
  const headerChecked: boolean | "indeterminate" =
    selectableOnPage.length === 0 || selectedOnPageCount === 0
      ? false
      : selectedOnPageCount === selectableOnPage.length
        ? true
        : "indeterminate";

  const toggleRow = (row: StudentImportRow, checked: boolean) => {
    if (!isSelectable(row)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(row._id); else next.delete(row._id);
      return next;
    });
  };

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of selectableOnPage) {
        if (checked) next.add(r._id); else next.delete(r._id);
      }
      return next;
    });
  };

  const openApproveSelected = () => {
    if (selectedIds.size === 0) return;
    const rowIds = Array.from(selectedIds);
    setBulkTarget({ rowIds, label: `নির্বাচিত ${rowIds.length.toLocaleString("bn-BD")} জন শিক্ষার্থী` });
  };

  const openApproveAllValid = async () => {
    if (!sessionId) return;
    setFetchingValidIds(true);
    try {
      const res = await api.get<ValidRowIdsResponse>(`/students/import/${sessionId}/rows/valid-ids`);
      if (res.count === 0) {
        toast.info("অনুমোদনযোগ্য কোনো সঠিক সারি নেই।");
        return;
      }
      setBulkTarget({ rowIds: res.rowIds, label: `সকল সঠিক ${res.count.toLocaleString("bn-BD")} জন শিক্ষার্থী` });
    } catch (err) {
      toast.error(friendlyError(err, "সঠিক সারিগুলোর তালিকা আনা যায়নি।"));
    } finally {
      setFetchingValidIds(false);
    }
  };

  const doBulkApprove = async () => {
    if (!bulkTarget || !sessionId) return;
    setBulkBusy(true);
    try {
      const summary = await api.post<BulkApprovalSummary>(`/students/import/${sessionId}/rows/bulk-approve`, { rowIds: bulkTarget.rowIds });
      setBulkSummary(summary);
      setSelectedIds(new Set());
      if (summary.approved > 0) {
        // Same reason as the single-row approve flow above — bulk-created
        // Students bypass StudentContext entirely, so it must be told
        // explicitly or they'd stay invisible elsewhere until a reload.
        refreshStudents().catch(() => {});
      }
      // Refresh in place — re-fetches only this page's rows + the session's
      // own counters, never a full app reload (§"update Preview state in
      // place").
      loadSession();
      loadRows();
    } catch (err) {
      toast.error(friendlyError(err, "বাল্ক অনুমোদন ব্যর্থ হয়েছে।"));
    } finally {
      setBulkBusy(false);
      setBulkTarget(null);
    }
  };

  const bulkProblemRows = bulkSummary?.results.filter((r) => r.outcome !== "APPROVED") ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admission/import")} title="আপলোড পাতায় ফিরে যান">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{session?.originalFileName || "প্রিভিউ"}</h1>
            <p className="text-sm text-muted-foreground">
              প্রতিটি সারি যাচাই করে একে একে অনুমোদন দিন — অনুমোদনের আগ পর্যন্ত কোনো শিক্ষার্থী তৈরি হবে না।
              {session && <> নির্বাচিত কোর্স: <span className="font-medium text-foreground">{session.courseName}</span> — প্রতিটি অনুমোদিত শিক্ষার্থী এই কোর্সেই ভর্তি হবে। ব্যাচ ও ফি/পেমেন্ট পরে যোগ করতে হবে।</>}
            </p>
          </div>
        </div>

        {session && session.headerWarnings.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            {session.headerWarnings.join(" ")}
          </div>
        )}

        {sessionLoading || !session ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard title="মোট সারি" value={session.totalRows.toLocaleString("bn-BD")} icon={Users} variant="primary" />
            <StatCard title="সঠিক" value={session.validRows.toLocaleString("bn-BD")} icon={FileCheck2} variant="success" />
            <StatCard title="ত্রুটি" value={session.errorRows.toLocaleString("bn-BD")} icon={AlertTriangle} variant="warning" />
            <StatCard title="অপেক্ষমাণ" value={session.pendingRows.toLocaleString("bn-BD")} icon={Clock} variant="info" />
            <StatCard title="অনুমোদিত" value={session.approvedRows.toLocaleString("bn-BD")} icon={CheckCircle2} variant="success" />
            <StatCard title="বাতিল" value={session.rejectedRows.toLocaleString("bn-BD")} icon={Ban} variant="primary" />
            <StatCard title="ব্যর্থ" value={session.failedRows.toLocaleString("bn-BD")} icon={XCircle} variant="warning" />
          </div>
        )}

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">সারিসমূহ</CardTitle>
              <Select value={importStatusFilter} onValueChange={(v) => { setImportStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সকল স্ট্যাটাস</SelectItem>
                  <SelectItem value="PENDING">অপেক্ষমাণ</SelectItem>
                  <SelectItem value="APPROVED">অনুমোদিত</SelectItem>
                  <SelectItem value="REJECTED">বাতিল</SelectItem>
                  <SelectItem value="FAILED">ব্যর্থ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-row items-center justify-between gap-3 flex-wrap rounded-lg border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                {selectedIds.size > 0 ? (
                  <>
                    <span className="font-medium">{selectedIds.size.toLocaleString("bn-BD")} টি নির্বাচিত</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedIds(new Set())}
                      disabled={bulkBusy}
                    >
                      <X className="h-3.5 w-3.5" /> নির্বাচন বাতিল
                    </button>
                  </>
                ) : (
                  <span className="text-muted-foreground">কোনো সারি নির্বাচিত নয়</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {bulkBusy && bulkTarget ? (
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> {bulkTarget.rowIds.length.toLocaleString("bn-BD")} জন শিক্ষার্থী অনুমোদন হচ্ছে... পাতাটি বন্ধ করবেন না।
                  </span>
                ) : (
                  <>
                    <Button size="sm" variant="outline" disabled={selectedIds.size === 0 || bulkBusy} onClick={openApproveSelected}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> নির্বাচিত অনুমোদন করুন
                    </Button>
                    <Button size="sm" disabled={bulkBusy || fetchingValidIds} onClick={openApproveAllValid}>
                      {fetchingValidIds ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5 mr-1" />}
                      সকল সঠিক অনুমোদন করুন
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rowsLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">কোনো সারি পাওয়া যায়নি।</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={headerChecked}
                          onCheckedChange={(v) => toggleSelectAllOnPage(v === true)}
                          disabled={selectableOnPage.length === 0 || bulkBusy}
                          aria-label="এই পাতার সকল অনুমোদনযোগ্য সারি নির্বাচন করুন"
                        />
                      </TableHead>
                      <TableHead>সারি</TableHead>
                      <TableHead>রোল/রেজিস্ট্রেশন</TableHead>
                      <TableHead>নাম</TableHead>
                      <TableHead>জন্ম তারিখ</TableHead>
                      <TableHead>মোবাইল</TableHead>
                      <TableHead>লিঙ্গ</TableHead>
                      <TableHead>অভিভাবক</TableHead>
                      <TableHead>যাচাই স্ট্যাটাস</TableHead>
                      <TableHead>অনুমোদন স্ট্যাটাস</TableHead>
                      <TableHead className="text-right">অ্যাকশন</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const p = row.parsed;
                      const vMeta = VALIDATION_META[row.validationStatus];
                      const iMeta = IMPORT_STATUS_META[row.importStatus];
                      const createdRef = refName(row.createdStudentId);
                      const existingRef = refName(row.matchesExistingStudentId);
                      const busy = busyRowId === row._id;
                      const selectable = isSelectable(row);
                      return (
                        <TableRow key={row._id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(row._id)}
                              onCheckedChange={(v) => toggleRow(row, v === true)}
                              disabled={!selectable || bulkBusy}
                              title={selectable ? undefined : "এই সারিটি বাল্ক অনুমোদনের জন্য প্রস্তুত নয়"}
                              aria-label={`সারি ${row.rowNumber} নির্বাচন করুন`}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{row.rowNumber}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{p.rollNumber || "—"}</TableCell>
                          <TableCell className="text-sm font-medium whitespace-nowrap">{p.name || "—"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{p.dob || "—"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{p.phone || "—"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{p.gender || "—"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {p.guardianName || p.guardianMobile ? (
                              <>
                                {p.guardianName || "—"}
                                {p.guardianMobile && <span className="text-muted-foreground"> ({p.guardianMobile})</span>}
                              </>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="outline" className={vMeta.className}>{vMeta.label}</Badge>
                              {row.validationMessages.length > 0 && (
                                <p className="text-xs text-muted-foreground max-w-[220px]">{row.validationMessages.join(" ")}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="outline" className={iMeta.className}>{iMeta.label}</Badge>
                              {row.importStatus === "APPROVED" && createdRef && (
                                <button
                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                  onClick={() => navigate(`/students/${createdRef._id}`)}
                                >
                                  {createdRef.currentRollNumber || createdRef.registrationId || "প্রোফাইল"} <ExternalLink className="h-3 w-3" />
                                </button>
                              )}
                              {row.importStatus === "FAILED" && row.failureReason && (
                                <p className="text-xs text-destructive max-w-[220px]">{row.failureReason}</p>
                              )}
                              {row.importStatus === "REJECTED" && row.rejectionReason && (
                                <p className="text-xs text-muted-foreground max-w-[220px]">কারণ: {row.rejectionReason}</p>
                              )}
                              {existingRef && row.importStatus !== "APPROVED" && (
                                <p className="text-xs text-muted-foreground max-w-[220px]">সদৃশ: {existingRef.name} ({existingRef.registrationId || existingRef.phone})</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap space-x-1.5">
                            {canApprove(row) && (
                              <Button size="sm" onClick={() => setApproveTarget(row)} disabled={busy}>
                                {row.importStatus === "FAILED" ? <><RotateCcw className="h-3.5 w-3.5 mr-1" /> পুনরায় চেষ্টা</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> অনুমোদন</>}
                              </Button>
                            )}
                            {canReject(row) && (
                              <Button size="sm" variant="outline" onClick={() => setRejectTarget(row)} disabled={busy}>
                                <XCircle className="h-3.5 w-3.5 mr-1" /> বাতিল
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {rowsMeta && rowsMeta.totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 p-4 border-t">
                <Button variant="outline" size="sm" disabled={rowsMeta.page <= 1} onClick={() => setPage(rowsMeta.page - 1)}>পূর্ববর্তী</Button>
                <span className="text-sm text-muted-foreground">পৃষ্ঠা {rowsMeta.page} / {rowsMeta.totalPages}</span>
                <Button variant="outline" size="sm" disabled={rowsMeta.page >= rowsMeta.totalPages} onClick={() => setPage(rowsMeta.page + 1)}>পরবর্তী</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>আপনি কি এই শিক্ষার্থীকে যুক্ত করতে চান?</AlertDialogTitle>
            <AlertDialogDescription>
              {approveTarget?.parsed.name} ({approveTarget?.parsed.phone}) — কোর্স: {session?.courseName || "—"}। অনুমোদনের সাথে সাথেই সিস্টেমে একজন স্থায়ী শিক্ষার্থী তৈরি হবে (ব্যাচ ও ফি/পেমেন্ট পরে যোগ করতে হবে)।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyRowId}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={doApprove} disabled={!!busyRowId}>
              {busyRowId ? "প্রসেস হচ্ছে..." : "নিশ্চিত করুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>সারি বাতিল করুন — {rejectTarget?.parsed.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              placeholder="বাতিলের কারণ লিখুন..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={300}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }} disabled={!!busyRowId}>বাতিল</Button>
            <Button variant="destructive" onClick={doReject} disabled={!!busyRowId || !rejectReason.trim()}>
              {busyRowId ? "প্রসেস হচ্ছে..." : "নিশ্চিত করে বাতিল করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!bulkTarget} onOpenChange={(o) => !o && !bulkBusy && setBulkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkTarget?.label} অনুমোদন করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              অনুমোদনের সাথে সাথেই সিস্টেমে {bulkTarget?.rowIds.length.toLocaleString("bn-BD")} জন স্থায়ী শিক্ষার্থী তৈরি হবে (কোর্স: {session?.courseName || "—"})। যেসব সারিতে সমস্যা দেখা দেবে (ডুপ্লিকেট/অবৈধ) সেগুলো বাদ দিয়ে বাকিরা সফলভাবে যুক্ত হবে — এই কাজটি বাতিল করা যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={doBulkApprove} disabled={bulkBusy}>
              {bulkTarget ? `${bulkTarget.rowIds.length.toLocaleString("bn-BD")} জন শিক্ষার্থী অনুমোদন করুন` : "অনুমোদন করুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!bulkSummary} onOpenChange={(o) => !o && setBulkSummary(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>বাল্ক অনুমোদনের ফলাফল</DialogTitle>
          </DialogHeader>
          {bulkSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <StatCard title="অনুমোদিত" value={bulkSummary.approved.toLocaleString("bn-BD")} icon={CheckCircle2} variant="success" />
                <StatCard title="ডুপ্লিকেট" value={bulkSummary.duplicate.toLocaleString("bn-BD")} icon={Ban} variant="warning" />
                <StatCard title="অবৈধ" value={bulkSummary.invalid.toLocaleString("bn-BD")} icon={AlertTriangle} variant="warning" />
                <StatCard title="ব্যর্থ" value={bulkSummary.failed.toLocaleString("bn-BD")} icon={XCircle} variant="warning" />
                <StatCard title="বাদ পড়েছে" value={bulkSummary.skipped.toLocaleString("bn-BD")} icon={Clock} variant="info" />
                <StatCard title="মোট" value={bulkSummary.total.toLocaleString("bn-BD")} icon={Users} variant="primary" />
              </div>
              {bulkProblemRows.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1.5">যেসব সারি অনুমোদিত হয়নি:</p>
                  <div className="max-h-52 overflow-y-auto rounded-md border divide-y text-sm">
                    {bulkProblemRows.map((r) => (
                      <div key={r.rowId} className="flex items-start justify-between gap-3 p-2">
                        <span className="whitespace-nowrap text-muted-foreground">সারি {r.rowNumber}</span>
                        <span className="text-right">
                          <Badge variant="outline" className="mb-0.5">{BULK_OUTCOME_LABEL[r.outcome]}</Badge>
                          {r.reason && <span className="block text-xs text-muted-foreground max-w-[260px]">{r.reason}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setBulkSummary(null)}>বন্ধ করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
