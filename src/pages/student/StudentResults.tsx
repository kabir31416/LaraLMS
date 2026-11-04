import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Award, BookOpen, FileText, Printer, Search, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, ListSkeleton, Panel } from "@/components/dashboard/DashboardKit";
import { ExamTrendChart, TrendChip, pctText } from "@/components/analytics/PerformanceKit";
import { MiniStat, StudentPage, useMyPerformance } from "@/components/student/StudentPortalKit";
import { printIndividualMarksheet } from "@/lib/marksheetExport";
import { usePublicInstitution } from "@/lib/publicInstitution";
import { cn } from "@/lib/utils";
import type { IndividualResultView } from "@/types/marksheet";
import type { StudentPerformanceProfile } from "@/types/analytics";

/**
 * My Results & Marksheet. One server call (GET /analytics/performance/me)
 * gives every figure, computed with the marksheet's own rules (Σ obtained ÷
 * Σ full, absences not counted as zero, grades from Settings) — so this page,
 * the dashboard and the printed marksheet always agree.
 */
const STATUS_TONE: Record<string, string> = {
  উত্তীর্ণ: "border-success/25 bg-success/10 text-success",
  অনুত্তীর্ণ: "border-destructive/25 bg-destructive/10 text-destructive",
  অনুপস্থিত: "border-border bg-muted text-muted-foreground",
};

function toMarksheet(p: StudentPerformanceProfile): IndividualResultView {
  const dates = p.exams.map((e) => e.date).sort();
  return {
    student: { name: p.student.name, rollNumber: p.student.rollNumber ?? p.student.registrationId, course: p.student.course, batch: p.student.batch },
    dateRange: { start: dates[0] ?? "", end: dates[dates.length - 1] ?? "" },
    subjects: p.subjects.filter((s) => s.percentage !== null).map((s) => ({ subject: s.name, fullMarks: s.fullMarks, obtained: s.obtained, percentage: s.percentage!, grade: s.grade ?? "" })),
    overall: {
      fullMarks: p.overall.fullMarks,
      obtained: p.overall.obtained,
      percentage: p.overall.percentage ?? 0,
      grade: p.overall.grade ?? "",
      status: p.overall.result === "উত্তীর্ণ" ? "উত্তীর্ণ" : "অনুত্তীর্ণ",
    },
    details: p.exams.map((e) => ({ date: e.date, subject: e.subject, examTitle: e.title, batch: e.batch, fullMarks: e.fullMarks, obtained: e.marks, percentage: e.percentage, status: e.status })),
  };
}

export default function StudentResults() {
  const perf = useMyPerformance();
  const institution = usePublicInstitution();
  const [params, setParams] = useSearchParams();
  const tab = params.get("view") === "marksheet" ? "marksheet" : "results";
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const p = perf.data;

  const exams = useMemo(() => (p?.exams ?? []).filter((e) => (subject === "all" || e.subjectId === subject) && (!q.trim() || e.title.toLowerCase().includes(q.trim().toLowerCase()))), [p, subject, q]);

  return (
    <StudentPage
      icon={Award}
      title="ফলাফল ও মার্কশিট"
      description="আপনার সব পরীক্ষার নম্বর, বিষয়ভিত্তিক ফলাফল ও প্রিন্টযোগ্য মার্কশিট"
      actions={p && p.overall.examsSat > 0 ? <Button variant="outline" onClick={() => printIndividualMarksheet(toMarksheet(p), institution ?? undefined)}><Printer className="h-4 w-4" />মার্কশিট প্রিন্ট</Button> : undefined}
    >
      {perf.isLoading ? <Card className="p-4"><ListSkeleton rows={6} /></Card> : perf.isError || !p ? (
        <Card><ErrorState message="ফলাফল লোড করা যায়নি" onRetry={() => perf.refetch()} /></Card>
      ) : p.exams.length === 0 ? (
        <Card><EmptyState icon={FileText} title="এখনো কোনো পরীক্ষার ফলাফল নেই" description="পরীক্ষার নম্বর প্রকাশ হলে এখানে দেখা যাবে।" /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="সামগ্রিক নম্বর" value={pctText(p.overall.percentage)} sub={`${p.overall.obtained} / ${p.overall.fullMarks}`} tone="primary" />
            <MiniStat label="গ্রেড ও ফলাফল" value={p.overall.grade ?? "—"} sub={p.overall.result ?? "—"} tone={p.overall.result === "উত্তীর্ণ" ? "success" : p.overall.result ? "destructive" : undefined} />
            <MiniStat label="সর্বোচ্চ / সর্বনিম্ন" value={<span className="text-xl">{pctText(p.overall.highest, 0)} / {pctText(p.overall.lowest, 0)}</span>} sub={`${p.overall.examsSat}টি পরীক্ষা${p.overall.examsAbsent ? ` · ${p.overall.examsAbsent}টিতে অনুপস্থিত` : ""}`} />
            <MiniStat label="ট্রেন্ড" value={<TrendChip trend={p.trend.direction} change={p.trend.change} />} sub={p.trend.direction === "insufficient" ? "ট্রেন্ডের জন্য কমপক্ষে ৪টি পরীক্ষা দরকার" : `শেষ পরীক্ষাগুলোর গড় বনাম আগের গড়`} />
          </div>

          <Tabs value={tab} onValueChange={(v) => setParams(v === "marksheet" ? { view: "marksheet" } : {}, { replace: true })}>
            <TabsList>
              <TabsTrigger value="results">ফলাফল</TabsTrigger>
              <TabsTrigger value="marksheet">মার্কশিট</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="mt-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <Panel title="পরীক্ষাভিত্তিক ট্রেন্ড" icon={TrendingUp} description={`লাল দাগ = পাস নম্বর ${p.passingPercentage}%`}>
                  <ExamTrendChart passing={p.passingPercentage} points={[...p.exams].reverse().map((e) => ({ key: e.examId, date: e.date, label: e.title, percentage: e.percentage }))} />
                </Panel>
                <Panel title="বিষয়ভিত্তিক ফলাফল" icon={BookOpen}>
                  <ul className="space-y-3">
                    {p.subjects.map((s) => (
                      <li key={s.subjectId}>
                        <button type="button" onClick={() => setSubject(s.subjectId === subject ? "all" : s.subjectId)} className={cn("w-full rounded-md p-1 text-left hover:bg-muted/50", subject === s.subjectId && "bg-primary/5 ring-1 ring-primary/30")}>
                          <div className="flex items-baseline justify-between gap-2 text-sm"><span className="truncate font-medium">{s.name}</span><b className="tabular-nums">{pctText(s.percentage)}{s.grade ? <span className="ml-1 text-xs text-muted-foreground">{s.grade}</span> : null}</b></div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, s.percentage ?? 0)}%` }} /></div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{s.exams}টি পরীক্ষা{s.absent ? ` · ${s.absent}টিতে অনুপস্থিত` : ""}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>

              <Card className="overflow-hidden">
                <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:p-4">
                  <h2 className="font-semibold sm:mr-auto">পরীক্ষার ইতিহাস <span className="text-sm font-normal text-muted-foreground">({exams.length})</span></h2>
                  <div className="relative sm:w-60">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="পরীক্ষা খুঁজুন" className="h-9 pl-9" aria-label="পরীক্ষা খুঁজুন" />
                  </div>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger className="h-9 sm:w-48" aria-label="বিষয়"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">সব বিষয়</SelectItem>{p.subjects.map((s) => <SelectItem key={s.subjectId} value={s.subjectId}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {exams.length === 0 ? <EmptyState compact icon={Search} title="এই ফিল্টারে কোনো পরীক্ষা নেই" /> : (
                  <>
                    <div className="hidden overflow-x-auto md:block">
                      <Table>
                        <TableHeader><TableRow><TableHead>পরীক্ষা</TableHead><TableHead>বিষয়</TableHead><TableHead>তারিখ</TableHead><TableHead className="text-right">প্রাপ্ত / পূর্ণমান</TableHead><TableHead className="text-right">শতকরা</TableHead><TableHead>গ্রেড</TableHead><TableHead>ফলাফল</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {exams.map((e) => (
                            <TableRow key={e.examId}>
                              <TableCell className="font-medium">{e.title}</TableCell>
                              <TableCell>{e.subject}</TableCell>
                              <TableCell className="whitespace-nowrap tabular-nums">{e.date}</TableCell>
                              <TableCell className="text-right tabular-nums">{e.marks === null ? "—" : <><b>{e.marks}</b> / {e.fullMarks}</>}</TableCell>
                              <TableCell className="text-right tabular-nums">{pctText(e.percentage)}</TableCell>
                              <TableCell>{e.grade ?? "—"}</TableCell>
                              <TableCell><Badge variant="outline" className={STATUS_TONE[e.status]}>{e.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <ul className="divide-y md:hidden">
                      {exams.map((e) => (
                        <li key={e.examId} className="flex items-center gap-3 px-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{e.title}</p>
                            <p className="text-xs text-muted-foreground">{e.subject} · {e.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold tabular-nums">{e.marks === null ? "—" : `${e.marks}/${e.fullMarks}`}</p>
                            <Badge variant="outline" className={cn("mt-0.5 text-[11px]", STATUS_TONE[e.status])}>{e.marks === null ? e.status : `${pctText(e.percentage, 0)} · ${e.grade ?? ""}`}</Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="marksheet" className="mt-4">
              <Card className="p-4 sm:p-6">
                <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{institution?.name ?? ""}</p>
                    <h2 className="text-lg font-bold">মার্কশিট</h2>
                    <p className="text-sm">{p.student.name} · রোল {p.student.rollNumber ?? "—"} · রেজি. {p.student.registrationId}</p>
                    <p className="text-xs text-muted-foreground">{p.student.course ?? "—"} · {p.student.batch ?? "—"}</p>
                  </div>
                  <Button onClick={() => printIndividualMarksheet(toMarksheet(p), institution ?? undefined)} disabled={p.overall.examsSat === 0}><Printer className="h-4 w-4" />প্রিন্ট / PDF</Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>বিষয়</TableHead><TableHead className="text-right">পূর্ণমান</TableHead><TableHead className="text-right">প্রাপ্ত</TableHead><TableHead className="text-right">শতকরা</TableHead><TableHead>গ্রেড</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {p.subjects.filter((s) => s.percentage !== null).map((s) => (
                        <TableRow key={s.subjectId}><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-right tabular-nums">{s.fullMarks}</TableCell><TableCell className="text-right tabular-nums">{s.obtained}</TableCell><TableCell className="text-right tabular-nums">{pctText(s.percentage)}</TableCell><TableCell>{s.grade ?? "—"}</TableCell></TableRow>
                      ))}
                      <TableRow className="bg-muted/40 font-semibold"><TableCell>মোট</TableCell><TableCell className="text-right tabular-nums">{p.overall.fullMarks}</TableCell><TableCell className="text-right tabular-nums">{p.overall.obtained}</TableCell><TableCell className="text-right tabular-nums">{pctText(p.overall.percentage)}</TableCell><TableCell>{p.overall.grade ?? "—"} · {p.overall.result ?? "—"}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">মোট শতকরা = মোট প্রাপ্ত ÷ মোট পূর্ণমান। অনুপস্থিত পরীক্ষা নম্বরে যোগ হয় না। পাস নম্বর {p.passingPercentage}%।</p>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </StudentPage>
  );
}
