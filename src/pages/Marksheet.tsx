import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, Users, UserRound, Printer, FileDown, ArrowLeft } from "lucide-react";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import {
  printIndividualMarksheet,
  downloadIndividualMarksheetPdf,
  printBatchMasterSheet,
  downloadBatchMasterSheetPdf,
} from "@/lib/marksheetExport";
import type { BatchMasterSheetView, IndividualResultView, MasterSheetCell, PublicBatchOption } from "@/types/marksheet";
import type { PublicInstitutionInfo } from "@/types/academic";
import { toast } from "sonner";

/**
 * Public Marksheet (Phase 6) — no login, no ProtectedRoute, same as
 * PublicInfo.tsx. Both flows are fully implemented: "ব্যক্তিগত ফলাফল"
 * (Individual Result, Part 1) and "ব্যাচ ভিত্তিক ফলাফল" (Batch Master
 * Sheet, Part 2).
 */
type ScreenType = "select" | "individual" | "batch";

function friendlyError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  return "ফলাফল আনা যায়নি — একটু পরে আবার চেষ্টা করুন।";
}

export default function Marksheet() {
  const [screen, setScreen] = useState<ScreenType>("select");
  const [institution, setInstitution] = useState<PublicInstitutionInfo | null>(null);

  useEffect(() => {
    api.get<PublicInstitutionInfo>("/public/institution").then(setInstitution).catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-3xl mx-auto space-y-4 py-8 sm:py-10">
        <div className="text-center space-y-2">
          {institution?.logoUrl ? (
            <img src={institution.logoUrl} alt={institution.name} className="mx-auto w-12 h-12 rounded-xl object-cover" />
          ) : (
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-primary-foreground" />
            </div>
          )}
          {institution?.name && <p className="text-sm font-semibold text-primary">{institution.name}</p>}
          <h1 className="text-2xl font-bold">ফলাফল</h1>
          {screen === "select" && <p className="text-sm text-muted-foreground">লগইন প্রয়োজন নেই — নিচে থেকে ধরন নির্বাচন করুন</p>}
        </div>

        {screen === "select" && <SelectScreen onSelect={setScreen} />}
        {screen === "individual" && <IndividualScreen onBack={() => setScreen("select")} institution={institution} />}
        {screen === "batch" && <BatchScreen onBack={() => setScreen("select")} institution={institution} />}

        <div className="text-center">
          <Link to="/login" className="text-sm text-primary hover:underline">লগইন পেইজে ফিরে যান</Link>
        </div>
      </div>
    </main>
  );
}

function SelectScreen({ onSelect }: { onSelect: (s: ScreenType) => void }) {
  return (
    <Card>
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-base font-semibold">ফলাফলের ধরন নির্বাচন করুন</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <button
          type="button"
          onClick={() => onSelect("batch")}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors p-6 text-center"
        >
          <Users className="h-8 w-8 text-primary" />
          <span className="font-semibold">ব্যাচ ভিত্তিক ফলাফল</span>
          <span className="text-xs text-muted-foreground">পুরো ব্যাচের ফলাফল একসাথে দেখুন</span>
        </button>
        <button
          type="button"
          onClick={() => onSelect("individual")}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors p-6 text-center"
        >
          <UserRound className="h-8 w-8 text-primary" />
          <span className="font-semibold">ব্যক্তিগত ফলাফল</span>
          <span className="text-xs text-muted-foreground">রোল নম্বর দিয়ে নিজের ফলাফল দেখুন</span>
        </button>
      </CardContent>
    </Card>
  );
}

function BatchScreen({ onBack, institution }: { onBack: () => void; institution: PublicInstitutionInfo | null }) {
  const [batches, setBatches] = useState<PublicBatchOption[] | null>(null);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchName, setBatchName] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchMasterSheetView | null>(null);

  useEffect(() => {
    api
      .get<PublicBatchOption[]>("/public/results/batches")
      .then(setBatches)
      .catch(() => setBatches([]))
      .finally(() => setLoadingBatches(false));
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searching) return; // duplicate-submit prevention
    if (!batchName) { toast.error("সঠিক ব্যাচ নির্বাচন করুন।"); return; }
    if (startDate && endDate && startDate > endDate) { toast.error("শুরু তারিখ শেষ তারিখের পরে হতে পারবে না।"); return; }

    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ batchName });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const data = await api.get<BatchMasterSheetView>(`/public/results/batch-master-sheet?${params.toString()}`);
      setResult(data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <form className="space-y-4" onSubmit={handleSearch}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>ব্যাচ নির্বাচন করুন</Label>
                <Select value={batchName} onValueChange={setBatchName} disabled={loadingBatches}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingBatches ? "লোড হচ্ছে..." : "ব্যাচ নির্বাচন করুন"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(batches ?? []).map((b) => (
                      <SelectItem key={b.name} value={b.name}>
                        {b.name}{b.courseName ? ` (${b.courseName})` : ""}
                      </SelectItem>
                    ))}
                    {batches?.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">কোনো ব্যাচ পাওয়া যায়নি</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>শুরু তারিখ (ঐচ্ছিক)</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>শেষ তারিখ (ঐচ্ছিক)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={searching}>{searching ? "খোঁজা হচ্ছে..." : "ফলাফল দেখুন"}</Button>
              <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> পিছনে যান</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {searched && !searching && error && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">{error}</CardContent></Card>
      )}

      {result && <BatchMasterSheetDisplay data={result} institution={institution} />}
    </div>
  );
}

function rankBadgeClass(rank: number): string {
  if (rank === 1) return "bg-amber-100 text-amber-800 border-amber-200";
  if (rank === 2) return "bg-slate-200 text-slate-700 border-slate-300";
  return "bg-orange-100 text-orange-800 border-orange-200";
}

const RANK_LABEL: Record<number, string> = { 1: "১ম", 2: "২য়", 3: "৩য়" };

function MasterSheetCellValue({ cell }: { cell: MasterSheetCell }) {
  if (cell.status === "na") return <span className="text-muted-foreground">—</span>;
  if (cell.status === "absent") return <span className="text-destructive text-xs">অনুপস্থিত</span>;
  return <>{cell.value}</>;
}

function BatchMasterSheetDisplay({ data, institution }: { data: BatchMasterSheetView; institution: PublicInstitutionInfo | null }) {
  const { batch, dateRange, columns, rows } = data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">{batch.name}{batch.courseName ? ` — ${batch.courseName}` : ""}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              সময়সীমা: {dateRange.start ?? "শুরু থেকে"} থেকে {dateRange.end ?? "বর্তমান পর্যন্ত"} • মোট শিক্ষার্থী: {rows.length}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => printBatchMasterSheet(data, institution ?? undefined)}>
              <Printer className="h-4 w-4 mr-1" /> প্রিন্ট
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadBatchMasterSheetPdf(data, institution ?? undefined)}>
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-lg">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 bg-muted/70 min-w-[80px]">রোল</TableHead>
                  <TableHead className="sticky left-[80px] z-20 bg-muted/70 min-w-[140px]">নাম</TableHead>
                  {columns.map((c, i) => (
                    <TableHead key={i} className="text-center whitespace-nowrap min-w-[90px]">
                      <div className="font-medium">{c.subject}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{c.date} • পূর্ণ {c.fullMarks}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-right whitespace-nowrap">মোট প্রাপ্ত</TableHead>
                  <TableHead className="text-right whitespace-nowrap">মোট পূর্ণমান</TableHead>
                  <TableHead className="text-right whitespace-nowrap">শতাংশ</TableHead>
                  <TableHead className="text-right whitespace-nowrap">গ্রেড</TableHead>
                  <TableHead className="text-center whitespace-nowrap">অবস্থান</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.rollNumber + r.name}>
                    <TableCell className="sticky left-0 z-10 bg-background font-medium">{r.rollNumber}</TableCell>
                    <TableCell className="sticky left-[80px] z-10 bg-background whitespace-nowrap">{r.name}</TableCell>
                    {r.cells.map((c, i) => (
                      <TableCell key={i} className="text-center">
                        <MasterSheetCellValue cell={c} />
                      </TableCell>
                    ))}
                    <TableCell className="text-right">{r.totalObtained}</TableCell>
                    <TableCell className="text-right">{r.totalFullMarks}</TableCell>
                    <TableCell className="text-right font-medium">{r.percentage}%</TableCell>
                    <TableCell className="text-right">{r.grade}</TableCell>
                    <TableCell className="text-center">
                      {r.rank ? <Badge className={rankBadgeClass(r.rank)}>{RANK_LABEL[r.rank]}</Badge> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IndividualScreen({ onBack, institution }: { onBack: () => void; institution: PublicInstitutionInfo | null }) {
  const [roll, setRoll] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<IndividualResultView | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searching) return; // duplicate-submit prevention
    if (!roll.trim()) { toast.error("সঠিক রোল নম্বর প্রদান করুন।"); return; }
    if (!startDate || !endDate) { toast.error("সঠিক তারিখ নির্বাচন করুন।"); return; }
    if (startDate > endDate) { toast.error("শুরু তারিখ শেষ তারিখের পরে হতে পারবে না।"); return; }

    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.get<IndividualResultView>(
        `/public/results/individual?roll=${encodeURIComponent(roll.trim())}&startDate=${startDate}&endDate=${endDate}`,
      );
      setResult(data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <form className="space-y-4" onSubmit={handleSearch}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>রোল নম্বর</Label>
                <Input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="যেমন: ১০১" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>শুরু তারিখ</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>শেষ তারিখ</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={searching}>{searching ? "খোঁজা হচ্ছে..." : "ফলাফল দেখুন"}</Button>
              <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> পিছনে যান</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {searched && !searching && error && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">{error}</CardContent></Card>
      )}

      {result && <IndividualResultDisplay data={result} institution={institution} />}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "উত্তীর্ণ" ? "bg-success/10 text-success border-success/20" :
    status === "অনুপস্থিত" ? "bg-muted text-muted-foreground" :
    "bg-destructive/10 text-destructive border-destructive/20";
  return <Badge className={cls}>{status}</Badge>;
}

function IndividualResultDisplay({ data, institution }: { data: IndividualResultView; institution: PublicInstitutionInfo | null }) {
  const { student, dateRange, subjects, overall, details } = data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">শিক্ষার্থীর তথ্য</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => printIndividualMarksheet(data, institution ?? undefined)}>
              <Printer className="h-4 w-4 mr-1" /> প্রিন্ট
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadIndividualMarksheetPdf(data, institution ?? undefined)}>
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground">নাম</p><p className="font-medium">{student.name}</p></div>
          <div><p className="text-xs text-muted-foreground">রোল নম্বর</p><p className="font-medium">{student.rollNumber}</p></div>
          <div><p className="text-xs text-muted-foreground">কোর্স</p><p className="font-medium">{student.course || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">ব্যাচ</p><p className="font-medium">{student.batch || "—"}</p></div>
          <div className="col-span-2 sm:col-span-4">
            <p className="text-xs text-muted-foreground">সময়সীমা</p>
            <p className="font-medium">{dateRange.start} থেকে {dateRange.end}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">বিষয়ভিত্তিক সারসংক্ষেপ</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>বিষয়</TableHead>
                  <TableHead className="text-right">পূর্ণমান</TableHead>
                  <TableHead className="text-right">প্রাপ্ত নম্বর</TableHead>
                  <TableHead className="text-right">শতাংশ</TableHead>
                  <TableHead className="text-right">গ্রেড</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((s) => (
                  <TableRow key={s.subject}>
                    <TableCell className="font-medium">{s.subject}</TableCell>
                    <TableCell className="text-right">{s.fullMarks}</TableCell>
                    <TableCell className="text-right">{s.obtained}</TableCell>
                    <TableCell className="text-right">{s.percentage}%</TableCell>
                    <TableCell className="text-right">{s.grade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">সামগ্রিক ফলাফল</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xl font-bold">{overall.fullMarks}</p>
            <p className="text-xs text-muted-foreground">মোট পূর্ণমান</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xl font-bold">{overall.obtained}</p>
            <p className="text-xs text-muted-foreground">মোট প্রাপ্ত নম্বর</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3">
            <p className="text-xl font-bold text-primary">{overall.percentage}%</p>
            <p className="text-xs text-muted-foreground">মোট শতাংশ</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xl font-bold">{overall.grade}</p>
            <p className="text-xs text-muted-foreground">গ্রেড ({overall.status})</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">বিস্তারিত ফলাফল</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>তারিখ</TableHead>
                  <TableHead>বিষয়</TableHead>
                  <TableHead>পরীক্ষা</TableHead>
                  <TableHead className="text-right">পূর্ণমান</TableHead>
                  <TableHead className="text-right">প্রাপ্ত নম্বর</TableHead>
                  <TableHead className="text-right">শতাংশ</TableHead>
                  <TableHead>অবস্থা</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.date}</TableCell>
                    <TableCell>{d.subject}</TableCell>
                    <TableCell>{d.examTitle}</TableCell>
                    <TableCell className="text-right">{d.fullMarks}</TableCell>
                    <TableCell className="text-right">{d.obtained ?? "—"}</TableCell>
                    <TableCell className="text-right">{d.percentage != null ? `${d.percentage}%` : "—"}</TableCell>
                    <TableCell><StatusBadge status={d.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
