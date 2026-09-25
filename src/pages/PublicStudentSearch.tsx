import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, GraduationCap, BookOpen, Layers, UserCog, CalendarCheck, Trophy, SearchX } from "lucide-react";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import type { PublicInstitutionInfo } from "@/types/academic";
import { toast } from "sonner";

/**
 * Student Search Mobile-only audit §1 — this page used to be PublicInfo.tsx
 * itself (method selector: রেজিস্ট্রেশন আইডি/মোবাইল নম্বর/নাম). PublicInfo.tsx
 * is now a 3-card navigation hub (/info) and this page is just its "মোবাইল
 * নম্বর দিয়ে অনুসন্ধান" card's destination — same GET /public/students API,
 * same PublicInfoSettings-driven field visibility, method is simply always
 * "phone" now (no selector, no registrationId/name search from this page).
 * The backend still supports all three methods (admin-configurable via
 * Settings) — this is a frontend-only restriction, not a removed capability.
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

/** Square (never circular) per the public-page convention — a student's own portal/profile avatars stay circular, this page shows the same photo as its original 1:1 square. */
function SquarePhoto({ src, name }: { src?: string | null; name?: string }) {
  return (
    <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl overflow-hidden border bg-muted flex items-center justify-center">
      {src ? (
        <img src={src} alt={name || ""} className="h-full w-full object-cover" />
      ) : name ? (
        <span className="text-2xl font-bold text-primary">{name.charAt(0)}</span>
      ) : (
        <GraduationCap className="h-8 w-8 text-muted-foreground" />
      )}
    </div>
  );
}

function InfoChip({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-muted/50 px-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, variant }: { icon: typeof CalendarCheck; label: string; value: string; variant: "success" | "info" }) {
  const styles = variant === "success" ? "bg-success/10 text-success" : "bg-info/10 text-info";
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${styles}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-[11px] opacity-80 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function friendlyError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.message.includes("disabled")) return "এই মুহূর্তে পাবলিক তথ্য অনুসন্ধান বন্ধ আছে";
    if (err.message.includes("not enabled")) return "এই পদ্ধতিতে অনুসন্ধান সক্রিয় নেই";
    return err.message;
  }
  return "অনুসন্ধান ব্যর্থ হয়েছে";
}

export default function PublicStudentSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicStudentResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [institution, setInstitution] = useState<PublicInstitutionInfo | null>(null);

  useEffect(() => {
    api.get<PublicInstitutionInfo>("/public/institution").then(setInstitution).catch(() => {});
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) {
      toast.error("অন্তত ২ অক্ষর দিয়ে অনুসন্ধান করুন");
      return;
    }
    setSearching(true);
    try {
      const data = await api.get<PublicStudentResult[]>(`/public/students?method=phone&q=${encodeURIComponent(q.trim())}`);
      setResults(data);
      setSearched(true);
    } catch (err) {
      setResults(null);
      setSearched(true);
      toast.error(friendlyError(err));
    } finally {
      setSearching(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-2xl mx-auto space-y-4 py-10">
        <div className="text-center space-y-2 relative">
          <Link to="/info" className="absolute left-0 top-1 text-muted-foreground hover:text-foreground" title="মূল পাতায় ফিরে যান">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {institution?.logoUrl ? (
            <img src={institution.logoUrl} alt={institution.name} className="mx-auto w-14 h-14 rounded-2xl object-cover shadow-sm" />
          ) : (
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-sm">
              <GraduationCap className="w-8 h-8 text-primary-foreground" />
            </div>
          )}
          {institution?.name && <p className="text-sm font-semibold text-primary">{institution.name}</p>}
          <h1 className="text-2xl font-bold">শিক্ষার্থী তথ্য অনুসন্ধান</h1>
          <p className="text-sm text-muted-foreground">মোবাইল নম্বর দিয়ে খুঁজুন — লগইন প্রয়োজন নেই</p>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleSearch}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="মোবাইল নম্বর লিখুন"
                  inputMode="numeric"
                  autoComplete="off"
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={searching}>
                {searching ? "খোঁজা হচ্ছে..." : "খুঁজুন"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searched && !searching && results && results.length === 0 && (
          <Card className="border-none shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <SearchX className="h-8 w-8 mx-auto opacity-50" />
              <p>কোনো তথ্য পাওয়া যায়নি</p>
            </CardContent>
          </Card>
        )}

        {results?.map((r, i) => {
          // Roll and Registration ID are both independently optional here
          // (admin-configurable PublicInfoSettings.visibleFields) — shown
          // together as one compact identity line under the name instead of
          // two separate grid cells, so the card reads well whichever subset
          // the admin has enabled.
          const identityParts = [
            r.rollNumber ? `রেজিস্ট্রেশন: ${r.rollNumber}` : null,
            r.registrationId ? `আইডি: ${r.registrationId}` : null,
          ].filter((p): p is string => !!p);

          const hasStats = r.attendanceSummary || r.resultSummary;

          return (
            <Card key={i} className="border-none shadow-sm overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <SquarePhoto src={r.photo} name={r.name} />
                  <div className="min-w-0 flex-1">
                    {r.name && <p className="text-base font-bold truncate">{r.name}</p>}
                    {identityParts.length > 0 && (
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{identityParts.join(" • ")}</p>
                    )}
                    {r.admissionStatus && (
                      <Badge variant="outline" className="mt-1.5 text-xs bg-success/10 text-success border-success/20">{r.admissionStatus}</Badge>
                    )}
                  </div>
                </div>

                {(r.course || r.currentBatch || r.batchDirector) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {r.course && <InfoChip icon={BookOpen} label="কোর্স" value={r.course} />}
                    {r.currentBatch && <InfoChip icon={Layers} label="বর্তমান ব্যাচ" value={r.currentBatch} />}
                    {r.batchDirector && <InfoChip icon={UserCog} label="ব্যাচ ডিরেক্টর" value={r.batchDirector} />}
                  </div>
                )}

                {hasStats && (
                  <div className="grid grid-cols-2 gap-2">
                    {r.attendanceSummary && (
                      <StatTile
                        icon={CalendarCheck}
                        variant="success"
                        label="উপস্থিতির হার"
                        value={r.attendanceSummary.percent != null ? `${r.attendanceSummary.percent}%` : "তথ্য নেই"}
                      />
                    )}
                    {r.resultSummary && (
                      <StatTile
                        icon={Trophy}
                        variant="info"
                        label={r.resultSummary.averagePercent != null ? `${r.resultSummary.examsTaken}টি পরীক্ষার গড়` : "ফলাফল"}
                        value={r.resultSummary.averagePercent != null ? `${r.resultSummary.averagePercent}%` : "তথ্য নেই"}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <div className="text-center">
          <Link to="/login" className="text-sm text-primary hover:underline">লগইন পেইজে ফিরে যান</Link>
        </div>
      </div>
    </main>
  );
}
