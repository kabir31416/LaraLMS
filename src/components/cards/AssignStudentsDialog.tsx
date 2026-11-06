import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Search, UserPlus, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { SearchSelect } from "@/components/common/SearchSelect";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/dashboard/DashboardKit";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { n } from "./CardKit";
import type { EligibleStudent, ExamSchedule } from "@/types/cards";

type AssignResult = { requested: number; assigned: number; reactivated: number; duplicates: number; ineligible: { studentId: string; name: string | null; reason: string }[] };
type EligibleResponse = { items: EligibleStudent[]; total: number; alreadyAssigned: number; truncated: boolean };

function StudentRow({ s, checked, onChange, disabled }: { s: EligibleStudent; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex items-center gap-3 px-3 py-2.5 text-sm", disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/40", checked && !disabled && "bg-primary/[0.04]")}>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(!!v)} aria-label={s.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{s.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{s.studentId} • রেজি. {s.registrationNumber ?? "—"} • {s.batch ?? "ব্যাচ নেই"}{s.phone ? ` • ${s.phone}` : ""}</span>
      </span>
      {s.assignment === "active" && <Badge variant="outline" className="shrink-0 border-success/30 bg-success/10 text-success">যুক্ত আছে</Badge>}
      {s.assignment === "removed" && <Badge variant="outline" className="shrink-0 text-muted-foreground">আগে সরানো</Badge>}
    </label>
  );
}

/**
 * Explicit, traceable assignment: batch-wise (load a batch → select all or
 * some) or student-wise (search by name, Student ID, registration number,
 * phone). The server re-checks every student against the exam's course and
 * batch rule and refuses duplicates.
 */
export function AssignStudentsDialog({ open, onOpenChange, exam, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; exam: ExamSchedule; onDone: () => void }) {
  const { batches } = useBatches();
  const [tab, setTab] = useState<"batch" | "student">("batch");
  const batchLocked = !!exam.batch && !exam.allowCrossBatch;
  const batchOptions = useMemo(() => (batchLocked ? batches.filter((b) => b.id === exam.batch!.id) : batches.filter((b) => b.courseId === exam.course?.id)), [batches, batchLocked, exam]);
  const [batchId, setBatchId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const dSearch = useDebouncedValue(search, 350);
  const [chosen, setChosen] = useState<Map<string, EligibleStudent>>(new Map());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AssignResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab("batch"); setPicked(new Set()); setChosen(new Map()); setSearch(""); setResult(null);
    setBatchId(exam.batch?.id ?? "");
  }, [open, exam]);

  const batchQ = useQuery({
    queryKey: ["exam-eligible", exam.id, "batch", batchId],
    queryFn: () => api.get<EligibleResponse>(`/exam-schedules/${exam.id}/eligible?batchId=${batchId}`),
    enabled: open && tab === "batch" && !!batchId,
  });
  // Pre-select everyone not yet assigned whenever a batch loads.
  useEffect(() => {
    if (batchQ.data) setPicked(new Set(batchQ.data.items.filter((s) => s.assignment !== "active").map((s) => s.id)));
  }, [batchQ.data]);
  const searchQ = useQuery({
    queryKey: ["exam-eligible", exam.id, "search", dSearch],
    queryFn: () => api.get<EligibleResponse>(`/exam-schedules/${exam.id}/eligible?search=${encodeURIComponent(dSearch.trim())}`),
    enabled: open && tab === "student" && dSearch.trim().length >= 2,
  });

  const items = batchQ.data?.items ?? [];
  const assignable = items.filter((s) => s.assignment !== "active");
  const already = items.length - assignable.length;
  const excluded = assignable.length - picked.size;
  const ids = tab === "batch" ? [...picked] : [...chosen.keys()];

  const submit = async () => {
    if (!ids.length) { toast.error("কমপক্ষে একজন শিক্ষার্থী নির্বাচন করুন"); return; }
    setSaving(true);
    try {
      const r = await api.post<AssignResult>(`/exam-schedules/${exam.id}/assignments`, { studentIds: ids, method: tab });
      setResult(r);
      const added = r.assigned + r.reactivated;
      if (added) toast.success(`${n(added)} জন শিক্ষার্থী পরীক্ষায় যুক্ত হয়েছে`);
      if (r.duplicates) toast.info(`${n(r.duplicates)} জন আগে থেকেই যুক্ত ছিল`);
      if (r.ineligible.length) toast.warning(`${n(r.ineligible.length)} জন যোগ্য নয় — বিস্তারিত দেখুন`);
      onDone();
      if (!r.ineligible.length) onOpenChange(false);
      else { setPicked(new Set()); setChosen(new Map()); void batchQ.refetch(); }
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "যুক্ত করা যায়নি");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" aria-hidden />শিক্ষার্থী নির্ধারণ — {exam.name}</DialogTitle>
          <DialogDescription>
            {exam.course?.name}{exam.batch ? ` • ${exam.batch.name}` : " • সকল ব্যাচ"}{batchLocked ? " (শুধু এই ব্যাচ)" : exam.batch ? " (অন্য ব্যাচও অনুমোদিত)" : ""}. শুধু সক্রিয় ও অনুমোদিত শিক্ষার্থী যোগ করা যায়।
          </DialogDescription>
        </DialogHeader>
        {result && result.ineligible.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-warning"><AlertTriangle className="h-4 w-4" aria-hidden />যুক্ত করা যায়নি ({n(result.ineligible.length)})</p>
            <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-xs">{result.ineligible.map((i) => <li key={i.studentId}><b>{i.name ?? i.studentId}</b> — {i.reason}</li>)}</ul>
          </div>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(v as "batch" | "student")} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="batch"><Users className="mr-1.5 h-4 w-4" aria-hidden />ব্যাচ অনুযায়ী</TabsTrigger>
            <TabsTrigger value="student"><Search className="mr-1.5 h-4 w-4" aria-hidden />শিক্ষার্থী অনুযায়ী</TabsTrigger>
          </TabsList>
          <TabsContent value="batch" className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
            <SearchSelect label="ব্যাচ" value={batchId} onChange={setBatchId} placeholder="ব্যাচ নির্বাচন করুন" options={batchOptions.map((b) => ({ value: b.id, label: b.name }))} disabled={batchLocked} />
            {!batchId ? <EmptyState compact icon={Users} title="ব্যাচ নির্বাচন করুন" description="ব্যাচের সকল যোগ্য শিক্ষার্থী এখানে লোড হবে" /> : batchQ.isError ? <ErrorState message={batchQ.error instanceof ApiClientError ? batchQ.error.message : "লোড করা যায়নি"} onRetry={() => batchQ.refetch()} /> : batchQ.isLoading ? <ListSkeleton rows={4} /> : (
              <>
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  {[["মোট যোগ্য", items.length, ""], ["নির্বাচিত", picked.size, "text-primary"], ["বাদ রাখা", excluded, ""], ["আগেই যুক্ত", already, "text-success"]].map(([l, v, c]) => (
                    <div key={l as string} className="rounded-lg border p-2"><p className={cn("text-lg font-bold tabular-nums", c as string)}>{n(v as number)}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>
                  ))}
                </div>
                {items.length === 0 ? <EmptyState compact title="এই ব্যাচে কোনো যোগ্য শিক্ষার্থী নেই" /> : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <label className="flex cursor-pointer items-center gap-2"><Checkbox checked={assignable.length > 0 && picked.size === assignable.length} onCheckedChange={(v) => setPicked(v ? new Set(assignable.map((s) => s.id)) : new Set())} aria-label="সবাইকে নির্বাচন" />সবাইকে নির্বাচন</label>
                      {batchQ.data?.truncated && <span className="text-xs text-warning">প্রথম ১০০০ জন দেখানো হচ্ছে</span>}
                    </div>
                    <div className="min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border" style={{ maxHeight: 320 }}>
                      {items.map((s) => <StudentRow key={s.id} s={s} checked={s.assignment === "active" || picked.has(s.id)} disabled={s.assignment === "active"} onChange={(v) => setPicked((p) => { const x = new Set(p); if (v) x.add(s.id); else x.delete(s.id); return x; })} />)}
                    </div>
                  </>
                )}
              </>
            )}
          </TabsContent>
          <TabsContent value="student" className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, স্টুডেন্ট আইডি, রেজিস্ট্রেশন নম্বর বা মোবাইল" className="pl-9" aria-label="শিক্ষার্থী খুঁজুন" />
            </div>
            {chosen.size > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[...chosen.values()].map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 py-0.5 pl-2.5 pr-1 text-xs text-primary">{s.name}<button type="button" onClick={() => setChosen((p) => { const m = new Map(p); m.delete(s.id); return m; })} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/15" aria-label={`${s.name} বাদ দিন`}><X className="h-3 w-3" /></button></span>
                ))}
              </div>
            )}
            {dSearch.trim().length < 2 ? <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">অন্তত ২ অক্ষর লিখে খুঁজুন{exam.allowCrossBatch || !exam.batch ? " — একই কোর্সের যেকোনো ব্যাচ থেকে" : ""}</p>
              : searchQ.isLoading ? <ListSkeleton rows={3} /> : (searchQ.data?.items.length ?? 0) === 0 ? <EmptyState compact title="কোনো যোগ্য শিক্ষার্থী পাওয়া যায়নি" description="কোর্স/ব্যাচের বাইরের বা নিষ্ক্রিয় শিক্ষার্থী এখানে আসে না" /> : (
                <div className="min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border" style={{ maxHeight: 320 }}>
                  {searchQ.data!.items.map((s) => <StudentRow key={s.id} s={s} checked={s.assignment === "active" || chosen.has(s.id)} disabled={s.assignment === "active"} onChange={(v) => setChosen((p) => { const m = new Map(p); if (v) m.set(s.id, s); else m.delete(s.id); return m; })} />)}
                </div>
              )}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>বন্ধ করুন</Button>
          <Button onClick={submit} disabled={saving || ids.length === 0}>{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{ids.length ? `${n(ids.length)} জনকে যুক্ত করুন` : "যুক্ত করুন"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
