import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Award, CalendarRange, FileDown, FileText, Hash, Layers, Loader2, Medal, Printer, Search, SearchX, ShieldAlert, Trophy, UserRound, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PublicCard, PublicNotice, PublicShell } from "@/components/public/PublicShell";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { usePublicInstitution } from "@/lib/publicInstitution";
import { printIndividualMarksheet, downloadIndividualMarksheetPdf, printBatchMasterSheet, downloadBatchMasterSheetPdf } from "@/lib/marksheetExport";
import type { BatchMasterSheetView, IndividualResultView, MasterSheetCell, PublicBatchOption } from "@/types/marksheet";
import type { PublicInstitutionInfo } from "@/types/academic";
import { cn } from "@/lib/utils";

/**
 * Public Marksheet (no login) — "ব্যক্তিগত ফলাফল" (GET /public/results/individual)
 * and "ব্যাচ ভিত্তিক ফলাফল" (GET /public/results/batches + /batch-master-sheet).
 * All calculation, ranking and visibility rules stay on the server; this page
 * presents the response. The chosen mode is kept in the URL (?type=).
 */
type Mode = "individual" | "batch";

function friendlyError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  return "ফলাফল আনা যায়নি — একটু পরে আবার চেষ্টা করুন।";
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "এই মাস", range: () => { const t = new Date(); return [ymd(new Date(t.getFullYear(), t.getMonth(), 1)), ymd(t)]; } },
  { label: "গত ৩ মাস", range: () => { const t = new Date(); return [ymd(new Date(t.getFullYear(), t.getMonth() - 2, 1)), ymd(t)]; } },
  { label: "এই বছর", range: () => { const t = new Date(); return [ymd(new Date(t.getFullYear(), 0, 1)), ymd(t)]; } },
  { label: "গত ১২ মাস", range: () => { const t = new Date(); return [ymd(new Date(t.getFullYear() - 1, t.getMonth(), t.getDate() + 1)), ymd(t)]; } },
];

function DateRange({ start, end, onStart, onEnd, optional }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void; optional?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="ms-start">শুরু তারিখ{optional ? " (ঐচ্ছিক)" : ""}</Label><Input id="ms-start" type="date" value={start} max={end || undefined} onChange={(e) => onStart(e.target.value)} className="h-11" /></div>
        <div className="space-y-1.5"><Label htmlFor="ms-end">শেষ তারিখ{optional ? " (ঐচ্ছিক)" : ""}</Label><Input id="ms-end" type="date" value={end} min={start || undefined} onChange={(e) => onEnd(e.target.value)} className="h-11" /></div>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="দ্রুত সময়সীমা">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => { const [s, e] = p.range(); onStart(s); onEnd(e); }} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Marksheet() {
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get("type") === "batch" ? "batch" : "individual";
  const institution = usePublicInstitution();

  return (
    <PublicShell
      width={mode === "batch" ? "xl" : "lg"}
      icon={FileText}
      title="মার্কশিট ও ফলাফল"
      description="লগইন ছাড়াই ব্যক্তিগত মার্কশিট বা পুরো ব্যাচের ফলাফল শিট দেখুন, প্রিন্ট বা PDF করুন"
      back={{ to: "/info", label: "তথ্য কেন্দ্র" }}
      heroExtra={
        <div role="tablist" aria-label="ফলাফলের ধরন" className="mt-5 inline-grid w-full grid-cols-2 gap-1 rounded-xl border bg-muted/50 p-1 sm:w-auto">
          {([["individual", "ব্যক্তিগত ফলাফল", UserRound], ["batch", "ব্যাচ ভিত্তিক ফলাফল", Users]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => setParams(key === "batch" ? { type: "batch" } : {}, { replace: true })}
              className={cn("inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all", mode === key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <Icon className="h-4 w-4" aria-hidden />{label}
            </button>
          ))}
        </div>
      }
    >
      {mode === "individual" ? <IndividualScreen institution={institution} /> : <BatchScreen institution={institution} />}
    </PublicShell>
  );
}

// ---------------------------------------------------------------- Individual

function IndividualScreen({ institution }: { institution: PublicInstitutionInfo | null }) {
  const [roll, setRoll] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<IndividualResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ roll?: string; date?: string }>({});

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searching) return; // duplicate-submit prevention
    const errs: { roll?: string; date?: string } = {};
    if (!roll.trim()) errs.roll = "সঠিক রেজিস্ট্রেশন নম্বর প্রদান করুন।";
    if (!startDate || !endDate) errs.date = "সঠিক তারিখ নির্বাচন করুন।";
    else if (startDate > endDate) errs.date = "শুরু তারিখ শেষ তারিখের পরে হতে পারবে না।";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.get<IndividualResultView>(`/public/results/individual?roll=${encodeURIComponent(roll.trim())}&startDate=${startDate}&endDate=${endDate}`);
      setResult(data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      <PublicCard>
        <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] lg:items-start" onSubmit={handleSearch} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="ms-roll">রেজিস্ট্রেশন নম্বর</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="ms-roll" value={roll} onChange={(e) => { setRoll(e.target.value); setErrors((p) => ({ ...p, roll: undefined })); }} placeholder="যেমন: ১০১" className="h-11 pl-9" autoFocus aria-invalid={!!errors.roll} />
            </div>
            {errors.roll && <p className="text-xs text-destructive">{errors.roll}</p>}
          </div>
          <div>
            <DateRange start={startDate} end={endDate} onStart={(v) => { setStartDate(v); setErrors((p) => ({ ...p, date: undefined })); }} onEnd={(v) => { setEndDate(v); setErrors((p) => ({ ...p, date: undefined })); }} />
            {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
          </div>
          <Button type="submit" disabled={searching} className="h-11 lg:mt-[1.6rem]">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
            {searching ? "খোঁজা হচ্ছে..." : "ফলাফল দেখুন"}
          </Button>
        </form>
      </PublicCard>

      {searching ? <ResultSkeleton /> : error ? (
        <PublicNotice icon={SearchX} tone="error" title={error} description="রেজিস্ট্রেশন নম্বর ও তারিখ ঠিক আছে কিনা দেখে আবার চেষ্টা করুন।" />
      ) : result ? (
        <IndividualResultDisplay data={result} institution={institution} />
      ) : (
        <PublicNotice icon={Award} title="রেজিস্ট্রেশন নম্বর ও সময়সীমা দিয়ে খুঁজুন" description="দ্রুত সময়সীমা বাটন দিয়ে এক ক্লিকে তারিখ বেছে নিতে পারেন।" />
      )}
    </>
  );
}

function ResultSkeleton() {
  return <PublicCard><div className="space-y-3"><Skeleton className="h-6 w-56" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-40" /></div></PublicCard>;
}

const STATUS_TONE: Record<string, string> = {
  উত্তীর্ণ: "border-success/25 bg-success/10 text-success",
  অনুপস্থিত: "border-border bg-muted text-muted-foreground",
  অনুত্তীর্ণ: "border-destructive/25 bg-destructive/10 text-destructive",
};

function ExportButtons({ onPrint, onPdf }: { onPrint: () => void; onPdf: () => void }) {
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={onPrint}><Printer className="h-4 w-4" />প্রিন্ট</Button>
      <Button size="sm" onClick={onPdf}><FileDown className="h-4 w-4" />PDF</Button>
    </div>
  );
}

function IndividualResultDisplay({ data, institution }: { data: IndividualResultView; institution: PublicInstitutionInfo | null }) {
  const { student, dateRange, subjects, overall, details } = data;
  const passed = overall.status === "উত্তীর্ণ";
  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      <PublicCard className="overflow-hidden p-0 sm:p-0">
        <div className="flex flex-col gap-3 border-b bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">ফলাফল বিবরণী</p>
            <h2 className="truncate text-xl font-bold">{student.name}</h2>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>রেজি. <b className="text-foreground">{student.rollNumber}</b></span>
              {student.course && <span>{student.course}</span>}
              {student.batch && <span>{student.batch}</span>}
              <span className="inline-flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" aria-hidden />{dateRange.start} — {dateRange.end}</span>
            </p>
          </div>
          <ExportButtons onPrint={() => printIndividualMarksheet(data, institution ?? undefined)} onPdf={() => downloadIndividualMarksheetPdf(data, institution ?? undefined)} />
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5">
          <div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold tabular-nums">{overall.fullMarks}</p><p className="text-xs text-muted-foreground">মোট পূর্ণমান</p></div>
          <div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold tabular-nums">{overall.obtained}</p><p className="text-xs text-muted-foreground">মোট প্রাপ্ত নম্বর</p></div>
          <div className="rounded-lg bg-primary p-3 text-center text-primary-foreground"><p className="text-2xl font-bold tabular-nums">{overall.percentage}%</p><p className="text-xs opacity-80">মোট শতাংশ</p></div>
          <div className={cn("rounded-lg border p-3 text-center", passed ? "border-success/25 bg-success/10" : "border-destructive/25 bg-destructive/10")}><p className={cn("text-2xl font-bold", passed ? "text-success" : "text-destructive")}>{overall.grade}</p><p className="text-xs text-muted-foreground">গ্রেড • {overall.status}</p></div>
        </div>
      </PublicCard>

      <PublicCard>
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><Layers className="h-4 w-4 text-primary" aria-hidden />বিষয়ভিত্তিক সারসংক্ষেপ</h3>
        <ul className="space-y-3">
          {subjects.map((s) => (
            <li key={s.subject}>
              <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-medium">{s.subject}</span><span className="tabular-nums text-muted-foreground">{s.obtained}/{s.fullMarks} • <b className="text-foreground">{s.percentage}%</b> • <b className="text-primary">{s.grade}</b></span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(2, Math.min(100, s.percentage))}%` }} /></div>
            </li>
          ))}
          {subjects.length === 0 && <li className="text-sm text-muted-foreground">এই সময়ে কোনো বিষয়ে নম্বর নেই</li>}
        </ul>
      </PublicCard>

      <PublicCard className="p-0 sm:p-0">
        <h3 className="flex items-center gap-2 border-b p-4 font-semibold sm:px-5"><FileText className="h-4 w-4 text-primary" aria-hidden />বিস্তারিত ফলাফল <span className="text-sm font-normal text-muted-foreground">({details.length}টি পরীক্ষা)</span></h3>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader><TableRow><TableHead>তারিখ</TableHead><TableHead>বিষয়</TableHead><TableHead>পরীক্ষা</TableHead><TableHead className="text-right">পূর্ণমান</TableHead><TableHead className="text-right">প্রাপ্ত</TableHead><TableHead className="text-right">শতাংশ</TableHead><TableHead>অবস্থা</TableHead></TableRow></TableHeader>
            <TableBody>
              {details.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap tabular-nums">{d.date}</TableCell>
                  <TableCell>{d.subject}</TableCell>
                  <TableCell>{d.examTitle}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.fullMarks}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{d.obtained ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.percentage != null ? `${d.percentage}%` : "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_TONE[d.status]}>{d.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ul className="divide-y md:hidden">
          {details.map((d, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.examTitle}</p><p className="text-xs text-muted-foreground">{d.subject} • {d.date}</p></div>
              <div className="text-right"><p className="font-semibold tabular-nums">{d.obtained ?? "—"}<span className="text-xs font-normal text-muted-foreground">/{d.fullMarks}</span></p><Badge variant="outline" className={cn("mt-0.5 text-[11px]", STATUS_TONE[d.status])}>{d.percentage != null ? `${d.percentage}%` : d.status}</Badge></div>
            </li>
          ))}
        </ul>
      </PublicCard>
    </div>
  );
}

// ---------------------------------------------------------------- Batch

function BatchScreen({ institution }: { institution: PublicInstitutionInfo | null }) {
  const [batches, setBatches] = useState<PublicBatchOption[] | null>(null);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchesError, setBatchesError] = useState(false);
  const [batchName, setBatchName] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchMasterSheetView | null>(null);
  const [errors, setErrors] = useState<{ batch?: string; date?: string }>({});

  const loadBatches = () => {
    setLoadingBatches(true);
    setBatchesError(false);
    api.get<PublicBatchOption[]>("/public/results/batches")
      .then(setBatches)
      .catch(() => { setBatches([]); setBatchesError(true); })
      .finally(() => setLoadingBatches(false));
  };
  useEffect(loadBatches, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searching) return; // duplicate-submit prevention
    const errs: { batch?: string; date?: string } = {};
    if (!batchName) errs.batch = "সঠিক ব্যাচ নির্বাচন করুন।";
    if (startDate && endDate && startDate > endDate) errs.date = "শুরু তারিখ শেষ তারিখের পরে হতে পারবে না।";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const qs = new URLSearchParams({ batchName });
      if (startDate) qs.set("startDate", startDate);
      if (endDate) qs.set("endDate", endDate);
      setResult(await api.get<BatchMasterSheetView>(`/public/results/batch-master-sheet?${qs.toString()}`));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      <PublicCard>
        <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] lg:items-start" onSubmit={handleSearch} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="ms-batch">ব্যাচ</Label>
            <Select value={batchName} onValueChange={(v) => { setBatchName(v); setErrors((p) => ({ ...p, batch: undefined })); }} disabled={loadingBatches}>
              <SelectTrigger id="ms-batch" className="h-11" aria-invalid={!!errors.batch}><SelectValue placeholder={loadingBatches ? "লোড হচ্ছে..." : "ব্যাচ নির্বাচন করুন"} /></SelectTrigger>
              <SelectContent>
                {(batches ?? []).map((b) => <SelectItem key={b.name} value={b.name}>{b.name}{b.courseName ? ` (${b.courseName})` : ""}</SelectItem>)}
                {batches?.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">কোনো ব্যাচ পাওয়া যায়নি</div>}
              </SelectContent>
            </Select>
            {errors.batch && <p className="text-xs text-destructive">{errors.batch}</p>}
            {batchesError && <button type="button" onClick={loadBatches} className="text-xs text-primary hover:underline">ব্যাচ তালিকা লোড হয়নি — আবার চেষ্টা করুন</button>}
          </div>
          <div>
            <DateRange optional start={startDate} end={endDate} onStart={(v) => { setStartDate(v); setErrors((p) => ({ ...p, date: undefined })); }} onEnd={(v) => { setEndDate(v); setErrors((p) => ({ ...p, date: undefined })); }} />
            {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
          </div>
          <Button type="submit" disabled={searching} className="h-11 lg:mt-[1.6rem]">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
            {searching ? "খোঁজা হচ্ছে..." : "ফলাফল দেখুন"}
          </Button>
        </form>
      </PublicCard>

      {searching ? <ResultSkeleton /> : error ? (
        <PublicNotice icon={ShieldAlert} tone="error" title={error} />
      ) : result ? (
        <BatchMasterSheetDisplay data={result} institution={institution} />
      ) : (
        <PublicNotice icon={Users} title="ব্যাচ বেছে নিয়ে পুরো ব্যাচের ফলাফল দেখুন" description="তারিখ না দিলে শুরু থেকে বর্তমান পর্যন্ত সব পরীক্ষা ধরা হবে।" />
      )}
    </>
  );
}

const RANK_LABEL: Record<number, string> = { 1: "১ম", 2: "২য়", 3: "৩য়" };
const RANK_TONE: Record<number, string> = {
  1: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  2: "border-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300",
  3: "border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-500/10 dark:text-orange-300",
};

function CellValue({ cell }: { cell: MasterSheetCell }) {
  if (cell.status === "na") return <span className="text-muted-foreground">—</span>;
  if (cell.status === "absent") return <span className="text-xs text-destructive">অনুপস্থিত</span>;
  return <>{cell.value}</>;
}

function BatchMasterSheetDisplay({ data, institution }: { data: BatchMasterSheetView; institution: PublicInstitutionInfo | null }) {
  const { batch, dateRange, columns, rows } = data;
  const [q, setQ] = useState("");
  const top = useMemo(() => rows.filter((r) => r.rank).sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9)), [rows]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.name.toLowerCase().includes(t) || String(r.rollNumber).toLowerCase().includes(t)) : rows;
  }, [rows, q]);
  const avg = rows.length ? Math.round((rows.reduce((s, r) => s + r.percentage, 0) / rows.length) * 100) / 100 : null;
  const highest = rows.length ? Math.max(...rows.map((r) => r.percentage)) : null;

  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      <PublicCard className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">{batch.name}{batch.courseName ? <span className="font-normal text-muted-foreground"> — {batch.courseName}</span> : null}</h2>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" aria-hidden />{dateRange.start ?? "শুরু থেকে"} — {dateRange.end ?? "বর্তমান পর্যন্ত"}</span>
            <span>{rows.length} জন শিক্ষার্থী</span><span>{columns.length}টি পরীক্ষা</span>
            {avg !== null && <span>গড় <b className="text-foreground">{avg}%</b></span>}
            {highest !== null && <span>সর্বোচ্চ <b className="text-foreground">{highest}%</b></span>}
          </p>
        </div>
        <ExportButtons onPrint={() => printBatchMasterSheet(data, institution ?? undefined)} onPdf={() => downloadBatchMasterSheetPdf(data, institution ?? undefined)} />
      </PublicCard>

      {top.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3" aria-label="সেরা শিক্ষার্থী">
          {top.map((r) => (
            <div key={`${r.rollNumber}-${r.name}`} className={cn("flex items-center gap-3 rounded-xl border p-4", RANK_TONE[r.rank!])}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card/80">{r.rank === 1 ? <Trophy className="h-5 w-5" aria-hidden /> : <Medal className="h-5 w-5" aria-hidden />}</span>
              <div className="min-w-0"><p className="text-xs font-semibold">{RANK_LABEL[r.rank!]} স্থান</p><p className="truncate font-bold text-foreground">{r.name}</p><p className="text-xs">{r.percentage}% • রোল {r.rollNumber}</p></div>
            </div>
          ))}
        </div>
      )}

      <PublicCard className="p-0 sm:p-0">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <h3 className="font-semibold">ফলাফল শিট</h3>
          <div className="relative sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="নাম বা রোল খুঁজুন" className="h-9 pl-9" aria-label="শিক্ষার্থী খুঁজুন" /></div>
        </div>
        {shown.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">এই নামে কেউ নেই</p> : (
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 min-w-[64px] bg-muted">রোল</TableHead>
                  <TableHead className="sticky left-[64px] z-20 min-w-[150px] bg-muted">নাম</TableHead>
                  {columns.map((c, i) => (
                    <TableHead key={i} className="min-w-[92px] whitespace-nowrap text-center">
                      <div className="font-medium text-foreground">{c.subject}</div>
                      <div className="text-[10px] font-normal">{c.date} • পূর্ণ {c.fullMarks}</div>
                    </TableHead>
                  ))}
                  <TableHead className="whitespace-nowrap text-right">মোট প্রাপ্ত</TableHead>
                  <TableHead className="whitespace-nowrap text-right">পূর্ণমান</TableHead>
                  <TableHead className="whitespace-nowrap text-right">শতাংশ</TableHead>
                  <TableHead className="text-center">গ্রেড</TableHead>
                  <TableHead className="text-center">অবস্থান</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.rollNumber + r.name} className={r.rank ? "bg-primary/[0.03]" : ""}>
                    <TableCell className="sticky left-0 z-10 bg-card font-medium tabular-nums">{r.rollNumber}</TableCell>
                    <TableCell className="sticky left-[64px] z-10 whitespace-nowrap bg-card">{r.name}</TableCell>
                    {r.cells.map((c, i) => <TableCell key={i} className="text-center tabular-nums"><CellValue cell={c} /></TableCell>)}
                    <TableCell className="text-right tabular-nums">{r.totalObtained}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.totalFullMarks}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{r.percentage}%</TableCell>
                    <TableCell className="text-center">{r.grade}</TableCell>
                    <TableCell className="text-center">{r.rank ? <Badge variant="outline" className={RANK_TONE[r.rank]}>{RANK_LABEL[r.rank]}</Badge> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">"অনুপস্থিত" = পরীক্ষায় অনুপস্থিত, "—" = পরীক্ষার তালিকায় ছিলেন না (যেমন পরে ভর্তি)। মোবাইলে টেবিল ডানে-বামে সরানো যায়।</p>
      </PublicCard>
    </div>
  );
}
