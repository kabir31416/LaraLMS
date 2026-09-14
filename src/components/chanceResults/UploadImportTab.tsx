import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UploadCloud, FileText, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { RESULT_ROUNDS } from "@/types/chanceResult";
import type { ResultRound, UploadPreviewResult, PreviewRow, PreviewStatus } from "@/types/chanceResult";
import { toast } from "sonner";

function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

const STATUS_META: Record<PreviewStatus, { label: string; className: string }> = {
  MATCHED: { label: "মিলেছে", className: "bg-success/10 text-success border-success/20" },
  NOT_FOUND: { label: "খুঁজে পাওয়া যায়নি", className: "bg-warning/10 text-warning border-warning/20" },
  ALREADY_IMPORTED: { label: "আগেই যোগ হয়েছে", className: "bg-muted text-muted-foreground" },
  PARSING_ERROR: { label: "সমস্যা", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

interface Props {
  onImported: () => void;
}

export function UploadImportTab({ onImported }: Props) {
  const { sessions, courses } = useAcademic();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sessionId, setSessionId] = useState("");
  const [programId, setProgramId] = useState("none");
  const [resultRound, setResultRound] = useState<ResultRound>("1st Merit");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<UploadPreviewResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const programsForSession = useMemo(() => courses.filter((c) => c.sessionId === sessionId), [courses, sessionId]);

  const resetForm = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!sessionId) { toast.error("সেশন নির্বাচন করুন।"); return; }
    if (!file) { toast.error("পিডিএফ ফাইল নির্বাচন করুন।"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("sessionId", sessionId);
      formData.append("resultRound", resultRound);
      if (programId !== "none") formData.append("programId", programId);
      const result = await api.postForm<UploadPreviewResult>("/admission-results/imports", formData);
      setPreview(result);
      toast.success("পিডিএফ পার্স করা হয়েছে — নিচে প্রিভিউ যাচাই করে নিশ্চিত করুন।");
    } catch (err) {
      toast.error(friendlyError(err, "আপলোড ব্যর্থ হয়েছে।"));
    } finally {
      setUploading(false);
    }
  };

  const doConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const res = await api.post<{ imported: number; skipped: number }>(`/admission-results/imports/${preview.import.id}/confirm`);
      toast.success(`${res.imported.toLocaleString("bn-BD")} জন চান্স স্টুডেন্ট হিসেবে যোগ হয়েছে।`);
      setPreview(null);
      resetForm();
      onImported();
    } catch (err) {
      toast.error(friendlyError(err, "নিশ্চিত করা যায়নি।"));
    } finally {
      setConfirming(false);
      setConfirmOpen(false);
    }
  };

  const doCancel = async () => {
    if (!preview) return;
    setCancelling(true);
    try {
      await api.post(`/admission-results/imports/${preview.import.id}/cancel`);
      toast.success("ইমপোর্ট বাতিল করা হয়েছে।");
      setPreview(null);
      resetForm();
    } catch (err) {
      toast.error(friendlyError(err, "বাতিল করা যায়নি।"));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">অফিসিয়াল ভর্তি ফলাফল পিডিএফ আপলোড করুন</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>সেশন *</Label>
              <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setProgramId("none"); }} disabled={!!preview}>
                <SelectTrigger><SelectValue placeholder="সেশন নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>প্রোগ্রাম (ঐচ্ছিক)</Label>
              <Select value={programId} onValueChange={setProgramId} disabled={!!preview}>
                <SelectTrigger><SelectValue placeholder="প্রোগ্রাম নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">নির্দিষ্ট করবেন না</SelectItem>
                  {programsForSession.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">পিডিএফে প্রোগ্রামের নাম উল্লেখ থাকলে তা স্বয়ংক্রিয়ভাবে সনাক্ত হবে — এটি শুধু ফলব্যাক হিসেবে ব্যবহৃত হয়।</p>
            </div>
            <div className="space-y-1.5">
              <Label>ফলাফলের রাউন্ড *</Label>
              <Select value={resultRound} onValueChange={(v) => setResultRound(v as ResultRound)} disabled={!!preview}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESULT_ROUNDS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>পিডিএফ ফাইল *</Label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={!!preview}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:text-sm file:font-medium hover:file:bg-primary/20"
              />
            </div>
          </div>

          {!preview && (
            <Button onClick={handleUpload} disabled={uploading || !sessionId || !file}>
              <UploadCloud className="h-4 w-4 mr-2" />
              {uploading ? "আপলোড হচ্ছে..." : "আপলোড ও প্রিভিউ দেখুন"}
            </Button>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> {preview.import.fileName}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                পার্স পদ্ধতি: {preview.import.parseMethod === "ocr" ? "OCR (ছবি থেকে টেক্সট)" : "সরাসরি টেক্সট"} • মোট রোল: {preview.import.totalPdfRolls.toLocaleString("bn-BD")}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Badge className="bg-success/10 text-success border-success/20">মিলেছে: {preview.import.matchedCount}</Badge>
              <Badge className="bg-warning/10 text-warning border-warning/20">অমিলিত: {preview.import.unmatchedCount}</Badge>
              <Badge className="bg-muted text-muted-foreground">আগেই আছে: {preview.import.duplicateCount}</Badge>
              {preview.import.errorCount > 0 && <Badge className="bg-destructive/10 text-destructive border-destructive/20">সমস্যা: {preview.import.errorCount}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[420px] overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>স্ট্যাটাস</TableHead>
                    <TableHead>ভর্তি রোল</TableHead>
                    <TableHead>ইনস্টিটিউট</TableHead>
                    <TableHead>প্রোগ্রাম</TableHead>
                    <TableHead>নির্বাচন</TableHead>
                    <TableHead>শিক্ষার্থী</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row: PreviewRow, idx: number) => {
                    const meta = STATUS_META[row.status];
                    return (
                      <TableRow key={`${row.admissionRoll}-${idx}`}>
                        <TableCell><Badge variant="outline" className={meta.className}>{meta.label}</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{row.admissionRoll}</TableCell>
                        <TableCell className="text-sm">{row.instituteName}</TableCell>
                        <TableCell className="text-sm">{row.programName || "—"}</TableCell>
                        <TableCell className="text-sm">{row.selectionType === "Merit" ? "মেধা" : "উপজাতি"}</TableCell>
                        <TableCell className="text-sm">
                          {row.studentName ? `${row.studentName} (${row.studentRoll || "—"})` : (row.reason || "—")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={doCancel} disabled={cancelling || confirming}>
                <XCircle className="h-4 w-4 mr-2" /> বাতিল করুন
              </Button>
              <Button onClick={() => setConfirmOpen(true)} disabled={confirming || cancelling || preview.import.matchedCount === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> নিশ্চিত করে চান্স স্টুডেন্ট তৈরি করুন
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ইমপোর্ট নিশ্চিত করুন</AlertDialogTitle>
            <AlertDialogDescription>
              {preview?.import.matchedCount.toLocaleString("bn-BD")} জন শিক্ষার্থীকে স্থায়ীভাবে চান্স স্টুডেন্ট হিসেবে যোগ করা হবে। এই কাজটি প্রয়োজনে পরে রোলব্যাক করা যাবে (ইমপোর্ট হিস্ট্রি থেকে)।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={doConfirm} disabled={confirming}>
              {confirming ? "প্রসেস হচ্ছে..." : "নিশ্চিত করুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
