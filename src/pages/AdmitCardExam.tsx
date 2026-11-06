import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Ban, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Eye, FileBadge, Loader2, MapPin, Pencil, RefreshCw, RotateCcw,
  Search, Send, ShieldCheck, Trash2, UserMinus, UserPlus, Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState, ListSkeleton, Panel } from "@/components/dashboard/DashboardKit";
import { AdmitCard, FitCard } from "@/components/cards/CardDesigns";
import { ExamFormDialog } from "@/components/cards/ExamFormDialog";
import { AssignStudentsDialog } from "@/components/cards/AssignStudentsDialog";
import { ExamStatusBadge, IssueBadge, PrintMenu, WorkflowSteps, admitBase, n, type PrintChoice } from "@/components/cards/CardKit";
import { api } from "@/lib/apiClient";
import { admitQrMap, printAdmitCards, startPrintWindow } from "@/lib/cardPrint";
import { ApiClientError, hasPermission, useAuth } from "@/contexts/AuthContext";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ADMIT_CARDS_MANAGE } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  EXAM_TYPE_LABEL, formatDateBn, formatDuration, formatTime12, type AdmitPayload, type AdmitSelector, type CardInstitution, type CardSettings, type ExamAssignmentRow,
  type ExamDetail, type ExamStatus, type GenerateMode,
} from "@/types/cards";

const errMsg = (e: unknown, f: string) => (e instanceof ApiClientError ? e.message : f);
const PRINT_CHOICES: PrintChoice[] = [
  { key: "p1", label: "প্রতি পৃষ্ঠায় ১টি (A4)", hint: "ডিফল্ট — পূর্ণ পৃষ্ঠার অ্যাডমিট কার্ড" },
  { key: "p2", label: "প্রতি পৃষ্ঠায় ২টি", hint: "অর্ধেক A4, কাটার দাগসহ" },
  { key: "pdf", label: "PDF ডাউনলোড", pdf: true },
];

type Scope = "all" | "batch" | "students";

export default function AdmitCardExam() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const canManage = hasPermission(user, ADMIT_CARDS_MANAGE);
  const base = admitBase(user?.role);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const examQ = useQuery({ queryKey: ["exam-schedules", "detail", id], queryFn: () => api.get<ExamDetail>(`/exam-schedules/${id}`) });
  const conf = useQuery({ queryKey: ["id-cards", "settings"], queryFn: () => api.get<{ settings: CardSettings; institution: CardInstitution }>("/id-cards/settings"), staleTime: 60_000 });
  const exam = examQ.data;
  const editable = canManage && !!exam && (exam.status === "draft" || exam.status === "published");
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["exam-schedules"] }); };

  // ---- assignments table
  const [tab, setTab] = useState("students");
  const [fBatch, setFBatch] = useState("");
  const [search, setSearch] = useState("");
  const dSearch = useDebouncedValue(search, 350);
  const [admitF, setAdmitF] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [fBatch, dSearch, admitF, showRemoved]);
  const qs = new URLSearchParams({ page: String(page), limit: "25" });
  if (fBatch) qs.set("batchId", fBatch);
  if (dSearch.trim()) qs.set("search", dSearch.trim());
  if (admitF) qs.set("admit", admitF);
  if (showRemoved) qs.set("status", "removed");
  const asg = useQuery({ queryKey: ["exam-schedules", "assignments", id, qs.toString()], queryFn: () => api.getWithMeta<ExamAssignmentRow[]>(`/exam-schedules/${id}/assignments?${qs}`), enabled: !!exam });
  const rows = asg.data?.data ?? [];
  const meta = asg.data?.meta as unknown as { total: number; totalPages: number } | undefined;
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const toggle = (sid: string, name: string, on: boolean) => setSelected((p) => { const m = new Map(p); if (on) m.set(sid, name); else m.delete(sid); return m; });

  // ---- dialogs
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusDlg, setStatusDlg] = useState<{ to: ExamStatus; title: string; body: string; reason?: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [removeDlg, setRemoveDlg] = useState<{ ids: string[]; label: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const changeStatus = async () => {
    if (!statusDlg || !exam) return;
    if (statusDlg.reason && !reason.trim()) { toast.error("বাতিলের কারণ লিখুন"); return; }
    setBusy("status");
    try {
      await api.post(`/exam-schedules/${exam.id}/status`, { status: statusDlg.to, reason: reason.trim() || undefined });
      toast.success("স্ট্যাটাস পরিবর্তন হয়েছে");
      setStatusDlg(null); setReason("");
      refresh();
    } catch (e) { toast.error(errMsg(e, "পরিবর্তন করা যায়নি")); } finally { setBusy(null); }
  };
  const doDelete = async () => {
    if (!exam) return;
    setBusy("delete");
    try {
      await api.del(`/exam-schedules/${exam.id}`);
      toast.success("পরীক্ষা মুছে ফেলা হয়েছে");
      refresh();
      navigate(base);
    } catch (e) { toast.error(errMsg(e, "মুছে ফেলা যায়নি")); } finally { setBusy(null); }
  };
  const doRemove = async () => {
    if (!removeDlg || !exam) return;
    setBusy("remove");
    try {
      const r = await api.post<{ removed: number }>(`/exam-schedules/${exam.id}/assignments/remove`, { studentIds: removeDlg.ids, reason: reason.trim() || undefined });
      toast.success(`${n(r.removed)} জন শিক্ষার্থীকে পরীক্ষা থেকে সরানো হয়েছে`);
      setRemoveDlg(null); setReason(""); setSelected(new Map());
      refresh();
    } catch (e) { toast.error(errMsg(e, "সরানো যায়নি")); } finally { setBusy(null); }
  };

  // ---- admit cards
  const [scope, setScope] = useState<Scope>("all");
  const [scopeBatch, setScopeBatch] = useState("");
  const [mode, setMode] = useState<GenerateMode>("changed");
  const [payload, setPayload] = useState<AdmitPayload | null>(null);
  const [qrs, setQrs] = useState<Map<string, string>>(new Map());
  const [idx, setIdx] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const selectorFor = (s: Scope, studentIds?: string[]): AdmitSelector | null => {
    if (s === "batch") return scopeBatch ? { scope: "batch", batchId: scopeBatch } : null;
    if (s === "students") { const ids = studentIds ?? [...selected.keys()]; return ids.length ? { scope: "students", studentIds: ids } : null; }
    return { scope: "all" };
  };
  const loadPreview = async (sel: AdmitSelector | null) => {
    if (!sel) { toast.error("ব্যাচ বা শিক্ষার্থী নির্বাচন করুন"); return; }
    setLoadingPreview(true);
    try {
      const data = await api.post<AdmitPayload>(`/exam-schedules/${id}/admit-cards/data`, { selector: sel, includePending: true });
      setPayload(data); setIdx(0); setQrs(await admitQrMap(data));
      if (!data.cards.length) toast.info("নির্বাচনে কোনো নির্ধারিত শিক্ষার্থী নেই");
    } catch (e) { toast.error(errMsg(e, "প্রিভিউ লোড করা যায়নি")); } finally { setLoadingPreview(false); }
  };
  const previewStudent = (studentId: string) => { setTab("admit"); setScope("students"); void loadPreview({ scope: "students", studentIds: [studentId] }).then(() => previewRef.current?.scrollIntoView({ behavior: "smooth" })); };

  const generate = async (sel: AdmitSelector | null, m: GenerateMode, quiet = false) => {
    if (!sel) { toast.error("ব্যাচ বা শিক্ষার্থী নির্বাচন করুন"); return null; }
    const r = await api.post<{ total: number; generated: number; regenerated: number; skipped: number }>(`/exam-schedules/${id}/admit-cards/generate`, { selector: sel, mode: m });
    if (!quiet || r.generated || r.regenerated) toast.success(`${n(r.generated)}টি নতুন অ্যাডমিট কার্ড, ${n(r.regenerated)}টি পুনরায় তৈরি${r.skipped ? `, ${n(r.skipped)}টি আগের মতোই` : ""}`);
    refresh();
    return r;
  };
  const doGenerate = async (sel: AdmitSelector | null, m: GenerateMode) => {
    setBusy("generate");
    try { await generate(sel, m); if (payload && sel) await loadPreview(sel); } catch (e) { toast.error(errMsg(e, "তৈরি করা যায়নি")); } finally { setBusy(null); }
  };
  const doPrint = async (sel: AdmitSelector | null, choice: PrintChoice) => {
    if (!sel) { toast.error("ব্যাচ বা শিক্ষার্থী নির্বাচন করুন"); return; }
    const h = startPrintWindow("অ্যাডমিট কার্ড");
    if (!h.win) { toast.error("পপ-আপ ব্লক হয়েছে — ব্রাউজারে এই সাইটের পপ-আপ অনুমতি দিন"); return; }
    setBusy("print");
    try {
      // Admin on a published exam: generate missing and refresh changed cards first, so print always matches the record.
      if (canManage && exam?.status === "published") await generate(sel, "changed", true);
      const data = await api.post<AdmitPayload>(`/exam-schedules/${id}/admit-cards/data`, { selector: sel, includePending: false });
      if (!data.cards.length) { h.close(); toast.error(exam?.status === "published" ? "প্রিন্ট করার মতো অ্যাডমিট কার্ড নেই" : "এখনো কোনো অ্যাডমিট কার্ড তৈরি হয়নি — আগে পরীক্ষা প্রকাশ করুন"); return; }
      await printAdmitCards(h, data, { perPage: choice.key === "p2" ? 2 : 1, pdf: !!choice.pdf });
    } catch (e) { h.close(); toast.error(errMsg(e, "প্রিন্ট প্রস্তুত করা যায়নি")); } finally { setBusy(null); }
  };

  if (examQ.isError) {
    return <DashboardLayout><div className="space-y-4"><Link to={base} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />সব পরীক্ষা</Link><Card><ErrorState message={errMsg(examQ.error, "পরীক্ষা লোড করা যায়নি")} onRetry={() => examQ.refetch()} /></Card></div></DashboardLayout>;
  }
  if (!exam) return <DashboardLayout><ListSkeleton rows={8} /></DashboardLayout>;

  const c = exam.counts;
  const settings = payload?.settings ?? conf.data?.settings;
  const institution = payload?.institution ?? conf.data?.institution;
  const cur = payload?.cards[idx];
  const timeText = [formatTime12(exam.startTime), formatTime12(exam.endTime)].filter(Boolean).join(" – ");
  const published = exam.status === "published";

  const statusActions: { to: ExamStatus; label: string; icon: typeof Send; variant?: "default" | "outline"; dlg: { title: string; body: string; reason?: boolean } }[] = [];
  if (canManage) {
    if (exam.status === "draft") statusActions.push({ to: "published", label: "প্রকাশ করুন", icon: Send, variant: "default", dlg: { title: "পরীক্ষা প্রকাশ করবেন?", body: `প্রকাশের পর অ্যাডমিট কার্ড তৈরি করা যাবে এবং নির্ধারিত শিক্ষার্থীরা পোর্টালে পরীক্ষাটি দেখতে পাবে।${c.assigned ? "" : " এখনো কোনো শিক্ষার্থী নির্ধারণ করা হয়নি।"}` } });
    if (exam.status === "published") {
      statusActions.push({ to: "completed", label: "সম্পন্ন", icon: CheckCircle2, dlg: { title: "পরীক্ষা সম্পন্ন চিহ্নিত করবেন?", body: "সম্পন্ন পরীক্ষা সম্পাদনা বা শিক্ষার্থী পরিবর্তন করা যায় না। প্রয়োজনে পরে আবার প্রকাশ করা যাবে।" } });
      statusActions.push({ to: "draft", label: "অপ্রকাশ (খসড়া)", icon: RotateCcw, dlg: { title: "খসড়ায় ফেরত নেবেন?", body: "খসড়া অবস্থায় শিক্ষার্থীরা পোর্টালে অ্যাডমিট কার্ড দেখতে পাবে না এবং QR যাচাইয়ে “প্রকাশিত নয়” দেখাবে।" } });
    }
    if (exam.status === "completed") statusActions.push({ to: "published", label: "পুনরায় প্রকাশ", icon: Send, dlg: { title: "আবার প্রকাশিত অবস্থায় নেবেন?", body: "সম্পাদনা ও শিক্ষার্থী পরিবর্তন আবার করা যাবে।" } });
    if (exam.status === "cancelled") statusActions.push({ to: "draft", label: "খসড়ায় ফেরত", icon: RotateCcw, dlg: { title: "বাতিল পরীক্ষা খসড়ায় ফেরত নেবেন?", body: "এরপর সম্পাদনা করে আবার প্রকাশ করা যাবে।" } });
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Link to={base} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden />সব পরীক্ষা</Link>
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold sm:text-3xl">{exam.name}</h1><ExamStatusBadge status={exam.status} className="text-sm" /></div>
            <p className="text-sm text-muted-foreground">{exam.code} • {EXAM_TYPE_LABEL[exam.examType]}</p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {editable && <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" aria-hidden />সম্পাদনা</Button>}
              {statusActions.map((a) => <Button key={a.to} variant={a.variant ?? "outline"} onClick={() => { setReason(""); setStatusDlg({ to: a.to, ...a.dlg }); }}><a.icon className="h-4 w-4" aria-hidden />{a.label}</Button>)}
              {editable && <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setReason(""); setStatusDlg({ to: "cancelled", title: "পরীক্ষা বাতিল করবেন?", body: "বাতিল পরীক্ষার অ্যাডমিট কার্ড বৈধ থাকবে না (QR-এ “বাতিল” দেখাবে); শিক্ষার্থীরা পোর্টালে বাতিল হিসেবে দেখবে। রেকর্ড সংরক্ষিত থাকবে।", reason: true }); }}><Ban className="h-4 w-4" aria-hidden />বাতিল</Button>}
              {canManage && exam.status !== "completed" && c.generated === 0 && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => { setDeleteCode(""); setDeleteOpen(true); }} aria-label="পরীক্ষা মুছুন"><Trash2 className="h-4 w-4" /></Button>}
            </div>
          )}
        </header>

        {exam.status === "cancelled" && <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />পরীক্ষাটি বাতিল করা হয়েছে{exam.cancelReason ? ` — ${exam.cancelReason}` : ""}।</p>}
        {exam.status === "draft" && canManage && <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"><FileBadge className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />খসড়া — শিক্ষার্থীরা এখনো দেখতে পাচ্ছে না। শিক্ষার্থী নির্ধারণ শেষে “প্রকাশ করুন” চাপুন, তারপর অ্যাডমিট কার্ড তৈরি করুন।</p>}
        {c.outdated > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />পরীক্ষার তথ্য পরিবর্তিত হয়েছে — {n(c.outdated)}টি অ্যাডমিট কার্ড পুরনো তথ্যের। পুনরায় তৈরি করে আবার প্রিন্ট করুন।</span>
            {canManage && published && <Button size="sm" variant="outline" disabled={busy === "generate"} onClick={() => doGenerate({ scope: "all" }, "changed")}><RefreshCw className="h-3.5 w-3.5" aria-hidden />পুনরায় তৈরি করুন</Button>}
          </div>
        )}

        <Card className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            [CalendarClock, "তারিখ ও সময়", `${formatDateBn(exam.date, true)}${timeText ? ` • ${timeText}` : ""}${exam.durationMinutes ? ` (${formatDuration(exam.durationMinutes)})` : ""}`],
            [MapPin, "কেন্দ্র / কক্ষ", exam.venue ?? "—"],
            [Users, "কোর্স / ব্যাচ", `${exam.course?.name ?? "—"} • ${exam.batch?.name ?? "সকল ব্যাচ"}${exam.allowCrossBatch ? " (অন্য ব্যাচ অনুমোদিত)" : ""}`],
            [FileBadge, "বিষয় / সেশন", `${exam.subject?.name ?? "নির্দিষ্ট বিষয় নেই"}${exam.session ? ` • ${exam.session.name}` : ""}`],
          ].map(([Icon, label, value]) => {
            const I = Icon as typeof CalendarClock;
            return <div key={label as string} className="flex items-start gap-2.5"><span className="rounded-md bg-primary/10 p-2 text-primary"><I className="h-4 w-4" aria-hidden /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{label as string}</p><p className="font-medium">{value as string}</p></div></div>;
          })}
        </Card>

        {canManage && (
          <WorkflowSteps steps={[
            { label: "পরীক্ষা তৈরি", hint: exam.code, done: true },
            { label: "শিক্ষার্থী নির্ধারণ", hint: `${n(c.assigned)} জন`, done: c.assigned > 0, active: c.assigned === 0 },
            { label: "প্রকাশ", hint: exam.status === "draft" ? "এখনো খসড়া" : "প্রকাশিত", done: exam.status !== "draft" && exam.status !== "cancelled", active: c.assigned > 0 && exam.status === "draft" },
            { label: "অ্যাডমিট কার্ড", hint: `${n(c.generated)}/${n(c.assigned)} তৈরি`, done: c.assigned > 0 && c.generated === c.assigned && c.outdated === 0, active: published && c.generated < c.assigned },
          ]} />
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="students"><Users className="mr-1.5 h-4 w-4" aria-hidden />শিক্ষার্থী ({n(c.assigned)})</TabsTrigger>
            <TabsTrigger value="admit"><FileBadge className="mr-1.5 h-4 w-4" aria-hidden />অ্যাডমিট কার্ড ({n(c.generated)})</TabsTrigger>
          </TabsList>

          {/* ---------------- students */}
          <TabsContent value="students">
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, স্টুডেন্ট আইডি, রেজি. নম্বর বা মোবাইল" className="pl-9" aria-label="নির্ধারিত শিক্ষার্থী খুঁজুন" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[520px]">
                  <Select value={fBatch || "all"} onValueChange={(v) => setFBatch(v === "all" ? "" : v)}>
                    <SelectTrigger aria-label="ব্যাচ"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">সকল ব্যাচ</SelectItem>{exam.batches.filter((b) => b.batchId).map((b) => <SelectItem key={b.batchId} value={b.batchId!}>{b.batch} ({n(b.assigned)})</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={admitF || "all"} onValueChange={(v) => setAdmitF(v === "all" ? "" : v)}>
                    <SelectTrigger aria-label="অ্যাডমিট কার্ড"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">সব অ্যাডমিট</SelectItem><SelectItem value="generated">তৈরি হয়েছে</SelectItem><SelectItem value="pending">তৈরি হয়নি</SelectItem><SelectItem value="outdated">পরিবর্তিত</SelectItem></SelectContent>
                  </Select>
                  <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1"><Checkbox checked={showRemoved} onCheckedChange={(v) => setShowRemoved(!!v)} />সরানো শিক্ষার্থী</label>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span><b className="tabular-nums">{n(meta?.total ?? (asg.isLoading ? undefined : 0))}</b> জন {showRemoved ? "(সরানো)" : ""}</span>
                {editable && !showRemoved && <Button size="sm" onClick={() => setAssignOpen(true)}><UserPlus className="h-3.5 w-3.5" aria-hidden />শিক্ষার্থী যোগ করুন</Button>}
                {selected.size > 0 && !showRemoved && (
                  <>
                    <span className="text-muted-foreground">• {n(selected.size)} জন নির্বাচিত</span>
                    <Button size="sm" variant="secondary" onClick={() => { setTab("admit"); setScope("students"); void loadPreview(selectorFor("students")); }}><Eye className="h-3.5 w-3.5" aria-hidden />প্রিভিউ</Button>
                    {canManage && published && <Button size="sm" variant="secondary" disabled={busy === "generate"} onClick={() => doGenerate(selectorFor("students"), "changed")}><ShieldCheck className="h-3.5 w-3.5" aria-hidden />অ্যাডমিট তৈরি</Button>}
                    <PrintMenu size="sm" choices={PRINT_CHOICES} busy={busy === "print"} onChoose={(ch) => doPrint(selectorFor("students"), ch)} label="প্রিন্ট" />
                    {editable && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setReason(""); setRemoveDlg({ ids: [...selected.keys()], label: `${n(selected.size)} জন শিক্ষার্থী` }); }}><UserMinus className="h-3.5 w-3.5" aria-hidden />সরান</Button>}
                    <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setSelected(new Map())}>নির্বাচন মুছুন</button>
                  </>
                )}
              </div>
              <div className="mt-3">
                {asg.isError ? <ErrorState message={errMsg(asg.error, "লোড করা যায়নি")} onRetry={() => asg.refetch()} /> : asg.isLoading ? <ListSkeleton rows={5} /> : rows.length === 0 ? (
                  <EmptyState icon={Users} title={showRemoved ? "কোনো সরানো শিক্ষার্থী নেই" : "এখনো কোনো শিক্ষার্থী নির্ধারিত হয়নি"} description={editable && !showRemoved ? "ব্যাচ অনুযায়ী বা নির্দিষ্ট শিক্ষার্থী খুঁজে যোগ করুন" : undefined}
                    action={editable && !showRemoved ? <Button onClick={() => setAssignOpen(true)}><UserPlus className="h-4 w-4" aria-hidden />শিক্ষার্থী যোগ করুন</Button> : undefined} />
                ) : (
                  <>
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {!showRemoved && <TableHead className="w-10"><Checkbox checked={rows.every((r) => selected.has(r.studentId))} onCheckedChange={(v) => rows.forEach((r) => toggle(r.studentId, r.name, !!v))} aria-label="সবাইকে নির্বাচন" /></TableHead>}
                            <TableHead>শিক্ষার্থী</TableHead>
                            <TableHead>রেজি. নম্বর</TableHead>
                            <TableHead>ব্যাচ</TableHead>
                            <TableHead>{showRemoved ? "সরানো হয়েছে" : "অ্যাডমিট কার্ড"}</TableHead>
                            <TableHead className="text-right">অ্যাকশন</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r) => (
                            <TableRow key={r.assignmentId}>
                              {!showRemoved && <TableCell><Checkbox checked={selected.has(r.studentId)} onCheckedChange={(v) => toggle(r.studentId, r.name, !!v)} aria-label={`${r.name} নির্বাচন`} /></TableCell>}
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <Avatar className="h-9 w-9">{r.photo && <AvatarImage src={r.photo} alt="" className="object-cover" />}<AvatarFallback className="bg-primary/10 text-primary">{r.name.charAt(0)}</AvatarFallback></Avatar>
                                  <div className="min-w-0"><p className="truncate font-medium">{r.name}</p><p className="text-xs text-muted-foreground tabular-nums">{r.code}</p></div>
                                </div>
                              </TableCell>
                              <TableCell className="tabular-nums">{r.registrationNumber ?? "—"}</TableCell>
                              <TableCell><p>{r.batch ?? "—"}</p><p className="text-xs text-muted-foreground">{r.method === "batch" ? "ব্যাচ অনুযায়ী" : "আলাদাভাবে"} যুক্ত</p></TableCell>
                              <TableCell>
                                {showRemoved ? <span className="text-xs text-muted-foreground">{r.removedAt ? formatDateBn(r.removedAt.slice(0, 10)) : ""}{r.removeReason ? ` — ${r.removeReason}` : ""}</span> : (
                                  <>
                                    <IssueBadge issued={!!r.admit} outdated={r.admit?.outdated} label={r.admit?.cardNo} />
                                    {r.admit && <p className="mt-0.5 text-xs text-muted-foreground">{formatDateBn(r.admit.generatedAt.slice(0, 10))}{r.admit.count > 1 ? ` • ${n(r.admit.count)} বার` : ""}</p>}
                                  </>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {!showRemoved && (
                                  <div className="flex justify-end gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => previewStudent(r.studentId)} aria-label={`${r.name} অ্যাডমিট প্রিভিউ`}><Eye className="h-4 w-4" /></Button>
                                    {editable && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setReason(""); setRemoveDlg({ ids: [r.studentId], label: r.name }); }} aria-label={`${r.name} সরান`}><UserMinus className="h-4 w-4" /></Button>}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <ul className="divide-y md:hidden">
                      {rows.map((r) => (
                        <li key={r.assignmentId} className="flex items-center gap-3 py-3">
                          {!showRemoved && <Checkbox checked={selected.has(r.studentId)} onCheckedChange={(v) => toggle(r.studentId, r.name, !!v)} aria-label={`${r.name} নির্বাচন`} />}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{r.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.code} • রেজি. {r.registrationNumber ?? "—"} • {r.batch ?? "—"}</p>
                            {!showRemoved && <div className="mt-1"><IssueBadge issued={!!r.admit} outdated={r.admit?.outdated} label={r.admit?.cardNo} /></div>}
                          </div>
                          {!showRemoved && <Button size="icon" variant="ghost" onClick={() => previewStudent(r.studentId)} aria-label={`${r.name} অ্যাডমিট প্রিভিউ`}><Eye className="h-4 w-4" /></Button>}
                        </li>
                      ))}
                    </ul>
                    {meta && meta.totalPages > 1 && (
                      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-sm">
                        <span className="text-muted-foreground">পৃষ্ঠা {n(page)} / {n(meta.totalPages)}</span>
                        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>আগের</Button><Button size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>পরের</Button></div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* ---------------- admit cards */}
          <TabsContent value="admit">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Panel title="অ্যাডমিট কার্ড তৈরি ও প্রিন্ট" icon={ShieldCheck} description="সব নির্ধারিত শিক্ষার্থী, একটি ব্যাচ বা নির্বাচিত শিক্ষার্থী">
                <div className="space-y-4">
                  {!published && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{exam.status === "draft" ? "পরীক্ষা প্রকাশের পর অ্যাডমিট কার্ড তৈরি করা যাবে — এখন শুধু প্রিভিউ (খসড়া জলছাপসহ)।" : exam.status === "cancelled" ? "বাতিল পরীক্ষার অ্যাডমিট কার্ড তৈরি বা প্রিন্ট করা যায় না।" : "সম্পন্ন পরীক্ষা — আগে তৈরি কার্ড প্রিন্ট করা যাবে।"}</p>}
                  <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="grid grid-cols-3 gap-2" aria-label="কাদের অ্যাডমিট কার্ড">
                    {([["all", "সব নির্ধারিত"], ["batch", "ব্যাচ"], ["students", `নির্বাচিত (${n(selected.size)})`]] as const).map(([v, l]) => (
                      <Label key={v} htmlFor={`sc-${v}`} className={cn("flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2.5 text-center text-sm font-medium", scope === v ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted")}><RadioGroupItem id={`sc-${v}`} value={v} className="sr-only" />{l}</Label>
                    ))}
                  </RadioGroup>
                  {scope === "batch" && (
                    <Select value={scopeBatch} onValueChange={setScopeBatch}>
                      <SelectTrigger aria-label="ব্যাচ নির্বাচন"><SelectValue placeholder="ব্যাচ নির্বাচন করুন" /></SelectTrigger>
                      <SelectContent>{exam.batches.filter((b) => b.batchId).map((b) => <SelectItem key={b.batchId} value={b.batchId!}>{b.batch} — {n(b.generated)}/{n(b.assigned)}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  {scope === "students" && selected.size === 0 && <p className="text-sm text-muted-foreground">“শিক্ষার্থী” ট্যাব থেকে শিক্ষার্থী টিক দিন।</p>}
                  {canManage && published && (
                    <div className="space-y-1.5">
                      <Label>তৈরির ধরন</Label>
                      <Select value={mode} onValueChange={(v) => setMode(v as GenerateMode)}>
                        <SelectTrigger aria-label="তৈরির ধরন"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="changed">নতুন ও পরিবর্তিত কার্ড (প্রস্তাবিত)</SelectItem>
                          <SelectItem value="missing">শুধু যাদের কার্ড নেই</SelectItem>
                          <SelectItem value="all">সবগুলো পুনরায় তৈরি</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">একই শিক্ষার্থীর জন্য কখনো দ্বিতীয় কার্ড নম্বর তৈরি হয় না — পুনরায় তৈরি করলে নম্বর ও QR একই থাকে, তথ্য হালনাগাদ হয়।</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <Button variant="outline" disabled={loadingPreview} onClick={() => loadPreview(selectorFor(scope))}>{loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}প্রিভিউ</Button>
                    {canManage && published && <Button disabled={busy === "generate"} onClick={() => doGenerate(selectorFor(scope), mode)}>{busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}অ্যাডমিট কার্ড তৈরি</Button>}
                    {exam.status !== "cancelled" && <PrintMenu choices={PRINT_CHOICES} busy={busy === "print"} disabled={exam.status === "draft"} onChoose={(ch) => doPrint(selectorFor(scope), ch)} label={canManage && published ? "তৈরি ও প্রিন্ট" : "প্রিন্ট / PDF"} />}
                  </div>
                  {exam.batches.length > 0 && (
                    <ul className="space-y-1.5 border-t pt-3 text-sm">
                      {exam.batches.map((b) => (
                        <li key={b.batchId ?? "none"} className="flex items-center justify-between gap-2"><span className="truncate">{b.batch}</span><span className="tabular-nums text-muted-foreground">{n(b.generated)}/{n(b.assigned)} তৈরি</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>

              <div ref={previewRef}>
                <Panel title="প্রিভিউ" icon={Eye} description={payload ? `${n(payload.cards.length)}টি কার্ডের ${n(Math.min(idx + 1, payload.cards.length))} নম্বর` : "প্রিভিউ চাপলে এখানে দেখাবে"}
                  action={payload && payload.cards.length > 1 ? (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} aria-label="আগের কার্ড"><ChevronLeft className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIdx((i) => Math.min(payload.cards.length - 1, i + 1))} disabled={idx >= payload.cards.length - 1} aria-label="পরের কার্ড"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  ) : undefined}>
                  {loadingPreview ? <ListSkeleton rows={4} /> : !cur || !settings || !institution || !payload ? (
                    <EmptyState compact icon={FileBadge} title="এখনো প্রিভিউ নেই" description="বাম পাশ থেকে নির্বাচন করে “প্রিভিউ” চাপুন বা তালিকার 👁 বোতাম ব্যবহার করুন" />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm"><b>{cur.student.name}</b><IssueBadge issued={!!cur.admit} outdated={cur.admit?.outdated} label={cur.admit?.cardNo} /></div>
                      <div className="rounded-xl bg-muted/50 p-2 sm:p-3"><FitCard widthMm={186} maxScale={1}><AdmitCard exam={payload.exam} student={cur.student} institution={institution} settings={settings} admit={cur.admit} qrSvg={qrs.get(cur.assignmentId)} /></FitCard></div>
                      <div className="flex flex-wrap gap-2">
                        {canManage && published && <Button size="sm" variant="outline" disabled={busy === "generate"} onClick={() => doGenerate({ scope: "students", studentIds: [cur.student.id] }, cur.admit ? "all" : "missing")}>{cur.admit ? <RefreshCw className="h-3.5 w-3.5" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}{cur.admit ? "পুনরায় তৈরি" : "এই কার্ড তৈরি"}</Button>}
                        {exam.status !== "cancelled" && exam.status !== "draft" && <PrintMenu size="sm" choices={PRINT_CHOICES} busy={busy === "print"} onChoose={(ch) => doPrint({ scope: "students", studentIds: [cur.student.id] }, ch)} label="এই কার্ড প্রিন্ট" />}
                      </div>
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {canManage && (
        <>
          <ExamFormDialog open={editOpen} onOpenChange={setEditOpen} exam={exam} assignedCount={c.assigned} generatedCount={c.generated} defaultInstructions={conf.data?.settings.admitDefaultInstructions ?? ""} onSaved={() => { refresh(); setPayload(null); }} />
          <AssignStudentsDialog open={assignOpen} onOpenChange={setAssignOpen} exam={exam} onDone={refresh} />
        </>
      )}

      <AlertDialog open={!!statusDlg} onOpenChange={(o) => { if (!o && busy !== "status") setStatusDlg(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{statusDlg?.title}</AlertDialogTitle><AlertDialogDescription>{statusDlg?.body}</AlertDialogDescription></AlertDialogHeader>
          {statusDlg?.reason && <div className="space-y-1.5"><Label htmlFor="st-reason">বাতিলের কারণ *</Label><Textarea id="st-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="যেমন: অনিবার্য কারণে পরীক্ষা স্থগিত" /></div>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "status"}>না</AlertDialogCancel>
            <AlertDialogAction className={cn(statusDlg?.to === "cancelled" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")} disabled={busy === "status"} onClick={(e) => { e.preventDefault(); void changeStatus(); }}>{busy === "status" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}নিশ্চিত করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeDlg} onOpenChange={(o) => { if (!o && busy !== "remove") setRemoveDlg(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>পরীক্ষা থেকে সরাবেন?</AlertDialogTitle>
            <AlertDialogDescription><b className="text-foreground">{removeDlg?.label}</b> এই পরীক্ষা থেকে সরানো হবে। তৈরি অ্যাডমিট কার্ড আর বৈধ থাকবে না (QR-এ “সরানো” দেখাবে)। ইতিহাস সংরক্ষিত থাকবে; পরে আবার যোগ করা যাবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5"><Label htmlFor="rm-reason">কারণ (ঐচ্ছিক)</Label><Input id="rm-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "remove"}>না</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy === "remove"} onClick={(e) => { e.preventDefault(); void doRemove(); }}>{busy === "remove" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}সরান</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => { if (!o && busy !== "delete") setDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>পরীক্ষাটি স্থায়ীভাবে মুছবেন?</AlertDialogTitle>
            <AlertDialogDescription>“{exam.name}” এবং এর {n(c.assigned)} জনের নির্ধারণ মুছে যাবে — ফেরত আনা যাবে না। ভুল করে তৈরি হলেই মুছুন; নইলে “বাতিল” ব্যবহার করুন। নিশ্চিত করতে পরীক্ষার কোড <b className="text-foreground">{exam.code}</b> লিখুন।</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={deleteCode} onChange={(e) => setDeleteCode(e.target.value)} placeholder={exam.code} aria-label="পরীক্ষার কোড" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "delete"}>না</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy === "delete" || deleteCode.trim() !== exam.code} onClick={(e) => { e.preventDefault(); void doDelete(); }}>{busy === "delete" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}মুছে ফেলুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
