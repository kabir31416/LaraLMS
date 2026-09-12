import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, GraduationCap } from "lucide-react";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * No-login public search (Phase 1 §16/§19). Not wrapped in ProtectedRoute —
 * this is the one page in the app meant to be reachable without an account.
 * Which fields come back per result depends entirely on the admin's
 * PublicInfoSettings.visibleFields config, so this renders whatever the
 * server includes rather than assuming a fixed shape.
 */
type PublicSearchMethod = "registrationId" | "phone" | "name";

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

const METHOD_LABELS: Record<PublicSearchMethod, string> = {
  registrationId: "রেজিস্ট্রেশন আইডি",
  phone: "মোবাইল নম্বর",
  name: "নাম",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
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

export default function PublicInfo() {
  const [method, setMethod] = useState<PublicSearchMethod>("registrationId");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicStudentResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) {
      toast.error("অন্তত ২ অক্ষর দিয়ে অনুসন্ধান করুন");
      return;
    }
    setSearching(true);
    try {
      const data = await api.get<PublicStudentResult[]>(`/public/students?method=${method}&q=${encodeURIComponent(q.trim())}`);
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
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <GraduationCap className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">শিক্ষার্থী তথ্য অনুসন্ধান</h1>
          <p className="text-sm text-muted-foreground">রেজিস্ট্রেশন আইডি, মোবাইল নম্বর বা নাম দিয়ে খুঁজুন — লগইন প্রয়োজন নেই</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleSearch}>
              <Select value={method} onValueChange={(v) => setMethod(v as PublicSearchMethod)}>
                <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(METHOD_LABELS) as PublicSearchMethod[]).map((m) => (
                    <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="এখানে লিখুন..." className="flex-1" />
              <Button type="submit" disabled={searching}>
                <Search className="h-4 w-4 mr-1" /> {searching ? "খোঁজা হচ্ছে..." : "খুঁজুন"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searched && !searching && results && results.length === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">কোনো তথ্য পাওয়া যায়নি</CardContent></Card>
        )}

        {results?.map((r, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-3">
              {r.photo && <img src={r.photo} alt={r.name || ""} className="w-12 h-12 rounded-full object-cover" />}
              {r.name && <CardTitle className="text-base">{r.name}</CardTitle>}
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              {r.registrationId && <Field label="রেজিস্ট্রেশন আইডি" value={r.registrationId} />}
              {r.rollNumber && <Field label="রোল নম্বর" value={r.rollNumber} />}
              {r.course && <Field label="কোর্স" value={r.course} />}
              {r.currentBatch && <Field label="বর্তমান ব্যাচ" value={r.currentBatch} />}
              {r.batchDirector && <Field label="ব্যাচ ডিরেক্টর" value={r.batchDirector} />}
              {r.admissionStatus && <Field label="ভর্তির অবস্থা" value={r.admissionStatus} />}
              {r.attendanceSummary && (
                <Field label="উপস্থিতির হার" value={r.attendanceSummary.percent != null ? `${r.attendanceSummary.percent}%` : "তথ্য নেই"} />
              )}
              {r.resultSummary && (
                <Field
                  label="ফলাফল সারাংশ"
                  value={r.resultSummary.averagePercent != null ? `গড় ${r.resultSummary.averagePercent}% (${r.resultSummary.examsTaken}টি পরীক্ষা)` : "তথ্য নেই"}
                />
              )}
            </CardContent>
          </Card>
        ))}

        <div className="text-center">
          <Link to="/login" className="text-sm text-primary hover:underline">লগইন পেইজে ফিরে যান</Link>
        </div>
      </div>
    </main>
  );
}
