import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, Ban, Clock3, Loader2, QrCode, XCircle } from "lucide-react";
import { PublicCard, PublicShell } from "@/components/public/PublicShell";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { EXAM_TYPE_LABEL, formatDateBn, formatTime12, type ExamType } from "@/types/cards";

type Verify = {
  kind: "id-card" | "admit-card";
  status: "valid" | "replaced" | "inactive" | "expired" | "not_found" | "cancelled" | "removed" | "not_published" | "completed";
  institution: { name: string; logoUrl?: string };
  student?: { name: string; studentId: string; course?: string | null; batch?: string | null; photo?: string | null } | null;
  issuedAt?: string;
  version?: number;
  validUntil?: string | null;
  cardNo?: string;
  exam?: { name: string; examType: ExamType; date: string; startTime: string | null; endTime: string | null; venue: string | null };
};

const STATUS: Record<Verify["status"], { title: string; tone: "ok" | "warn" | "bad"; text: string }> = {
  valid: { title: "বৈধ কার্ড", tone: "ok", text: "এই কার্ডটি প্রতিষ্ঠান থেকে ইস্যুকৃত ও বর্তমানে বৈধ। নিচের তথ্য ও ছবি কার্ডধারীর সাথে মিলিয়ে নিন।" },
  completed: { title: "বৈধ (পরীক্ষা সম্পন্ন)", tone: "ok", text: "অ্যাডমিট কার্ডটি আসল; পরীক্ষাটি সম্পন্ন হয়েছে।" },
  replaced: { title: "পুরনো কার্ড", tone: "warn", text: "এই কার্ডের পরে নতুন কার্ড ইস্যু হয়েছে — এটি আর বৈধ নয়।" },
  expired: { title: "মেয়াদোত্তীর্ণ", tone: "warn", text: "কার্ডটির মেয়াদ শেষ হয়েছে।" },
  inactive: { title: "নিষ্ক্রিয় শিক্ষার্থী", tone: "warn", text: "কার্ডধারী বর্তমানে সক্রিয় শিক্ষার্থী নন।" },
  cancelled: { title: "পরীক্ষা বাতিল", tone: "bad", text: "এই পরীক্ষাটি বাতিল করা হয়েছে — অ্যাডমিট কার্ডটি বৈধ নয়।" },
  removed: { title: "বৈধ নয়", tone: "bad", text: "শিক্ষার্থীকে এই পরীক্ষা থেকে সরানো হয়েছে।" },
  not_published: { title: "বৈধ নয়", tone: "bad", text: "পরীক্ষাটি এখন প্রকাশিত অবস্থায় নেই।" },
  not_found: { title: "কার্ড পাওয়া যায়নি", tone: "bad", text: "এই কোডের কোনো কার্ড নেই — কার্ডটি জাল হতে পারে।" },
};

/** Public QR landing page — shows only what is needed to match the card with its holder. */
export default function VerifyCard() {
  const { kind = "", code = "" } = useParams();
  const path = kind === "admit" ? "admit-card" : kind === "id" ? "id-card" : "";
  const q = useQuery({ queryKey: ["verify", path, code], queryFn: () => api.get<Verify>(`/public/verify/${path}/${encodeURIComponent(code)}`), enabled: !!path, retry: false });
  const v = q.data;
  const s = v ? STATUS[v.status] : null;
  const Icon = !s ? QrCode : s.tone === "ok" ? BadgeCheck : s.tone === "warn" ? (v?.status === "expired" ? Clock3 : AlertTriangle) : v?.status === "cancelled" ? Ban : XCircle;
  return (
    <PublicShell title="কার্ড যাচাই" description={kind === "admit" ? "অ্যাডমিট কার্ডের QR যাচাই" : "শিক্ষার্থী আইডি কার্ডের QR যাচাই"} icon={QrCode} width="sm">
      <PublicCard>
        {!path ? <p className="text-center text-sm text-muted-foreground">অবৈধ যাচাই লিংক।</p>
          : q.isLoading ? <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />যাচাই করা হচ্ছে...</div>
          : q.isError || !v || !s ? <p className="py-6 text-center text-sm text-destructive">{q.error instanceof ApiClientError ? q.error.message : "যাচাই করা যায়নি — একটু পরে আবার চেষ্টা করুন"}</p> : (
            <div className="space-y-5">
              <div className={cn("flex flex-col items-center gap-2 rounded-xl p-5 text-center", s.tone === "ok" ? "bg-success/10 text-success" : s.tone === "warn" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive")}>
                <Icon className="h-12 w-12" aria-hidden />
                <p className="text-xl font-bold">{s.title}</p>
                <p className="text-sm text-foreground/80">{s.text}</p>
              </div>
              {v.student && (
                <div className="flex items-center gap-4">
                  <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-primary/30 bg-primary/5 text-2xl font-bold text-primary">{v.student.photo ? <img src={v.student.photo} alt="" className="h-full w-full object-cover" /> : v.student.name.charAt(0)}</div>
                  <dl className="min-w-0 space-y-1 text-sm">
                    <div><dt className="text-xs text-muted-foreground">নাম</dt><dd className="font-semibold">{v.student.name}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">স্টুডেন্ট আইডি</dt><dd className="font-medium tabular-nums">{v.student.studentId}</dd></div>
                    {(v.student.course || v.student.batch) && <div><dt className="text-xs text-muted-foreground">কোর্স / ব্যাচ</dt><dd>{[v.student.course, v.student.batch].filter(Boolean).join(" • ")}</dd></div>}
                  </dl>
                </div>
              )}
              {v.exam && (
                <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
                  <div className="col-span-2"><dt className="text-xs text-muted-foreground">পরীক্ষা</dt><dd className="font-semibold">{v.exam.name} <span className="text-xs font-normal text-muted-foreground">({EXAM_TYPE_LABEL[v.exam.examType]})</span></dd></div>
                  <div><dt className="text-xs text-muted-foreground">তারিখ</dt><dd>{formatDateBn(v.exam.date, true)}</dd></div>
                  {v.exam.startTime && <div><dt className="text-xs text-muted-foreground">সময়</dt><dd>{[formatTime12(v.exam.startTime), formatTime12(v.exam.endTime)].filter(Boolean).join(" – ")}</dd></div>}
                  {v.exam.venue && <div><dt className="text-xs text-muted-foreground">কেন্দ্র / কক্ষ</dt><dd>{v.exam.venue}</dd></div>}
                  {v.cardNo && <div><dt className="text-xs text-muted-foreground">অ্যাডমিট কার্ড নম্বর</dt><dd className="tabular-nums">{v.cardNo}</dd></div>}
                </dl>
              )}
              {v.issuedAt && <p className="text-center text-xs text-muted-foreground">ইস্যু: {formatDateBn(v.issuedAt.slice(0, 10))}{v.version ? ` • সংস্করণ ${v.version.toLocaleString("bn-BD")}` : ""}{v.validUntil ? ` • মেয়াদ ${formatDateBn(v.validUntil)} পর্যন্ত` : ""}</p>}
              <p className="text-center text-xs text-muted-foreground">যাচাইকারী: {v.institution.name}</p>
            </div>
          )}
      </PublicCard>
    </PublicShell>
  );
}
