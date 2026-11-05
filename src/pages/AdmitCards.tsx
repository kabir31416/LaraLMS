import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, ChevronRight, ClipboardList, FileBadge, Plus, Search, Send, ShieldCheck, Ticket, Users } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, ListSkeleton, Panel } from "@/components/dashboard/DashboardKit";
import { SearchSelect } from "@/components/common/SearchSelect";
import { ExamFormDialog } from "@/components/cards/ExamFormDialog";
import { ExamStatusBadge, WorkflowSteps, admitBase, n } from "@/components/cards/CardKit";
import { api } from "@/lib/apiClient";
import { ApiClientError, hasPermission, useAuth } from "@/contexts/AuthContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ADMIT_CARDS_MANAGE } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { EXAM_STATUS_LABEL, EXAM_TYPES, EXAM_TYPE_LABEL, formatDateBn, formatTime12, type CardSettings, type CardInstitution, type ExamOverview, type ExamSchedule } from "@/types/cards";

const ALL = "__all";

/**
 * Exam & Admit Card Management — overview, searchable/filterable exam list
 * and "create exam". Batch Directors see (read-only) the exams their own
 * batches' students sit; the server applies that scope.
 */
export default function AdmitCards() {
  const { user } = useAuth();
  const canManage = hasPermission(user, ADMIT_CARDS_MANAGE);
  const base = admitBase(user?.role);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeCourses } = useAcademic();
  const { batches } = useBatches();

  const [search, setSearch] = useState("");
  const dSearch = useDebouncedValue(search, 350);
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [examType, setExamType] = useState("");
  const [status, setStatus] = useState("");
  const [when, setWhen] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [dSearch, courseId, batchId, examType, status, when, dateFrom, dateTo]);

  const qs = new URLSearchParams({ page: String(page), limit: "15" });
  if (dSearch.trim()) qs.set("search", dSearch.trim());
  if (courseId) qs.set("courseId", courseId);
  if (batchId) qs.set("batchId", batchId);
  if (examType) qs.set("examType", examType);
  if (status) qs.set("status", status);
  if (when) qs.set("when", when);
  if (dateFrom) qs.set("dateFrom", dateFrom);
  if (dateTo) qs.set("dateTo", dateTo);
  const list = useQuery({ queryKey: ["exam-schedules", "list", qs.toString()], queryFn: () => api.getWithMeta<ExamSchedule[]>(`/exam-schedules?${qs}`) });
  const ov = useQuery({ queryKey: ["exam-schedules", "overview"], queryFn: () => api.get<ExamOverview>("/exam-schedules/overview") });
  const conf = useQuery({ queryKey: ["id-cards", "settings"], queryFn: () => api.get<{ settings: CardSettings; institution: CardInstitution }>("/id-cards/settings"), staleTime: 60_000, enabled: canManage });
  const rows = list.data?.data ?? [];
  const meta = list.data?.meta as unknown as { total: number; totalPages: number } | undefined;
  const o = ov.data;
  const [createOpen, setCreateOpen] = useState(false);
  const filtersActive = [courseId, batchId, examType, status, when, dateFrom, dateTo, dSearch].some(Boolean);
  const reset = () => { setSearch(""); setCourseId(""); setBatchId(""); setExamType(""); setStatus(""); setWhen(""); setDateFrom(""); setDateTo(""); };

  const timeText = (e: { startTime: string | null; endTime?: string | null }) => [formatTime12(e.startTime), formatTime12(e.endTime ?? null)].filter(Boolean).join(" – ");

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"><Ticket className="h-7 w-7 text-primary" aria-hidden />পরীক্ষা ও অ্যাডমিট কার্ড</h1>
            <p className="text-sm text-muted-foreground">{canManage ? "পরীক্ষা তৈরি → শিক্ষার্থী নির্ধারণ → প্রকাশ → অ্যাডমিট কার্ড তৈরি ও প্রিন্ট" : "আপনার ব্যাচের শিক্ষার্থীদের পরীক্ষা ও অ্যাডমিট কার্ড"}</p>
          </div>
          {canManage && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden />নতুন পরীক্ষা</Button>}
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="মোট পরীক্ষা" value={n(o?.totalExams)} icon={ClipboardList} variant="primary" description={o ? `খসড়া ${n(o.drafts)} • বাতিল ${n(o.cancelled)}` : undefined} loading={ov.isLoading} onClick={() => { reset(); }} />
          <StatCard title="আসন্ন পরীক্ষা" value={n(o?.upcoming)} icon={CalendarClock} variant="info" description="আজ বা পরে" loading={ov.isLoading} onClick={() => { setWhen("upcoming"); setStatus(""); }} />
          <StatCard title="প্রকাশিত" value={n(o?.published)} icon={Send} variant="success" loading={ov.isLoading} onClick={() => { setStatus("published"); setWhen(""); }} />
          <StatCard title="নির্ধারিত শিক্ষার্থী" value={n(o?.totalAssigned)} icon={Users} variant="primary" description="বাতিল ছাড়া সব পরীক্ষায়" loading={ov.isLoading} />
          <StatCard title="তৈরি অ্যাডমিট কার্ড" value={n(o?.generatedAdmitCards)} icon={ShieldCheck} variant="success" description={o?.outdatedAdmitCards ? `${n(o.outdatedAdmitCards)}টি পুনরায় তৈরি প্রয়োজন` : undefined} loading={ov.isLoading} />
          <StatCard title="বাকি অ্যাডমিট কার্ড" value={n(o?.pendingAdmitCards)} icon={FileBadge} variant="warning" description="প্রকাশিত পরীক্ষায়" loading={ov.isLoading} />
        </div>

        {canManage && (
          <WorkflowSteps steps={[
            { label: "পরীক্ষা তৈরি", hint: "কোর্স, ব্যাচ, সময়, কক্ষ" },
            { label: "শিক্ষার্থী নির্ধারণ", hint: "ব্যাচ বা শিক্ষার্থী অনুযায়ী" },
            { label: "প্রকাশ", hint: "খসড়া থেকে প্রকাশিত" },
            { label: "অ্যাডমিট কার্ড", hint: "তৈরি, প্রিভিউ, প্রিন্ট / PDF" },
          ]} />
        )}

        {(o?.nextExams.length ?? 0) > 0 && (
          <Panel title="আসন্ন পরীক্ষা" icon={CalendarClock}>
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {o!.nextExams.map((e) => (
                <li key={e.id}>
                  <Link to={`${base}/${e.id}`} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]">
                    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary leading-none"><b className="text-base">{Number(e.date.slice(8, 10)).toLocaleString("bn-BD")}</b><span className="text-[10px]">{formatDateBn(e.date).split(" ")[1]}</span></span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{e.name}</span><span className="block truncate text-xs text-muted-foreground">{formatTime12(e.startTime) || "সময় নির্ধারিত হয়নি"} • {n(e.assigned)} জন • কার্ড {n(e.generated)}/{n(e.assigned)}</span></span>
                    <ExamStatusBadge status={e.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Card className="p-3 sm:p-4">
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="পরীক্ষার নাম, কোড বা কক্ষ দিয়ে খুঁজুন" className="pl-9" aria-label="পরীক্ষা খুঁজুন" />
            </div>
            <Select value={when || ALL} onValueChange={(v) => setWhen(v === ALL ? "" : v)}>
              <SelectTrigger className="lg:w-40" aria-label="সময়"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>সব সময়</SelectItem><SelectItem value="upcoming">আসন্ন</SelectItem><SelectItem value="past">অতীত</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-6">
            <SearchSelect label="কোর্স" value={courseId} onChange={(v) => { setCourseId(v); setBatchId(""); }} placeholder="সকল কোর্স" allLabel="সকল কোর্স" options={activeCourses.map((c) => ({ value: c.id, label: c.name }))} />
            <SearchSelect label="ব্যাচ" value={batchId} onChange={setBatchId} placeholder="সকল ব্যাচ" allLabel="সকল ব্যাচ" options={batches.filter((b) => !courseId || b.courseId === courseId).map((b) => ({ value: b.id, label: b.name }))} />
            <Select value={examType || ALL} onValueChange={(v) => setExamType(v === ALL ? "" : v)}>
              <SelectTrigger aria-label="পরীক্ষার ধরন"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>সকল ধরন</SelectItem>{EXAM_TYPES.map((t) => <SelectItem key={t} value={t}>{EXAM_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={status || ALL} onValueChange={(v) => setStatus(v === ALL ? "" : v)}>
              <SelectTrigger aria-label="স্ট্যাটাস"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>সকল স্ট্যাটাস</SelectItem>{(["draft", "published", "completed", "cancelled"] as const).map((s) => <SelectItem key={s} value={s}>{EXAM_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} aria-label="তারিখ থেকে" />
            <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} aria-label="তারিখ পর্যন্ত" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-sm">
            <span><b className="tabular-nums">{n(meta?.total ?? (list.isLoading ? undefined : 0))}</b>টি পরীক্ষা</span>
            {filtersActive && <button type="button" onClick={reset} className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">সব ফিল্টার মুছুন</button>}
          </div>

          <div className="mt-3">
            {list.isError ? <ErrorState message={list.error instanceof ApiClientError ? list.error.message : "তালিকা লোড করা যায়নি"} onRetry={() => list.refetch()} /> : list.isLoading ? <ListSkeleton rows={6} /> : rows.length === 0 ? (
              <EmptyState icon={ClipboardList} title={filtersActive ? "ফিল্টারে কোনো পরীক্ষা মেলেনি" : "এখনো কোনো পরীক্ষা নেই"} description={canManage && !filtersActive ? "“নতুন পরীক্ষা” দিয়ে প্রথম পরীক্ষা তৈরি করুন" : undefined}
                action={canManage && !filtersActive ? <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden />নতুন পরীক্ষা</Button> : undefined} />
            ) : (
              <>
                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>পরীক্ষা</TableHead>
                        <TableHead>তারিখ ও সময়</TableHead>
                        <TableHead>কোর্স / ব্যাচ</TableHead>
                        <TableHead className="text-center">শিক্ষার্থী</TableHead>
                        <TableHead>অ্যাডমিট কার্ড</TableHead>
                        <TableHead>স্ট্যাটাস</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((e) => (
                        <TableRow key={e.id} className={cn("cursor-pointer", e.status === "draft" && "bg-muted/30", e.status === "cancelled" && "opacity-70")} onClick={() => navigate(`${base}/${e.id}`)}>
                          <TableCell><p className="font-medium">{e.name}</p><p className="text-xs text-muted-foreground">{e.code} • {EXAM_TYPE_LABEL[e.examType]}{e.venue ? ` • ${e.venue}` : ""}</p></TableCell>
                          <TableCell><p>{formatDateBn(e.date)}</p><p className="text-xs text-muted-foreground">{timeText(e) || "—"}</p></TableCell>
                          <TableCell><p>{e.course?.name ?? "—"}</p><p className="text-xs text-muted-foreground">{e.batch?.name ?? "সকল ব্যাচ"}{e.allowCrossBatch ? " +অন্য ব্যাচ" : ""}</p></TableCell>
                          <TableCell className="text-center tabular-nums">{n(e.counts?.assigned)}</TableCell>
                          <TableCell>
                            <span className="tabular-nums">{n(e.counts?.generated)}/{n(e.counts?.assigned)}</span>
                            {(e.counts?.outdated ?? 0) > 0 && <span className="ml-2 inline-flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3 w-3" aria-hidden />{n(e.counts!.outdated)} পরিবর্তিত</span>}
                          </TableCell>
                          <TableCell><ExamStatusBadge status={e.status} /></TableCell>
                          <TableCell className="text-right"><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="space-y-2 lg:hidden">
                  {rows.map((e) => (
                    <li key={e.id}>
                      <Link to={`${base}/${e.id}`} className={cn("block rounded-lg border p-3 transition-colors hover:border-primary/40", e.status === "draft" && "border-dashed bg-muted/30", e.status === "cancelled" && "opacity-70")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><p className="truncate font-medium">{e.name}</p><p className="truncate text-xs text-muted-foreground">{e.code} • {EXAM_TYPE_LABEL[e.examType]}</p></div>
                          <ExamStatusBadge status={e.status} />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>📅 {formatDateBn(e.date)}</span><span className="truncate">⏰ {timeText(e) || "—"}</span>
                          <span className="truncate">{e.course?.name ?? "—"} • {e.batch?.name ?? "সকল ব্যাচ"}</span>
                          <span>👥 {n(e.counts?.assigned)} • কার্ড {n(e.counts?.generated)}/{n(e.counts?.assigned)}</span>
                        </div>
                      </Link>
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
      </div>

      {canManage && (
        <ExamFormDialog open={createOpen} onOpenChange={setCreateOpen} defaultInstructions={conf.data?.settings.admitDefaultInstructions ?? ""}
          onSaved={(e) => { void qc.invalidateQueries({ queryKey: ["exam-schedules"] }); navigate(`${base}/${e.id}`); }} />
      )}
    </DashboardLayout>
  );
}
