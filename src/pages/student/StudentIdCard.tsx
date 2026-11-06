import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IdCard, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/dashboard/DashboardKit";
import { StudentPage } from "@/components/student/StudentPortalKit";
import { FitCard, IdCardBack, IdCardFront } from "@/components/cards/CardDesigns";
import { PrintMenu, type PrintChoice } from "@/components/cards/CardKit";
import { api } from "@/lib/apiClient";
import { idQrMap, printIdCards, startPrintWindow } from "@/lib/cardPrint";
import { ApiClientError } from "@/contexts/AuthContext";
import { formatDateBn, type IdCardPayload } from "@/types/cards";

type MyCard = ({ issued: true } & IdCardPayload) | { issued: false; institution: { name: string } };

const CHOICES: PrintChoice[] = [
  { key: "a4-both", label: "A4 — সামনে ও পিছনে", hint: "কাটার দাগসহ" },
  { key: "card", label: "কার্ড সাইজ (CR80)" },
  { key: "pdf", label: "PDF ডাউনলোড", pdf: true },
];

/** Student Portal — the student's own ID card only (the server resolves "own" from the login token). */
export default function StudentIdCard() {
  return (
    <StudentPage icon={IdCard} title="আমার আইডি কার্ড" description="প্রতিষ্ঠান থেকে ইস্যুকৃত শিক্ষার্থী পরিচয়পত্র — দেখুন, প্রিন্ট বা PDF করুন">
      <Body />
    </StudentPage>
  );
}

function Body() {
  const q = useQuery({ queryKey: ["id-cards", "me"], queryFn: () => api.get<MyCard>("/id-cards/me") });
  const [qrs, setQrs] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const data = q.data;
  useEffect(() => { if (data?.issued) void idQrMap(data).then(setQrs); }, [data]);

  if (q.isLoading) return <Card className="p-6"><ListSkeleton rows={4} /></Card>;
  if (q.isError) return <Card><ErrorState message={q.error instanceof ApiClientError ? q.error.message : "আইডি কার্ড লোড করা যায়নি"} onRetry={() => q.refetch()} /></Card>;
  if (!data || !data.issued) return <Card><EmptyState icon={IdCard} title="আপনার আইডি কার্ড এখনো ইস্যু হয়নি" description="অফিস থেকে কার্ড ইস্যু করা হলে এখানে দেখা যাবে। প্রয়োজনে অফিসে যোগাযোগ করুন।" /></Card>;

  const item = data.cards[0];
  const { settings, institution } = data;
  const widthMm = settings.idCardLayout === "portrait" ? 53.98 : 85.6;
  const print = async (c: PrintChoice) => {
    const h = startPrintWindow("আমার আইডি কার্ড");
    if (!h.win) { toast.error("পপ-আপ ব্লক হয়েছে — ব্রাউজারে পপ-আপ অনুমতি দিন"); return; }
    setBusy(true);
    try { await printIdCards(h, data, { sides: "both", paper: c.key === "card" ? "card" : "a4", pdf: !!c.pdf }); }
    catch { h.close(); toast.error("প্রিন্ট প্রস্তুত করা যায়নি"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="font-medium">ইস্যু: {formatDateBn(item.card!.generatedAt.slice(0, 10))} • সংস্করণ {item.card!.version.toLocaleString("bn-BD")}</p>
          <p className="text-muted-foreground">স্টুডেন্ট আইডি {item.student.studentId}{item.validUntil ? ` • মেয়াদ ${formatDateBn(item.validUntil)} পর্যন্ত` : ""}</p>
        </div>
        <PrintMenu choices={CHOICES} onChoose={print} busy={busy} />
      </Card>
      {item.card!.outdated && <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />আপনার কিছু তথ্য কার্ড ইস্যুর পরে পরিবর্তিত হয়েছে। হালনাগাদ কার্ডের জন্য অফিসে যোগাযোগ করুন।</p>}
      <div className={settings.idCardShowBack ? "grid gap-4 lg:grid-cols-2" : "max-w-xl"}>
        <Card className="bg-muted/40 p-3 sm:p-5"><p className="mb-2 text-xs font-medium text-muted-foreground">সামনের দিক</p><FitCard widthMm={widthMm} maxScale={settings.idCardLayout === "portrait" ? 1.3 : 1.6}><IdCardFront student={item.student} institution={institution} settings={settings} validUntil={item.validUntil} qrSvg={qrs.get(item.student.id)} /></FitCard></Card>
        {settings.idCardShowBack && <Card className="bg-muted/40 p-3 sm:p-5"><p className="mb-2 text-xs font-medium text-muted-foreground">পিছনের দিক</p><FitCard widthMm={widthMm} maxScale={settings.idCardLayout === "portrait" ? 1.3 : 1.6}><IdCardBack student={item.student} institution={institution} settings={settings} qrSvg={qrs.get(item.student.id)} /></FitCard></Card>}
      </div>
    </div>
  );
}
