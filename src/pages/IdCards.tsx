import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ChevronLeft, ChevronRight, Eye, IdCard, Loader2, Palette, RefreshCw, Search, ShieldCheck, Sparkles, Users, X,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState, ListSkeleton, Panel } from "@/components/dashboard/DashboardKit";
import { SearchSelect } from "@/components/common/SearchSelect";
import { FitCard, IdCardBack, IdCardFront } from "@/components/cards/CardDesigns";
import { CardSettingsDialog } from "@/components/cards/CardSettingsDialog";
import { IssueBadge, PrintMenu, WorkflowSteps, n, type PrintChoice } from "@/components/cards/CardKit";
import { api } from "@/lib/apiClient";
import { idQrMap, printIdCards, startPrintWindow } from "@/lib/cardPrint";
import { ApiClientError, hasPermission, useAuth } from "@/contexts/AuthContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ID_CARDS_MANAGE } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDateBn, type CardInstitution, type CardSettings, type GenerateMode, type IdCardItem, type IdCardPayload, type IdCardSelector, type IdCardStats } from "@/types/cards";

type Target = "selected" | "batch" | "course" | "all";
const PAGE = 20;
const errMsg = (e: unknown, f: string) => (e instanceof ApiClientError ? e.message : f);

const PRINT_CHOICES: PrintChoice[] = [
  { key: "a4-both", label: "A4 — সামনে ও পিছনে", hint: "প্রতি পাতায় একাধিক কার্ড, কাটার দাগসহ (ডুপ্লেক্স)" },
  { key: "a4-front", label: "A4 — শুধু সামনের দিক", hint: "কাটার দাগসহ" },
  { key: "card", label: "কার্ড সাইজ (CR80)", hint: "PVC কার্ড প্রিন্টারের জন্য" },
  { key: "pdf", label: "PDF ডাউনলোড (A4)", pdf: true },
];

/**
 * Student ID Card Management — Admin (issue, regenerate, print, design) and
 * Batch Director (preview/print their own batches only; the server enforces
 * it). Cards are always rendered from live student data; "issuing" records
 * the card (version + QR code) so outdated cards can be detected.
 */
export default function IdCards() {
  const { user } = useAuth();
  const canManage = hasPermission(user, ID_CARDS_MANAGE);
  const qc = useQueryClient();
  const { activeCourses } = useAcademic();
  const { batches } = useBatches();

  // ---- list filters
  const [search, setSearch] = useState("");
  const dSearch = useDebouncedValue(search, 350);
  const [fCourse, setFCourse] = useState("");
  const [fBatch, setFBatch] = useState("");
  const [cardStatus, setCardStatus] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [dSearch, fCourse, fBatch, cardStatus]);
  const qs = new URLSearchParams({ page: String(page), limit: String(PAGE) });
  if (dSearch.trim()) qs.set("search", dSearch.trim());
  if (fCourse) qs.set("courseId", fCourse);
  if (fBatch) qs.set("batchId", fBatch);
  if (cardStatus) qs.set("cardStatus", cardStatus);
  const list = useQuery({ queryKey: ["id-cards", "students", qs.toString()], queryFn: () => api.getWithMeta<IdCardItem[]>(`/id-cards/students?${qs}`) });
  const stats = useQuery({ queryKey: ["id-cards", "stats"], queryFn: () => api.get<IdCardStats>("/id-cards/stats") });
  const conf = useQuery({ queryKey: ["id-cards", "settings"], queryFn: () => api.get<{ settings: CardSettings; institution: CardInstitution }>("/id-cards/settings"), staleTime: 60_000 });
  const rows = list.data?.data ?? [];
  const meta = list.data?.meta as unknown as { total: number; totalPages: number } | undefined;

  // ---- target
  const [target, setTarget] = useState<Target>("batch");
  const [batchId, setBatchId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [selected, setSelected] = useState<Map<string, string>>(new Map()); // id -> name
  const toggle = (id: string, name: string, on: boolean) => setSelected((p) => { const m = new Map(p); if (on) m.set(id, name); else m.delete(id); return m; });
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.student.id));
  const selector = (): IdCardSelector | null => {
    if (target === "selected") return selected.size ? { studentIds: [...selected.keys()] } : null;
    if (target === "batch") return batchId ? { batchId } : null;
    if (target === "course") return courseId ? { courseId } : null;
    return { all: true };
  };
  const targetLabel = target === "selected" ? `${n(selected.size)} জন নির্বাচিত শিক্ষার্থী`
    : target === "batch" ? (batches.find((b) => b.id === batchId)?.name ?? "ব্যাচ নির্বাচন করুন")
    : target === "course" ? (activeCourses.find((c) => c.id === courseId)?.name ?? "কোর্স নির্বাচন করুন")
    : "সকল সক্রিয় শিক্ষার্থী";

  // ---- preview
  const [payload, setPayload] = useState<IdCardPayload | null>(null);
  const [qrs, setQrs] = useState<Map<string, string>>(new Map());
  const [idx, setIdx] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const loadPreview = async (sel: IdCardSelector | null, scroll = false) => {
    if (!sel) { toast.error("আগে শিক্ষার্থী, ব্যাচ বা কোর্স নির্বাচন করুন"); return; }
    setLoadingPreview(true);
    try {
      const data = await api.post<IdCardPayload>("/id-cards/data", sel);
      setPayload(data);
      setIdx(0);
      setQrs(await idQrMap(data));
      if (!data.cards.length) toast.info("নির্বাচনে কোনো সক্রিয় শিক্ষার্থী নেই");
      if (scroll) previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      toast.error(errMsg(e, "প্রিভিউ লোড করা যায়নি"));
    } finally {
      setLoadingPreview(false);
    }
  };
  const cur = payload?.cards[idx] ?? null;
  const settings = payload?.settings ?? conf.data?.settings;
  const institution = payload?.institution ?? conf.data?.institution;

  // ---- generate
  const [confirm, setConfirm] = useState<{ sel: IdCardSelector; label: string } | null>(null);
  const [mode, setMode] = useState<GenerateMode>("changed");
  const [busy, setBusy] = useState<"generate" | "print" | null>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["id-cards"] }); };
  const runGenerate = async (sel: IdCardSelector, m: GenerateMode, quiet = false) => {
    const r = await api.post<{ total: number; created: number; reissued: number; skipped: number }>("/id-cards/generate", { selector: sel, mode: m });
    if (!quiet || r.created || r.reissued) toast.success(`${n(r.created)}টি নতুন কার্ড ইস্যু, ${n(r.reissued)}টি পুনরায় ইস্যু${r.skipped ? `, ${n(r.skipped)}টি আগের মতোই` : ""}`);
    refresh();
    return r;
  };
  const doGenerate = async () => {
    if (!confirm) return;
    setBusy("generate");
    try {
      await runGenerate(confirm.sel, mode);
      setConfirm(null);
      if (payload) await loadPreview(confirm.sel);
    } catch (e) {
      toast.error(errMsg(e, "কার্ড ইস্যু করা যায়নি"));
    } finally {
      setBusy(null);
    }
  };

  // ---- print (opens the window first so the popup isn't blocked)
  const doPrint = async (sel: IdCardSelector | null, choice: PrintChoice) => {
    if (!sel) { toast.error("আগে শিক্ষার্থী, ব্যাচ বা কোর্স নির্বাচন করুন"); return; }
    const h = startPrintWindow("আইডি কার্ড");
    if (!h.win) { toast.error("পপ-আপ ব্লক হয়েছে — ব্রাউজারে এই সাইটের পপ-আপ অনুমতি দিন"); return; }
    setBusy("print");
    try {
      // Admin: issue missing cards and re-issue changed ones first, so the printed card always matches the record.
      if (canManage) await runGenerate(sel, "changed", true);
      const data = await api.post<IdCardPayload>("/id-cards/data", sel);
      const cards = data.cards.filter((c) => c.card);
      if (!cards.length) { h.close(); toast.error("প্রিন্ট করার মতো ইস্যুকৃত কার্ড নেই"); return; }
      if (cards.length < data.cards.length) toast.warning(`${n(data.cards.length - cards.length)} জনের কার্ড এখনো ইস্যু হয়নি — তাদের বাদ রেখে প্রিন্ট হচ্ছে`);
      await printIdCards(h, { ...data, cards }, {
        sides: choice.key === "a4-front" ? "front" : "both",
        paper: choice.key === "card" ? "card" : "a4",
        pdf: !!choice.pdf,
      });
    } catch (e) {
      h.close();
      toast.error(errMsg(e, "প্রিন্ট প্রস্তুত করা যায়নি"));
    } finally {
      setBusy(null);
    }
  };

  const [settingsOpen, setSettingsOpen] = useState(false);
  const s = stats.data;
  const widthMm = settings?.idCardLayout === "portrait" ? 53.98 : 85.6;
  const batchOptions = useMemo(() => batches.filter((b) => !fCourse || b.courseId === fCourse).map((b) => ({ value: b.id, label: b.name })), [batches, fCourse]);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"><IdCard className="h-7 w-7 text-primary" aria-hidden />আইডি কার্ড ব্যবস্থাপনা</h1>
            <p className="text-sm text-muted-foreground">{canManage ? "শিক্ষার্থী, ব্যাচ বা কোর্স বেছে নিন → প্রিভিউ → ইস্যু → প্রিন্ট বা PDF" : "আপনার ব্যাচের শিক্ষার্থীদের ইস্যুকৃত আইডি কার্ড প্রিভিউ ও প্রিন্ট"}</p>
          </div>
          {canManage && settings && institution && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)}><Palette className="h-4 w-4" aria-hidden />ডিজাইন সেটিংস</Button>
          )}
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard title="মোট শিক্ষার্থী" value={n(s?.totalStudents)} icon={Users} variant="primary" description="সক্রিয় ও অনুমোদিত" loading={stats.isLoading} />
          <StatCard title="ইস্যুকৃত আইডি কার্ড" value={n(s?.issued)} icon={ShieldCheck} variant="success" description={s ? `আজ ${n(s.issuedToday)}টি` : undefined} loading={stats.isLoading} onClick={() => setCardStatus("issued")} />
          <StatCard title="কার্ড ছাড়া শিক্ষার্থী" value={n(s?.withoutCard)} icon={IdCard} variant="warning" description="এখনো ইস্যু হয়নি" loading={stats.isLoading} onClick={() => setCardStatus("not_issued")} />
          <StatCard title="তথ্য পরিবর্তিত" value={n(s?.outdated)} icon={RefreshCw} variant="danger" description="পুনরায় ইস্যু প্রয়োজন" loading={stats.isLoading} onClick={() => setCardStatus("outdated")} />
        </div>

        <WorkflowSteps steps={[
          { label: "নির্বাচন", hint: targetLabel, done: !!selector(), active: !selector() },
          { label: "প্রিভিউ", hint: payload ? `${n(payload.cards.length)}টি কার্ড` : "লাইভ প্রিভিউ দেখুন", done: !!payload, active: !!selector() && !payload },
          { label: canManage ? "ইস্যু" : "ইস্যুকৃত কার্ড", hint: canManage ? "নতুন ও পরিবর্তিত কার্ড" : "অফিস ইস্যু করে", active: !!payload },
          { label: "প্রিন্ট / PDF", hint: "A4 শিট বা কার্ড সাইজ" },
        ]} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Generation panel */}
          <Panel title="কার্ড তৈরি" description="কাদের কার্ড — একজন, একাধিক, পুরো ব্যাচ, কোর্স বা সবাই" icon={Sparkles}>
            <div className="space-y-4">
              <RadioGroup value={target} onValueChange={(v) => setTarget(v as Target)} className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="কাদের কার্ড">
                {([["batch", "ব্যাচ"], ["course", "কোর্স"], ["selected", "নির্বাচিত"], ["all", "সবাই"]] as const).map(([v, l]) => (
                  <Label key={v} htmlFor={`t-${v}`} className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors", target === v ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted")}>
                    <RadioGroupItem id={`t-${v}`} value={v} className="sr-only" />{l}{v === "selected" && selected.size > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{n(selected.size)}</span>}
                  </Label>
                ))}
              </RadioGroup>
              {target === "batch" && <SearchSelect label="ব্যাচ" value={batchId} onChange={setBatchId} placeholder="ব্যাচ নির্বাচন করুন" options={batches.map((b) => ({ value: b.id, label: b.name, sub: activeCourses.find((c) => c.id === b.courseId)?.name }))} />}
              {target === "course" && <SearchSelect label="কোর্স" value={courseId} onChange={setCourseId} placeholder="কোর্স নির্বাচন করুন" options={activeCourses.map((c) => ({ value: c.id, label: c.name }))} />}
              {target === "selected" && (
                selected.size === 0 ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">নিচের তালিকা থেকে এক বা একাধিক শিক্ষার্থী টিক দিন।</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {[...selected].slice(0, 12).map(([id, name]) => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 py-0.5 pl-2.5 pr-1 text-xs text-primary">{name}<button type="button" onClick={() => toggle(id, name, false)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/15" aria-label={`${name} বাদ দিন`}><X className="h-3 w-3" /></button></span>
                    ))}
                    {selected.size > 12 && <span className="text-xs text-muted-foreground">+{n(selected.size - 12)} জন</span>}
                    <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setSelected(new Map())}>সব বাদ দিন</button>
                  </div>
                )
              )}
              {target === "all" && <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{canManage ? "সকল সক্রিয় ও অনুমোদিত শিক্ষার্থী (সর্বোচ্চ ১০০০ জন একবারে)।" : "আপনার সকল ব্যাচের সক্রিয় শিক্ষার্থী।"}</p>}
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => loadPreview(selector())} disabled={loadingPreview}>{loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}প্রিভিউ</Button>
                {canManage && <Button onClick={() => { const sel = selector(); if (!sel) toast.error("আগে শিক্ষার্থী, ব্যাচ বা কোর্স নির্বাচন করুন"); else { setMode("changed"); setConfirm({ sel, label: targetLabel }); } }}><ShieldCheck className="h-4 w-4" aria-hidden />ইস্যু করুন</Button>}
                <PrintMenu choices={PRINT_CHOICES} busy={busy === "print"} onChoose={(c) => doPrint(selector(), c)} label={canManage ? "ইস্যু ও প্রিন্ট" : "প্রিন্ট / PDF"} />
              </div>
            </div>
          </Panel>

          {/* Live preview */}
          <div ref={previewRef}>
            <Panel title="লাইভ প্রিভিউ" description={payload ? `${n(payload.cards.length)}টি কার্ডের ${n(Math.min(idx + 1, payload.cards.length))} নম্বর` : "প্রিভিউ চাপলে এখানে কার্ড দেখাবে"} icon={Eye}
              action={payload && payload.cards.length > 1 ? (
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} aria-label="আগের কার্ড"><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIdx((i) => Math.min(payload.cards.length - 1, i + 1))} disabled={idx >= payload.cards.length - 1} aria-label="পরের কার্ড"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              ) : undefined}>
              {loadingPreview ? <ListSkeleton rows={3} /> : !cur || !settings || !institution ? (
                <EmptyState compact icon={IdCard} title="এখনো প্রিভিউ নেই" description="বাম পাশ থেকে ব্যাচ/কোর্স/শিক্ষার্থী বেছে “প্রিভিউ” চাপুন বা তালিকার 👁 বোতাম ব্যবহার করুন" />
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <b>{cur.student.name}</b>
                    <IssueBadge issued={!!cur.card} outdated={cur.card?.outdated} label={cur.card ? `ইস্যুকৃত · v${cur.card.version}` : undefined} />
                    {cur.card && <span className="text-xs text-muted-foreground">{formatDateBn(cur.card.generatedAt.slice(0, 10))}</span>}
                  </div>
                  {cur.card?.outdated && <p className="flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-warning"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />ইস্যুর পরে শিক্ষার্থীর তথ্য পরিবর্তিত হয়েছে — পুনরায় ইস্যু করে নতুন কার্ড প্রিন্ট করুন।</p>}
                  <div className={cn("grid gap-3 rounded-xl bg-muted/50 p-3 sm:p-4", settings.idCardShowBack && "md:grid-cols-2")}>
                    <FitCard widthMm={widthMm} maxScale={settings.idCardLayout === "portrait" ? 1.2 : 1.5}>
                      <IdCardFront student={cur.student} institution={institution} settings={settings} validUntil={cur.validUntil} qrSvg={qrs.get(cur.student.id)} preview={!cur.card} />
                    </FitCard>
                    {settings.idCardShowBack && (
                      <FitCard widthMm={widthMm} maxScale={settings.idCardLayout === "portrait" ? 1.2 : 1.5}>
                        <IdCardBack student={cur.student} institution={institution} settings={settings} qrSvg={qrs.get(cur.student.id)} preview={!cur.card} />
                      </FitCard>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canManage && <Button size="sm" variant="outline" onClick={() => { setMode(cur.card ? "all" : "changed"); setConfirm({ sel: { studentIds: [cur.student.id] }, label: cur.student.name }); }}>{cur.card ? <RefreshCw className="h-3.5 w-3.5" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}{cur.card ? "পুনরায় ইস্যু" : "এই কার্ড ইস্যু করুন"}</Button>}
                    <PrintMenu size="sm" choices={PRINT_CHOICES} busy={busy === "print"} onChoose={(c) => doPrint({ studentIds: [cur.student.id] }, c)} label="এই কার্ড প্রিন্ট" />
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* Students */}
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, স্টুডেন্ট আইডি, রেজিস্ট্রেশন নম্বর বা মোবাইল" className="pl-9" aria-label="শিক্ষার্থী খুঁজুন" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-[560px]">
              <SearchSelect label="কোর্স ফিল্টার" value={fCourse} onChange={(v) => { setFCourse(v); setFBatch(""); }} placeholder="সকল কোর্স" allLabel="সকল কোর্স" options={activeCourses.map((c) => ({ value: c.id, label: c.name }))} />
              <SearchSelect label="ব্যাচ ফিল্টার" value={fBatch} onChange={setFBatch} placeholder="সকল ব্যাচ" allLabel="সকল ব্যাচ" options={batchOptions} />
              <Select value={cardStatus || "all"} onValueChange={(v) => setCardStatus(v === "all" ? "" : v)}>
                <SelectTrigger aria-label="কার্ডের অবস্থা"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব কার্ড</SelectItem>
                  <SelectItem value="issued">ইস্যুকৃত</SelectItem>
                  <SelectItem value="not_issued">ইস্যু হয়নি</SelectItem>
                  <SelectItem value="outdated">তথ্য পরিবর্তিত</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span><b className="tabular-nums">{n(meta?.total ?? (list.isLoading ? undefined : 0))}</b> জন শিক্ষার্থী</span>
            {selected.size > 0 && (
              <>
                <span className="text-muted-foreground">• {n(selected.size)} জন নির্বাচিত</span>
                <Button size="sm" variant="secondary" onClick={() => { setTarget("selected"); void loadPreview({ studentIds: [...selected.keys()] }, true); }}><Eye className="h-3.5 w-3.5" aria-hidden />নির্বাচিতদের প্রিভিউ</Button>
                {canManage && <Button size="sm" onClick={() => { setTarget("selected"); setMode("changed"); setConfirm({ sel: { studentIds: [...selected.keys()] }, label: `${n(selected.size)} জন নির্বাচিত শিক্ষার্থী` }); }}><ShieldCheck className="h-3.5 w-3.5" aria-hidden />নির্বাচিতদের ইস্যু</Button>}
                <PrintMenu size="sm" choices={PRINT_CHOICES} busy={busy === "print"} onChoose={(c) => doPrint({ studentIds: [...selected.keys()] }, c)} label="নির্বাচিতদের প্রিন্ট" />
                <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setSelected(new Map())}>নির্বাচন মুছুন</button>
              </>
            )}
          </div>

          <div className="mt-3">
            {list.isError ? <ErrorState message={errMsg(list.error, "তালিকা লোড করা যায়নি")} onRetry={() => list.refetch()} /> : list.isLoading ? <ListSkeleton rows={6} /> : rows.length === 0 ? (
              <EmptyState icon={Users} title="কোনো শিক্ষার্থী পাওয়া যায়নি" description="ফিল্টার পরিবর্তন করে দেখুন" />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"><Checkbox checked={allOnPage} onCheckedChange={(v) => rows.forEach((r) => toggle(r.student.id, r.student.name, !!v))} aria-label="এই পাতার সবাইকে নির্বাচন" /></TableHead>
                        <TableHead>শিক্ষার্থী</TableHead>
                        <TableHead>রেজি. নম্বর</TableHead>
                        <TableHead>কোর্স / ব্যাচ</TableHead>
                        <TableHead>আইডি কার্ড</TableHead>
                        <TableHead className="text-right">অ্যাকশন</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.student.id} data-state={selected.has(r.student.id) ? "selected" : undefined}>
                          <TableCell><Checkbox checked={selected.has(r.student.id)} onCheckedChange={(v) => toggle(r.student.id, r.student.name, !!v)} aria-label={`${r.student.name} নির্বাচন`} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-9 w-9">{r.student.photo && <AvatarImage src={r.student.photo} alt="" className="object-cover" />}<AvatarFallback className="bg-primary/10 text-primary">{r.student.name.charAt(0)}</AvatarFallback></Avatar>
                              <div className="min-w-0"><p className="truncate font-medium">{r.student.name}</p><p className="text-xs text-muted-foreground tabular-nums">{r.student.studentId}</p></div>
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums">{r.student.registrationNumber ?? "—"}</TableCell>
                          <TableCell><p className="text-sm">{r.student.course ?? "—"}</p><p className="text-xs text-muted-foreground">{r.student.batch ?? "ব্যাচ নেই"}</p></TableCell>
                          <TableCell>
                            <IssueBadge issued={!!r.card} outdated={r.card?.outdated} label={r.card ? `v${r.card.version}` : undefined} />
                            {r.card && <p className="mt-0.5 text-xs text-muted-foreground">{formatDateBn(r.card.generatedAt.slice(0, 10))}</p>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => loadPreview({ studentIds: [r.student.id] }, true)} aria-label={`${r.student.name} প্রিভিউ`}><Eye className="h-4 w-4" /></Button>
                              {canManage && <Button size="sm" variant="ghost" onClick={() => { setMode(r.card ? "all" : "changed"); setConfirm({ sel: { studentIds: [r.student.id] }, label: r.student.name }); }}>{r.card ? "পুনরায় ইস্যু" : "ইস্যু"}</Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="divide-y md:hidden">
                  {rows.map((r) => (
                    <li key={r.student.id} className="flex items-center gap-3 py-3">
                      <Checkbox checked={selected.has(r.student.id)} onCheckedChange={(v) => toggle(r.student.id, r.student.name, !!v)} aria-label={`${r.student.name} নির্বাচন`} />
                      <Avatar className="h-10 w-10">{r.student.photo && <AvatarImage src={r.student.photo} alt="" className="object-cover" />}<AvatarFallback className="bg-primary/10 text-primary">{r.student.name.charAt(0)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.student.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.student.studentId} • রেজি. {r.student.registrationNumber ?? "—"} • {r.student.batch ?? "ব্যাচ নেই"}</p>
                        <div className="mt-1"><IssueBadge issued={!!r.card} outdated={r.card?.outdated} label={r.card ? `v${r.card.version}` : undefined} /></div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => loadPreview({ studentIds: [r.student.id] }, true)} aria-label={`${r.student.name} প্রিভিউ`}><Eye className="h-4 w-4" /></Button>
                    </li>
                  ))}
                </ul>
                {meta && meta.totalPages > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-sm">
                    <span className="text-muted-foreground">পৃষ্ঠা {n(page)} / {n(meta.totalPages)}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>আগের</Button>
                      <Button size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>পরের</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {(s?.recent.length ?? 0) > 0 && (
          <Panel title="সাম্প্রতিক ইস্যুকৃত আইডি কার্ড" icon={ShieldCheck}>
            <ul className="grid gap-x-6 divide-y sm:grid-cols-2 sm:divide-y-0">
              {s!.recent.map((r) => (
                <li key={r.studentId} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium">{r.name}</span><span className="block truncate text-xs text-muted-foreground">{r.code}{r.batch ? ` • ${r.batch}` : ""} • v{r.version}</span></span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateBn(String(r.generatedAt).slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o && busy !== "generate") setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>আইডি কার্ড ইস্যু করুন</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>কার জন্য: <b className="text-foreground">{confirm?.label}</b> (শুধু সক্রিয় ও অনুমোদিত শিক্ষার্থী)</p>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as GenerateMode)} className="space-y-1.5">
                  {([
                    ["changed", "নতুন ও পরিবর্তিত কার্ড", "যাদের কার্ড নেই তাদের ইস্যু, তথ্য বদলেছে এমন কার্ড পুনরায় ইস্যু"],
                    ["missing", "শুধু নতুন কার্ড", "যাদের কার্ড আছে তাদের কিছু হবে না"],
                    ["all", "সবগুলো পুনরায় ইস্যু", "নতুন ভার্সন ও নতুন QR — আগের প্রিন্ট করা কার্ডের QR “প্রতিস্থাপিত” দেখাবে"],
                  ] as const).map(([v, l, h]) => (
                    <Label key={v} htmlFor={`m-${v}`} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 font-normal text-foreground", mode === v && "border-primary bg-primary/5")}>
                      <RadioGroupItem id={`m-${v}`} value={v} className="mt-0.5" /><span>{l}<span className="block text-xs text-muted-foreground">{h}</span></span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "generate"}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void doGenerate(); }} disabled={busy === "generate"}>{busy === "generate" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}ইস্যু করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canManage && settings && institution && (
        <CardSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} institution={institution} sample={cur?.student ?? rows[0]?.student ?? null}
          onSaved={(ns) => { qc.setQueryData(["id-cards", "settings"], { settings: ns, institution }); setPayload((p) => (p ? { ...p, settings: ns } : p)); if (payload) void idQrMap({ ...payload, settings: ns }).then(setQrs); }} />
      )}
    </DashboardLayout>
  );
}
