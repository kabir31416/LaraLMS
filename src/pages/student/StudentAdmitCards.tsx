import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, ChevronRight, FileBadge, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/dashboard/DashboardKit";
import { StudentPage } from "@/components/student/StudentPortalKit";
import { AdmitCard, FitCard } from "@/components/cards/CardDesigns";
import { ExamStatusBadge, PrintMenu, type PrintChoice } from "@/components/cards/CardKit";
import { api } from "@/lib/apiClient";
import { admitQrMap, printAdmitCards, startPrintWindow } from "@/lib/cardPrint";
import { ApiClientError } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { EXAM_TYPE_LABEL, formatDateBn, formatTime12, type AdmitPayload, type MyExam } from "@/types/cards";

const CHOICES: PrintChoice[] = [{ key: "print", label: "প্রিন্ট (A4)" }, { key: "pdf", label: "PDF ডাউনলোড", pdf: true }];

/**
 * Student Portal — only the student's own assigned exams. Drafts never
 * appear; a cancelled exam is listed as cancelled with no admit card; an
 * admit card opens only once the office has generated it.
 */
export default function StudentAdmitCards() {
  return (
    <StudentPage icon={FileBadge} title="অ্যাডমিট কার্ড" description="আপনার নির্ধারিত পরীক্ষা ও প্রবেশপত্র — দেখুন, প্রিন্ট বা PDF করুন">
      <Body />
    </StudentPage>
  );
}

function Body() {
  const list = useQuery({ queryKey: ["exam-schedules", "me"], queryFn: () => api.get<MyExam[]>("/exam-schedules/me") });
  const [openId, setOpenId] = useState<string | null>(null);
  const items = useMemo(() => list.data ?? [], [list.data]);
  useEffect(() => { if (!openId) { const first = items.find((i) => i.canView); if (first) setOpenId(first.exam.id); } }, [items, openId]);
  const card = useQuery({ queryKey: ["exam-schedules", "me", openId], queryFn: () => api.get<AdmitPayload>(`/exam-schedules/me/${openId}/admit-card`), enabled: !!openId });
  const [qrs, setQrs] = useState<Map<string, string>>(new Map());
  useEffect(() => { if (card.data) void admitQrMap(card.data).then(setQrs); }, [card.data]);
  const [busy, setBusy] = useState(false);

  if (list.isLoading) return <Card className="p-6"><ListSkeleton rows={4} /></Card>;
  if (list.isError) return <Card><ErrorState message={list.error instanceof ApiClientError ? list.error.message : "লোড করা যায়নি"} onRetry={() => list.refetch()} /></Card>;
  if (!items.length) return <Card><EmptyState icon={FileBadge} title="এখনো কোনো পরীক্ষা নির্ধারিত হয়নি" description="প্রতিষ্ঠান আপনাকে কোনো পরীক্ষায় নির্ধারণ করে প্রকাশ করলে এখানে দেখা যাবে।" /></Card>;

  const print = async (c: PrintChoice) => {
    if (!card.data) return;
    const h = startPrintWindow("অ্যাডমিট কার্ড");
    if (!h.win) { toast.error("পপ-আপ ব্লক হয়েছে — ব্রাউজারে পপ-আপ অনুমতি দিন"); return; }
    setBusy(true);
    try { await printAdmitCards(h, card.data, { perPage: 1, pdf: !!c.pdf }); } catch { h.close(); toast.error("প্রিন্ট প্রস্তুত করা যায়নি"); } finally { setBusy(false); }
  };
  const current = card.data?.cards[0];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <Card className="p-2 sm:p-3">
        <ul className="space-y-1.5">
          {items.map(({ exam, admit, canView }) => (
            <li key={exam.id}>
              <button type="button" disabled={!canView} onClick={() => setOpenId(exam.id)} className={cn("flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors", canView ? "hover:border-primary/40" : "cursor-default opacity-75", openId === exam.id && "border-primary bg-primary/[0.04]")}>
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 leading-none text-primary"><b>{Number(exam.date.slice(8, 10)).toLocaleString("bn-BD")}</b><span className="text-[10px]">{formatDateBn(exam.date).split(" ")[1]}</span></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{exam.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{EXAM_TYPE_LABEL[exam.examType]}{exam.startTime ? ` • ${formatTime12(exam.startTime)}` : ""}{exam.venue ? ` • ${exam.venue}` : ""}</span>
                  <span className="mt-1 block text-xs">{exam.status === "cancelled" ? <span className="text-destructive">বাতিল{exam.cancelReason ? ` — ${exam.cancelReason}` : ""}</span> : admit ? <span className="text-success">অ্যাডমিট কার্ড: {admit.cardNo}</span> : <span className="text-muted-foreground">অ্যাডমিট কার্ড এখনো প্রস্তুত হয়নি</span>}</span>
                </span>
                {exam.status !== "published" ? <ExamStatusBadge status={exam.status} /> : canView ? <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden /> : null}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <div>
        {!openId ? <Card><EmptyState compact icon={FileBadge} title="কোনো অ্যাডমিট কার্ড প্রস্তুত নেই" description="প্রতিষ্ঠান অ্যাডমিট কার্ড তৈরি করলে এখানে দেখা যাবে" /></Card>
          : card.isLoading ? <Card className="p-6"><ListSkeleton rows={6} /></Card>
          : card.isError || !card.data || !current ? <Card><ErrorState message={card.error instanceof ApiClientError ? card.error.message : "অ্যাডমিট কার্ড লোড করা যায়নি"} onRetry={() => card.refetch()} /></Card> : (
            <div className="space-y-3">
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold">{card.data.exam.name}</p>
                  <p className="flex flex-wrap gap-x-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" aria-hidden />{formatDateBn(card.data.exam.date, true)}</span>{card.data.exam.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{card.data.exam.venue}</span>}</p>
                </div>
                <PrintMenu choices={CHOICES} onChoose={print} busy={busy} />
              </Card>
              <Card className="bg-muted/40 p-2 sm:p-4"><FitCard widthMm={186} maxScale={1}><AdmitCard exam={card.data.exam} student={current.student} institution={card.data.institution} settings={card.data.settings} admit={current.admit} qrSvg={qrs.get(current.assignmentId)} /></FitCard></Card>
            </div>
          )}
      </div>
    </div>
  );
}
