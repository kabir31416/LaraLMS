import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, History, Layers, Loader2, RotateCcw, Search, Send, UserRound, UserSearch, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, ListSkeleton } from "@/components/dashboard/DashboardKit";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { useMaterials } from "@/contexts/MaterialContext";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { MaterialStudentPicker, type PickedStudent } from "./MaterialStudentPicker";
import { stockLevel, type BulkDistributionResult, type DuplicateWarning, type Material, type MaterialDistribution } from "@/types/material";

/**
 * Distribution: hand out materials to ONE student (existing flow: duplicate
 * warning, optional payment collection, confirmation) or to a WHOLE BATCH
 * (POST /materials/distributions/bulk — server preview first, then an
 * all-or-nothing stock deduction). Plus the searchable, filterable history.
 */
type Mode = "student" | "batch";

function MaterialChooser({ materials, selected, onToggle, onQty, multiplier, search, onSearch }: {
  materials: Material[];
  selected: Record<string, number>;
  onToggle: (id: string, on: boolean) => void;
  onQty: (id: string, q: number) => void;
  multiplier: number;
  search: string;
  onSearch: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="ম্যাটেরিয়াল খুঁজুন..." className="pl-9" aria-label="ম্যাটেরিয়াল খুঁজুন" />
      </div>
      <div className="max-h-[420px] divide-y overflow-y-auto rounded-lg border">
        {materials.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">কোনো সক্রিয় ম্যাটেরিয়াল পাওয়া যায়নি</p> : materials.map((m) => {
          const checked = m.id in selected;
          const level = stockLevel(m);
          const need = checked ? (selected[m.id] || 0) * multiplier : 0;
          const short = checked && need > m.currentStock;
          return (
            <div key={m.id} className={cn("flex items-center gap-3 p-3 transition-colors", level === "out" ? "opacity-55" : "hover:bg-muted/40", checked && "bg-primary/[0.04]")}>
              <Checkbox id={`mat-${m.id}`} checked={checked} disabled={level === "out"} onCheckedChange={(v) => onToggle(m.id, !!v)} aria-label={m.name} />
              <label htmlFor={`mat-${m.id}`} className={cn("min-w-0 flex-1", level !== "out" && "cursor-pointer")}>
                <p className="truncate font-medium">{m.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant="outline" className="text-[11px]">{m.materialType}</Badge>
                  {m.isPaid ? <Badge variant="outline" className="text-[11px]">৳ {m.price}</Badge> : <Badge variant="outline" className="border-info/20 bg-info/10 text-[11px] text-info">ফ্রি</Badge>}
                  <span className={cn(level === "out" ? "text-destructive" : level === "low" ? "text-warning" : "text-muted-foreground")}>{level === "out" ? "স্টকে নেই" : `স্টক ${m.currentStock}${level === "low" ? " (কম)" : ""}`}</span>
                  {checked && multiplier > 1 && <span className={cn("font-medium", short ? "text-destructive" : "text-foreground")}>• মোট লাগবে {need}</span>}
                </div>
              </label>
              {checked && (
                <div className="w-20 shrink-0">
                  <Input type="number" min={1} max={m.currentStock} value={selected[m.id]} onChange={(e) => onQty(m.id, Math.max(1, Number(e.target.value) || 1))} aria-label={`${m.name} পরিমাণ`} className={cn(short && "border-destructive")} />
                  {multiplier > 1 && <p className="mt-0.5 text-center text-[10px] text-muted-foreground">জনপ্রতি</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DistributionTab({ preselectMaterialId, onChanged }: { preselectMaterialId?: string | null; onChanged?: () => void }) {
  const { activePaymentMethods } = useAcademic();
  const { batches } = useBatches();
  const { materials, getMaterial, refreshMaterials, materialSettings } = useMaterials();
  const [tab, setTab] = useState("new");
  const [mode, setMode] = useState<Mode>("student");

  const [materialSearch, setMaterialSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  useEffect(() => {
    if (preselectMaterialId) { setTab("new"); setSelected((p) => ({ ...p, [preselectMaterialId]: p[preselectMaterialId] ?? 1 })); }
  }, [preselectMaterialId]);

  const visibleMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();
    return materials.filter((m) => m.status === "সক্রিয়" && (!q || m.name.toLowerCase().includes(q) || m.materialType.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.id in selected) - Number(a.id in selected) || a.name.localeCompare(b.name, "bn"));
  }, [materials, materialSearch, selected]);
  const toggle = (id: string, on: boolean) => setSelected((p) => { const n = { ...p }; if (on) n[id] = 1; else delete n[id]; return n; });
  const setQty = (id: string, q: number) => setSelected((p) => ({ ...p, [id]: q }));
  const items = useMemo(() => Object.entries(selected).map(([materialId, quantity]) => ({ materialId, quantity })), [selected]);

  const afterSuccess = async () => {
    setSelected({});
    setNote("");
    await refreshMaterials().catch(() => {});
    onChanged?.();
  };

  // ------------------------------------------------ single student
  const [pickerOpen, setPickerOpen] = useState(false);
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [collectPayment, setCollectPayment] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [warnings, setWarnings] = useState<DuplicateWarning[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const totalPaid = items.reduce((s, i) => { const m = getMaterial(i.materialId); return s + (m?.isPaid ? m.price * i.quantity : 0); }, 0);
  const debouncedIds = useDebouncedValue(items.map((i) => i.materialId).sort().join(","), 400);

  useEffect(() => {
    if (mode !== "student" || !student || !debouncedIds) { setWarnings([]); return; }
    api.post<DuplicateWarning[]>("/materials/distributions/check-duplicate", { studentId: student.id, materialIds: debouncedIds.split(",").filter(Boolean) })
      .then(setWarnings)
      .catch(() => setWarnings([]));
  }, [mode, student, debouncedIds]);

  const validateSingle = (): string | null => {
    if (!student) return "শিক্ষার্থী নির্বাচন করুন";
    if (items.length === 0) return "কমপক্ষে একটি ম্যাটেরিয়াল নির্বাচন করুন";
    for (const i of items) {
      const m = getMaterial(i.materialId);
      if (!m) continue;
      if (!i.quantity || i.quantity <= 0) return `"${m.name}" এর পরিমাণ শূন্যের বেশি হতে হবে`;
      if (m.currentStock === 0) return `"${m.name}" স্টকে নেই`;
      if (i.quantity > m.currentStock) return `"${m.name}" এর জন্য পর্যাপ্ত স্টক নেই — উপলব্ধ: ${m.currentStock}, অনুরোধ: ${i.quantity}`;
    }
    if (totalPaid > 0 && collectPayment && !paymentMethod) return "পেমেন্ট পদ্ধতি নির্বাচন করুন";
    if (materialSettings.duplicateDistributionRule === "block" && warnings.length) return "এই শিক্ষার্থী আগেই পেয়েছে — সেটিংসে ডুপ্লিকেট বিতরণ বন্ধ (Block) আছে";
    return null;
  };

  const submitSingle = async () => {
    if (!student) return;
    setSubmitting(true);
    try {
      await api.post("/materials/distributions", {
        studentId: student.id,
        items,
        note: note.trim() || undefined,
        collectPayment: totalPaid > 0 && collectPayment ? { method: paymentMethod } : undefined,
      });
      toast.success(`${student.name}-কে ${items.length} ধরনের ম্যাটেরিয়াল দেওয়া হয়েছে — স্টক হালনাগাদ হয়েছে`);
      setStudent(null);
      setPaymentMethod("");
      setCollectPayment(true);
      setWarnings([]);
      setConfirmOpen(false);
      await afterSuccess();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "বিতরণ ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------ whole batch
  const [batchId, setBatchId] = useState("");
  const [skipReceived, setSkipReceived] = useState(true);
  const block = materialSettings.duplicateDistributionRule === "block";
  const previewKey = useDebouncedValue(JSON.stringify({ batchId, items, skip: block || skipReceived }), 350);
  const preview = useQuery({
    queryKey: ["materials", "bulk-preview", previewKey],
    queryFn: () => {
      const p = JSON.parse(previewKey) as { batchId: string; items: { materialId: string; quantity: number }[]; skip: boolean };
      return api.post<BulkDistributionResult>("/materials/distributions/bulk", { batchId: p.batchId, items: p.items, skipAlreadyReceived: p.skip, dryRun: true });
    },
    enabled: mode === "batch" && !!batchId && items.length > 0 && JSON.parse(previewKey).batchId === batchId,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const plan = preview.data;
  const [batchConfirm, setBatchConfirm] = useState(false);
  const canBatch = !!plan && plan.recipients > 0 && plan.shortages.length === 0 && !preview.isFetching;

  const submitBatch = async () => {
    setSubmitting(true);
    try {
      const res = await api.post<BulkDistributionResult>("/materials/distributions/bulk", { batchId, items, skipAlreadyReceived: block || skipReceived, note: note.trim() || undefined });
      toast.success(`${res.created} জন শিক্ষার্থীকে বিতরণ সম্পন্ন${res.skipped.length ? ` • ${res.skipped.length} জন আগেই পেয়েছে` : ""} — স্টক হালনাগাদ হয়েছে`);
      setBatchConfirm(false);
      await afterSuccess();
      void preview.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "বিতরণ ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  const batchName = batches.find((b) => b.id === batchId)?.name;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="new"><Send className="mr-1.5 h-4 w-4" />নতুন বিতরণ</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1.5 h-4 w-4" />বিতরণ হিস্ট্রি</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-4 pt-4">
          <div role="radiogroup" aria-label="কাকে বিতরণ" className="grid grid-cols-2 gap-2 sm:max-w-md">
            {([["student", "একজন শিক্ষার্থী", UserRound], ["batch", "পুরো ব্যাচ", Users]] as const).map(([key, label, Icon]) => (
              <button key={key} type="button" role="radio" aria-checked={mode === key} onClick={() => setMode(key)}
                className={cn("flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors", mode === key ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted")}>
                <Icon className="h-4 w-4" aria-hidden />{label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            {/* Step 1: who */}
            <Card className="p-4 sm:p-5">
              <h3 className="mb-3 font-semibold">১. {mode === "student" ? "শিক্ষার্থী নির্বাচন" : "ব্যাচ নির্বাচন"}</h3>
              {mode === "student" ? (
                student ? (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="truncate font-semibold">{student.name}</p><p className="text-xs text-muted-foreground">রোল {student.currentRollNumber || "—"} • {student.registrationId || "—"} • {student.phone}</p></div>
                      <Button variant="ghost" size="icon" aria-label="শিক্ষার্থী পরিবর্তন" onClick={() => { setStudent(null); setWarnings([]); }}><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full justify-start" onClick={() => setPickerOpen(true)}><UserSearch className="h-4 w-4" />নাম, রোল বা মোবাইল দিয়ে শিক্ষার্থী খুঁজুন</Button>
                )
              ) : (
                <div className="space-y-3">
                  <Select value={batchId} onValueChange={setBatchId}>
                    <SelectTrigger aria-label="ব্যাচ"><SelectValue placeholder="ব্যাচ নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>{batches.slice().sort((a, b) => a.name.localeCompare(b.name, "bn")).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex items-start gap-2">
                    <Checkbox id="skip-received" checked={block || skipReceived} disabled={block} onCheckedChange={(v) => setSkipReceived(!!v)} />
                    <Label htmlFor="skip-received" className="text-sm font-normal leading-snug">যারা আগেই এই ম্যাটেরিয়াল পেয়েছে তাদের বাদ দিন{block && <span className="block text-xs text-muted-foreground">সেটিংসে ডুপ্লিকেট বিতরণ বন্ধ (Block) — সবসময় বাদ যাবে</span>}</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">শুধু ব্যাচের সক্রিয় ও অনুমোদিত শিক্ষার্থীরা পাবে। পেইড ম্যাটেরিয়ালের মূল্য রেকর্ড হবে; পেমেন্ট ফি ম্যানেজমেন্ট থেকে নিন।</p>
                </div>
              )}

              {/* Summary / preview */}
              {mode === "student" && warnings.length > 0 && (
                <div className={cn("mt-4 rounded-lg border p-3 text-sm", block ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/10")}>
                  <p className={cn("flex items-center gap-1.5 font-medium", block ? "text-destructive" : "text-warning")}><AlertTriangle className="h-4 w-4" aria-hidden />আগে দেওয়া হয়েছে</p>
                  <ul className="mt-1 space-y-0.5 text-xs">{warnings.map((w) => <li key={w.materialId}><b>{w.materialName}</b> — {w.previousDistributions.map((p) => `${p.date} (${p.quantity} পিস)`).join(", ")}</li>)}</ul>
                  {!block && <p className="mt-1 text-xs text-muted-foreground">আবার দিতে চাইলে নিশ্চিত করুন — স্বয়ংক্রিয়ভাবে আটকানো হবে না।</p>}
                </div>
              )}
              {mode === "batch" && batchId && items.length > 0 && (
                <div className="mt-4 space-y-2" aria-live="polite">
                  {preview.isError ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{preview.error instanceof ApiClientError ? preview.error.message : "প্রিভিউ লোড করা যায়নি"}</p> : !plan ? <ListSkeleton rows={2} /> : (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg border p-2"><p className="text-lg font-bold tabular-nums">{plan.students}</p><p className="text-[11px] text-muted-foreground">ব্যাচে সক্রিয়</p></div>
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2"><p className="text-lg font-bold tabular-nums text-primary">{plan.recipients}</p><p className="text-[11px] text-muted-foreground">পাবে</p></div>
                        <div className="rounded-lg border p-2"><p className="text-lg font-bold tabular-nums">{plan.skipped.length}</p><p className="text-[11px] text-muted-foreground">আগেই পেয়েছে</p></div>
                      </div>
                      <ul className="divide-y rounded-lg border text-sm">
                        {plan.materials.map((m) => (
                          <li key={m.materialId} className="flex items-center justify-between gap-2 px-3 py-2">
                            <span className="min-w-0 truncate">{m.name} <span className="text-xs text-muted-foreground">× {m.perStudent} • {m.recipients} জন</span></span>
                            <span className={cn("shrink-0 text-xs font-medium tabular-nums", m.enough ? "text-success" : "text-destructive")}>{m.enough ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden /> : <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden />}লাগবে {m.needed} / আছে {m.available}</span>
                          </li>
                        ))}
                      </ul>
                      {plan.shortages.length > 0 && <p className="text-xs font-medium text-destructive">স্টক যথেষ্ট নয় — পরিমাণ কমান বা আগে স্টক যোগ করুন।</p>}
                      {plan.totalPaidAmount > 0 && <p className="text-xs text-muted-foreground">পেইড ম্যাটেরিয়ালের মোট মূল্য ৳ {plan.totalPaidAmount.toLocaleString()} রেকর্ড হবে।</p>}
                      {plan.skipped.length > 0 && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">যারা বাদ যাবে ({plan.skipped.length})</summary><p className="mt-1">{plan.skipped.map((s) => s.name).join(", ")}</p></details>}
                    </>
                  )}
                </div>
              )}
            </Card>

            {/* Step 2: what */}
            <Card className="p-4 sm:p-5">
              <h3 className="mb-3 font-semibold">২. ম্যাটেরিয়াল ও পরিমাণ {items.length > 0 && <span className="text-sm font-normal text-muted-foreground">({items.length}টি নির্বাচিত)</span>}</h3>
              <MaterialChooser materials={visibleMaterials} selected={selected} onToggle={toggle} onQty={setQty} multiplier={mode === "batch" ? plan?.recipients ?? 1 : 1} search={materialSearch} onSearch={setMaterialSearch} />

              {mode === "student" && totalPaid > 0 && (
                <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">মোট মূল্য: <span className="text-primary">৳ {totalPaid.toLocaleString()}</span></p>
                    <div className="flex items-center gap-2"><Checkbox id="collect-payment" checked={collectPayment} onCheckedChange={(v) => setCollectPayment(!!v)} /><Label htmlFor="collect-payment" className="cursor-pointer text-sm font-normal">এখনই পেমেন্ট নিন</Label></div>
                  </div>
                  {collectPayment && (
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="sm:max-w-xs" aria-label="পেমেন্ট পদ্ধতি"><SelectValue placeholder="পেমেন্ট পদ্ধতি নির্বাচন করুন" /></SelectTrigger>
                      <SelectContent>{activePaymentMethods.map((pm) => <SelectItem key={pm.id} value={pm.name}>{pm.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div className="mt-3 space-y-1.5"><Label htmlFor="dist-note">নোট (ঐচ্ছিক)</Label><Input id="dist-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                {items.length > 0 && <Button variant="ghost" onClick={() => setSelected({})}>নির্বাচন মুছুন</Button>}
                {mode === "student" ? (
                  <Button disabled={submitting || items.length === 0 || !student} onClick={() => { const e = validateSingle(); if (e) toast.error(e); else setConfirmOpen(true); }}>
                    <Send className="h-4 w-4" />{items.length ? `${items.length}টি ম্যাটেরিয়াল বিতরণ করুন` : "বিতরণ করুন"}
                  </Button>
                ) : (
                  <Button disabled={submitting || !canBatch} onClick={() => setBatchConfirm(true)}>
                    {preview.isFetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Users className="h-4 w-4" aria-hidden />}
                    {plan && plan.recipients ? `${plan.recipients} জনকে বিতরণ করুন` : "ব্যাচে বিতরণ করুন"}
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <DistributionHistory batches={batches} materials={materials} onChanged={async () => { await refreshMaterials().catch(() => {}); onChanged?.(); }} />
        </TabsContent>
      </Tabs>

      <MaterialStudentPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => { setStudent(s); setPickerOpen(false); }} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>বিতরণ নিশ্চিত করুন</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p><b className="text-foreground">{student?.name}</b>-কে দেওয়া হবে:</p>
                <ul className="list-disc pl-5">{items.map((i) => <li key={i.materialId}>{getMaterial(i.materialId)?.name} × {i.quantity}</li>)}</ul>
                {totalPaid > 0 && <p>মোট ৳ {totalPaid.toLocaleString()} {collectPayment ? `— ${paymentMethod} এ পেমেন্ট নেওয়া হবে` : "— পেমেন্ট পরে নেওয়া হবে"}</p>}
                <p className="text-xs">স্টক স্বয়ংক্রিয়ভাবে কমবে এবং বিতরণ ইতিহাসে রেকর্ড থাকবে।</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void submitSingle(); }} disabled={submitting}>{submitting ? "প্রসেস হচ্ছে..." : "নিশ্চিত করুন"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={batchConfirm} onOpenChange={setBatchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ব্যাচে বিতরণ নিশ্চিত করুন</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p><b className="text-foreground">{batchName}</b> — {plan?.recipients} জন শিক্ষার্থী পাবে{plan?.skipped.length ? `, ${plan.skipped.length} জন বাদ (আগেই পেয়েছে)` : ""}।</p>
                <ul className="list-disc pl-5">{plan?.materials.map((m) => <li key={m.materialId}>{m.name}: জনপ্রতি {m.perStudent}, মোট {m.needed} (স্টক {m.available} → {m.available - m.needed})</li>)}</ul>
                <p className="text-xs">সব বিতরণ একসাথে হবে — কোনো একটি ব্যর্থ হলে কিছুই হবে না, স্টকও অপরিবর্তিত থাকবে।</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void submitBatch(); }} disabled={submitting}>{submitting ? "প্রসেস হচ্ছে..." : "নিশ্চিত করুন"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const ALL = "__all";

function DistributionHistory({ batches, materials, onChanged }: { batches: { id: string; name: string }[]; materials: Material[]; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [batchId, setBatchId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [reverseTarget, setReverseTarget] = useState<MaterialDistribution | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (batchId) p.set("batchId", batchId);
    if (materialId) p.set("materialId", materialId);
    if (status) p.set("status", status);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    return p.toString();
  }, [page, debouncedSearch, batchId, materialId, status, dateFrom, dateTo]);
  useEffect(() => setPage(1), [debouncedSearch, batchId, materialId, status, dateFrom, dateTo]);

  const q = useQuery({
    queryKey: ["materials", "distributions", qs],
    queryFn: () => api.getWithMeta<(MaterialDistribution & { _id: string })[]>(`/materials/distributions?${qs}`),
    placeholderData: keepPreviousData,
  });
  const items = (q.data?.data ?? []).map((d) => ({ ...d, id: d._id }));
  const meta = q.data?.meta as { page: number; totalPages: number; total: number } | undefined;
  const activeCount = [batchId, materialId, status, dateFrom, dateTo, search].filter(Boolean).length;

  const doReverse = async () => {
    if (!reverseTarget || !reverseReason.trim()) { toast.error("কারণ লিখুন"); return; }
    setReversing(true);
    try {
      await api.post(`/materials/distributions/${reverseTarget.id}/reverse`, { reason: reverseReason.trim() });
      toast.success("বিতরণ বাতিল করা হয়েছে — স্টক ফেরত যোগ হয়েছে");
      setReverseTarget(null);
      setReverseReason("");
      void q.refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "বাতিল করা যায়নি");
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 sm:p-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="শিক্ষার্থীর নাম, রোল, রেজিস্ট্রেশন বা মোবাইল" className="pl-9" aria-label="বিতরণ খুঁজুন" /></div>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Select value={batchId || ALL} onValueChange={(v) => setBatchId(v === ALL ? "" : v)}>
            <SelectTrigger aria-label="ব্যাচ"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>সকল ব্যাচ</SelectItem>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={materialId || ALL} onValueChange={(v) => setMaterialId(v === ALL ? "" : v)}>
            <SelectTrigger aria-label="ম্যাটেরিয়াল"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>সকল ম্যাটেরিয়াল</SelectItem>{materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status || ALL} onValueChange={(v) => setStatus(v === ALL ? "" : v)}>
            <SelectTrigger aria-label="স্ট্যাটাস"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>সকল স্ট্যাটাস</SelectItem><SelectItem value="ACTIVE">সক্রিয়</SelectItem><SelectItem value="REVERSED">বাতিল</SelectItem></SelectContent>
          </Select>
          <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} aria-label="তারিখ থেকে" />
          <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} aria-label="তারিখ পর্যন্ত" />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{meta ? `${meta.total}টি বিতরণ` : ""}</span>
          {activeCount > 0 && <button type="button" onClick={() => { setSearch(""); setBatchId(""); setMaterialId(""); setStatus(""); setDateFrom(""); setDateTo(""); }} className="inline-flex items-center gap-1 hover:text-foreground"><X className="h-3.5 w-3.5" />ফিল্টার মুছুন</button>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {q.isLoading ? <div className="p-4"><ListSkeleton rows={6} /></div> : items.length === 0 ? (
          <EmptyState icon={Layers} title={activeCount ? "এই ফিল্টারে কোনো বিতরণ নেই" : "এখনো কোনো বিতরণ হয়নি"} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader><TableRow><TableHead>তারিখ</TableHead><TableHead>শিক্ষার্থী</TableHead><TableHead>ব্যাচ</TableHead><TableHead>ম্যাটেরিয়াল</TableHead><TableHead className="text-center">পরিমাণ</TableHead><TableHead className="text-right">মূল্য</TableHead><TableHead>স্ট্যাটাস</TableHead><TableHead className="w-24"><span className="sr-only">অ্যাকশন</span></TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((d) => (
                    <TableRow key={d.id} className={d.status !== "ACTIVE" ? "opacity-60" : ""}>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">{d.distributionDate}</TableCell>
                      <TableCell><span className="block font-medium">{d.studentName}</span><span className="text-xs text-muted-foreground">{d.studentRoll || d.registrationId || "—"}</span></TableCell>
                      <TableCell className="text-sm">{d.batchName || "—"}</TableCell>
                      <TableCell className="max-w-[260px] text-sm">{d.items.map((i) => `${i.materialName} ×${i.quantity}`).join(", ")}</TableCell>
                      <TableCell className="text-center tabular-nums">{d.totalQuantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.totalPaidAmount > 0 ? `৳ ${d.totalPaidAmount.toLocaleString()}` : "ফ্রি"}</TableCell>
                      <TableCell><Badge variant="outline" className={d.status === "ACTIVE" ? "border-success/20 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>{d.status === "ACTIVE" ? "সক্রিয়" : "বাতিল"}</Badge></TableCell>
                      <TableCell>{d.status === "ACTIVE" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setReverseTarget(d)}><RotateCcw className="h-3.5 w-3.5" />বাতিল</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden">
              {items.map((d) => (
                <li key={d.id} className={cn("px-3 py-3", d.status !== "ACTIVE" && "opacity-60")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate font-medium">{d.studentName}</p><p className="text-xs text-muted-foreground">{d.distributionDate} • {d.batchName || "—"}</p></div>
                    <Badge variant="outline" className={d.status === "ACTIVE" ? "border-success/20 text-success" : ""}>{d.status === "ACTIVE" ? "সক্রিয়" : "বাতিল"}</Badge>
                  </div>
                  <p className="mt-1 text-sm">{d.items.map((i) => `${i.materialName} ×${i.quantity}`).join(", ")}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{d.totalPaidAmount > 0 ? `৳ ${d.totalPaidAmount.toLocaleString()}` : "ফ্রি"}</span>{d.status === "ACTIVE" && <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => setReverseTarget(d)}><RotateCcw className="h-3.5 w-3.5" />বাতিল</Button>}</div>
                </li>
              ))}
            </ul>
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-3 py-2.5 text-sm sm:px-4">
                <span className="text-muted-foreground">পৃষ্ঠা {meta.page} / {meta.totalPages}</span>
                <span className="flex gap-1"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>আগের</Button><Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>পরের</Button></span>
              </div>
            )}
          </>
        )}
      </Card>

      <AlertDialog open={!!reverseTarget} onOpenChange={(o) => !o && setReverseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>বিতরণ বাতিল করুন</AlertDialogTitle>
            <AlertDialogDescription>{reverseTarget?.studentName}-কে দেওয়া এই বিতরণ বাতিল হবে এবং স্টক ফেরত যোগ হবে। লিংক থাকা পেমেন্ট স্বয়ংক্রিয়ভাবে ফেরত হয় না। এই কাজটি ফিরিয়ে নেওয়া যাবে না।</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 px-1"><Label htmlFor="rev-reason">বাতিলের কারণ *</Label><Input id="rev-reason" value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="যেমন: ভুল শিক্ষার্থীকে দেওয়া হয়েছে" /></div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reversing}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void doReverse(); }} disabled={reversing} className="bg-destructive hover:bg-destructive/90">{reversing ? "প্রসেস হচ্ছে..." : "নিশ্চিত করে বাতিল করুন"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
