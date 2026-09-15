import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eye, RotateCcw, CheckCircle2, XCircle, UserPlus } from "lucide-react";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import type { ImportRecord, ChanceResultListMeta } from "@/types/chanceResult";
import { StudentPickerDialog } from "./StudentPickerDialog";
import { toast } from "sonner";

function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  preview_ready: { label: "অনিশ্চিত (প্রিভিউ)", className: "bg-warning/10 text-warning border-warning/20" },
  confirmed: { label: "নিশ্চিত হয়েছে", className: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "বাতিল হয়েছে", className: "bg-muted text-muted-foreground" },
};

interface Props {
  refreshKey: number;
  onChanged: () => void;
}

export function ImportHistoryTab({ refreshKey, onChanged }: Props) {
  const [items, setItems] = useState<ImportRecord[]>([]);
  const [meta, setMeta] = useState<ChanceResultListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<ImportRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<ImportRecord | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null); // index into detail.unmatchedRolls

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "20", sortBy: "uploadedAt", sortOrder: "desc" });
      const res = await api.getWithMeta<ImportRecord[]>(`/admission-results/imports?${qs.toString()}`);
      setItems(res.data);
      setMeta((res.meta as unknown as ChanceResultListMeta) ?? null);
    } catch (err) {
      setError(friendlyError(err, "ইমপোর্ট হিস্ট্রি লোড করা যায়নি।"));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const refreshDetail = async (id: string) => {
    const updated = await api.get<ImportRecord>(`/admission-results/imports/${id}`);
    setDetail(updated);
    return updated;
  };

  const doConfirm = async (imp: ImportRecord) => {
    setBusyId(imp._id);
    try {
      const res = await api.post<{ imported: number; skipped: number }>(`/admission-results/imports/${imp._id}/confirm`);
      toast.success(`${res.imported.toLocaleString("bn-BD")} জন যোগ হয়েছে।`);
      load();
      onChanged();
    } catch (err) {
      toast.error(friendlyError(err, "নিশ্চিত করা যায়নি।"));
    } finally {
      setBusyId(null);
    }
  };

  const doCancel = async (imp: ImportRecord) => {
    setBusyId(imp._id);
    try {
      await api.post(`/admission-results/imports/${imp._id}/cancel`);
      toast.success("ইমপোর্ট বাতিল করা হয়েছে।");
      load();
    } catch (err) {
      toast.error(friendlyError(err, "বাতিল করা যায়নি।"));
    } finally {
      setBusyId(null);
    }
  };

  const doRollback = async () => {
    if (!rollbackTarget) return;
    setBusyId(rollbackTarget._id);
    try {
      const res = await api.del<{ deleted: number }>(`/admission-results/imports/${rollbackTarget._id}/rollback`);
      toast.success(`${res.deleted.toLocaleString("bn-BD")}টি রেকর্ড রোলব্যাক করা হয়েছে।`);
      setRollbackTarget(null);
      load();
      onChanged();
    } catch (err) {
      toast.error(friendlyError(err, "রোলব্যাক ব্যর্থ হয়েছে।"));
    } finally {
      setBusyId(null);
    }
  };

  const doMatch = async (studentId: string) => {
    if (!detail || pickerFor === null) return;
    try {
      await api.post(`/admission-results/imports/${detail._id}/unmatched/${pickerFor}/match`, { studentId });
      toast.success("ম্যাচ করা হয়েছে।");
      setPickerFor(null);
      await refreshDetail(detail._id);
      load();
      onChanged();
    } catch (err) {
      toast.error(friendlyError(err, "ম্যাচ করা যায়নি।"));
    }
  };

  return (
    <>
      <Card className="border-none shadow-sm">
        {loading ? (
          <CardContent className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent>
        ) : error ? (
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-destructive font-medium">{error}</p>
            <Button variant="outline" onClick={load}>আবার চেষ্টা করুন</Button>
          </CardContent>
        ) : items.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">এখনো কোনো ইমপোর্ট করা হয়নি।</CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ফাইল</TableHead>
                <TableHead>সেশন / রাউন্ড</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead className="text-center">মিলেছে / অমিলিত</TableHead>
                <TableHead>আপলোডের সময়</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((imp) => {
                const badge = STATUS_BADGE[imp.status];
                return (
                  <TableRow key={imp._id}>
                    <TableCell className="max-w-[200px] truncate" title={imp.fileName}>{imp.fileName}</TableCell>
                    <TableCell className="text-sm">{imp.sessionName} • {imp.resultRound}</TableCell>
                    <TableCell><Badge variant="outline" className={badge.className}>{badge.label}</Badge></TableCell>
                    <TableCell className="text-center text-sm">{imp.matchedCount} / {imp.unmatchedCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(imp.uploadedAt).toLocaleString("bn-BD")}</TableCell>
                    <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={async () => setDetail(await refreshDetail(imp._id))}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> বিস্তারিত
                      </Button>
                      {imp.status === "preview_ready" && (
                        <>
                          <Button size="sm" onClick={() => doConfirm(imp)} disabled={busyId === imp._id}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> নিশ্চিত করুন
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => doCancel(imp)} disabled={busyId === imp._id}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> বাতিল
                          </Button>
                        </>
                      )}
                      {imp.status === "confirmed" && (
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRollbackTarget(imp)} disabled={busyId === imp._id}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> রোলব্যাক
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 p-4 border-t">
            <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage(meta.page - 1)}>পূর্ববর্তী</Button>
            <span className="text-sm text-muted-foreground">পৃষ্ঠা {meta.page} / {meta.totalPages}</span>
            <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage(meta.page + 1)}>পরবর্তী</Button>
          </div>
        )}
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.fileName}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">প্রোগ্রাম</p><p className="font-medium">{detail.programName || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">সেশন</p><p className="font-medium">{detail.sessionName}</p></div>
                <div><p className="text-xs text-muted-foreground">রাউন্ড</p><p className="font-medium">{detail.resultRound}</p></div>
                <div><p className="text-xs text-muted-foreground">পার্স পদ্ধতি</p><p className="font-medium">{detail.parseMethod === "ocr" ? "OCR" : "টেক্সট"}</p></div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">অমিলিত ভর্তি রোল ({detail.unmatchedRolls.filter((u) => !u.resolved).length})</h4>
                {detail.unmatchedRolls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">কোনো অমিলিত রোল নেই।</p>
                ) : (
                  <div className="border rounded-lg max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ভর্তি রোল</TableHead>
                          <TableHead>ইনস্টিটিউট</TableHead>
                          <TableHead>নির্বাচন</TableHead>
                          <TableHead>স্ট্যাটাস</TableHead>
                          <TableHead className="text-right">অ্যাকশন</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.unmatchedRolls.map((u, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">{u.admissionRoll}</TableCell>
                            <TableCell className="text-sm">{u.instituteName}</TableCell>
                            <TableCell className="text-sm">{u.selectionType === "Merit" ? "মেধা" : "উপজাতি"}</TableCell>
                            <TableCell>
                              {u.resolved ? (
                                <Badge className="bg-success/10 text-success border-success/20">ম্যাচ হয়েছে</Badge>
                              ) : (
                                <Badge className="bg-warning/10 text-warning border-warning/20">অমিলিত</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {!u.resolved && (
                                <Button size="sm" variant="outline" onClick={() => setPickerFor(idx)}>
                                  <UserPlus className="h-3.5 w-3.5 mr-1" /> ম্যাচ করুন
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {detail.parseErrors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-destructive">পার্সিং সমস্যা ({detail.parseErrors.length})</h4>
                  <div className="border rounded-lg max-h-40 overflow-auto p-2 space-y-1 bg-destructive/5">
                    {detail.parseErrors.map((e, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground"><span className="font-mono">{e.raw}</span> — {e.reason}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <StudentPickerDialog open={pickerFor !== null} onOpenChange={(o) => !o && setPickerFor(null)} onSelect={(studentId) => doMatch(studentId)} />

      <AlertDialog open={!!rollbackTarget} onOpenChange={(o) => !o && setRollbackTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>রোলব্যাক নিশ্চিত করুন</AlertDialogTitle>
            <AlertDialogDescription>
              এই ইমপোর্ট থেকে তৈরি হওয়া সকল চান্স স্টুডেন্ট রেকর্ড ({rollbackTarget?.matchedCount.toLocaleString("bn-BD")}টি) স্থায়ীভাবে মুছে ফেলা হবে। এই কাজটি ফিরিয়ে নেওয়া যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={doRollback} className="bg-destructive hover:bg-destructive/90">রোলব্যাক করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
