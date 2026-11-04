import { useState } from "react";
import { BookOpen, CalendarCheck, GraduationCap, Layers, Loader2, Phone, Search, SearchX, ShieldAlert, Trophy, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicCard, PublicNotice, PublicShell } from "@/components/public/PublicShell";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";

/**
 * Public student search (/info/search) — the same GET /public/students API,
 * always method=phone (the page's existing restriction), with the
 * admin-configured PublicInfoSettings deciding which fields come back. The
 * server enforces enable/disable, rate limits and field visibility; this
 * page only renders whatever it is allowed to return.
 */
interface PublicStudentResult {
  name?: string;
  registrationId?: string;
  rollNumber?: string | null;
  course?: string | null;
  currentBatch?: string | null;
  batchDirector?: string | null;
  admissionStatus?: string;
  resultSummary?: { averagePercent: number | null; examsTaken: number };
  attendanceSummary?: { percent: number | null };
  photo?: string | null;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toAscii = (v: string) => v.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

function friendlyError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.message.includes("disabled")) return "এই মুহূর্তে পাবলিক তথ্য অনুসন্ধান বন্ধ আছে";
    if (err.message.includes("not enabled")) return "এই পদ্ধতিতে অনুসন্ধান সক্রিয় নেই";
    return err.message;
  }
  return "অনুসন্ধান ব্যর্থ হয়েছে — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন";
}

function Info({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="truncate text-sm font-medium">{value}</p></div>
    </div>
  );
}

function Meter({ icon: Icon, label, value, pct }: { icon: typeof Trophy; label: string; value: string; pct: number | null }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden />{label}</span><b className="tabular-nums">{value}</b></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct ?? 0}%` }} /></div>
    </div>
  );
}

export default function PublicStudentSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicStudentResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = toAscii(q.trim());
    if (value.length < 2) { setFieldError("অন্তত ২ অক্ষর দিয়ে অনুসন্ধান করুন"); return; }
    setFieldError(null);
    setSearching(true);
    setError(null);
    try {
      const data = await api.get<PublicStudentResult[]>(`/public/students?method=phone&q=${encodeURIComponent(value)}`);
      setResults(data);
    } catch (err) {
      setResults(null);
      setError(friendlyError(err));
    } finally {
      setSearching(false);
    }
  };

  return (
    <PublicShell
      icon={Search}
      title="শিক্ষার্থী তথ্য অনুসন্ধান"
      description="ভর্তির সময় দেওয়া মোবাইল নম্বর দিয়ে খুঁজুন — লগইন প্রয়োজন নেই"
      back={{ to: "/info", label: "তথ্য কেন্দ্র" }}
      heroExtra={
        <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch} noValidate>
          <div className="relative flex-1">
            <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); if (fieldError) setFieldError(null); }}
              placeholder="01XXXXXXXXX"
              inputMode="tel"
              autoComplete="off"
              aria-label="মোবাইল নম্বর"
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? "search-error" : undefined}
              className="h-12 pl-10 pr-10 text-base"
            />
            {q && <button type="button" onClick={() => { setQ(""); setResults(null); setError(null); }} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="মুছুন"><X className="h-4 w-4" /></button>}
          </div>
          <Button type="submit" disabled={searching} className="h-12 px-6 text-base">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
            {searching ? "খোঁজা হচ্ছে..." : "খুঁজুন"}
          </Button>
          {fieldError && <p id="search-error" className="text-sm text-destructive sm:hidden">{fieldError}</p>}
        </form>
      }
    >
      {fieldError && <p className="hidden text-sm text-destructive sm:block" role="alert">{fieldError}</p>}

      {searching ? (
        <PublicCard><div className="flex items-center gap-4"><Skeleton className="h-20 w-20 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-32" /></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div></PublicCard>
      ) : error ? (
        <PublicNotice icon={ShieldAlert} tone="error" title={error} description="সমস্যা থাকলে প্রতিষ্ঠানের অফিসে যোগাযোগ করুন।" />
      ) : results && results.length === 0 ? (
        <PublicNotice icon={SearchX} title="এই নম্বরে কোনো শিক্ষার্থী পাওয়া যায়নি" description="নম্বরটি ঠিক আছে কিনা দেখে আবার চেষ্টা করুন — ভর্তির সময় যে নম্বর দিয়েছিলেন সেটিই লাগবে।" />
      ) : results ? (
        <>
          <p className="text-sm text-muted-foreground">{results.length} জন শিক্ষার্থী পাওয়া গেছে</p>
          {results.map((r, i) => {
            const identity = [r.rollNumber ? `রেজিস্ট্রেশন: ${r.rollNumber}` : null, r.registrationId ? `আইডি: ${r.registrationId}` : null].filter(Boolean).join(" • ");
            return (
              <PublicCard key={i} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                    {r.photo ? <img src={r.photo} alt="" className="h-full w-full object-cover" /> : r.name ? <span className="text-2xl font-bold text-primary">{r.name.charAt(0)}</span> : <GraduationCap className="h-8 w-8 text-muted-foreground" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {r.name && <p className="truncate text-lg font-bold">{r.name}</p>}
                    {identity && <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{identity}</p>}
                    {r.admissionStatus && <Badge variant="outline" className="mt-1.5 border-success/25 bg-success/10 text-success">{r.admissionStatus}</Badge>}
                  </div>
                </div>
                {(r.course || r.currentBatch || r.batchDirector) && (
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {r.course && <Info icon={BookOpen} label="কোর্স" value={r.course} />}
                    {r.currentBatch && <Info icon={Layers} label="বর্তমান ব্যাচ" value={r.currentBatch} />}
                    {r.batchDirector && <Info icon={UserCog} label="ব্যাচ ডিরেক্টর" value={r.batchDirector} />}
                  </div>
                )}
                {(r.attendanceSummary || r.resultSummary) && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {r.attendanceSummary && <Meter icon={CalendarCheck} label="উপস্থিতির হার" value={r.attendanceSummary.percent != null ? `${r.attendanceSummary.percent}%` : "তথ্য নেই"} pct={r.attendanceSummary.percent} />}
                    {r.resultSummary && <Meter icon={Trophy} label={r.resultSummary.averagePercent != null ? `${r.resultSummary.examsTaken}টি পরীক্ষার গড়` : "ফলাফল"} value={r.resultSummary.averagePercent != null ? `${r.resultSummary.averagePercent}%` : "তথ্য নেই"} pct={r.resultSummary.averagePercent} />}
                  </div>
                )}
              </PublicCard>
            );
          })}
        </>
      ) : (
        <PublicNotice icon={Search} title="মোবাইল নম্বর লিখে খুঁজুন" description="বাংলা বা ইংরেজি যেকোনো সংখ্যায় লিখতে পারেন। প্রতিষ্ঠান যে তথ্য প্রকাশের অনুমতি দিয়েছে শুধু তা-ই দেখানো হবে।" />
      )}
    </PublicShell>
  );
}
