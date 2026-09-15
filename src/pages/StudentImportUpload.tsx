import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Download, Eye, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useAuth, ApiClientError } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";
import type { StudentImportListMeta, StudentImportSession } from "@/types/studentImport";

/**
 * Bulk Student Upload — entry page ("এক্সেল থেকে ভর্তি"), reached from the
 * Admission page (lives under Admission, not Student, since this is an
 * admission workflow — the resulting rows only ever become Students via
 * the same approval path a normal admission goes through). Mirrors the
 * existing Admission Result (Chance Result) PDF-import UI's upload+history
 * tab pattern (ChanceResults.tsx / UploadImportTab.tsx /
 * ImportHistoryTab.tsx), but for Excel. Uploading here only parses/
 * validates and creates a preview session — no Student is created until an
 * admin approves a row on the preview page (/admission/import/:sessionId).
 * The backend API path (/students/import/...) is unchanged — only the
 * frontend route/UI location moved.
 */
function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

const STATUS_META: Record<StudentImportSession["status"], { label: string; className: string }> = {
  processing: { label: "প্রসেসিং", className: "bg-muted text-muted-foreground" },
  ready: { label: "প্রস্তুত", className: "bg-info/10 text-info border-info/20" },
  completed: { label: "সম্পন্ন", className: "bg-success/10 text-success border-success/20" },
  failed: { label: "ব্যর্থ", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function StudentImportUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const [history, setHistory] = useState<StudentImportSession[]>([]);
  const [meta, setMeta] = useState<StudentImportListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await api.getWithMeta<StudentImportSession[]>(`/students/import/history?page=${page}&limit=20`);
      setHistory(res.data);
      setMeta((res.meta as unknown as StudentImportListMeta) ?? null);
    } catch (err) {
      toast.error(friendlyError(err, "ইমপোর্ট হিস্ট্রি লোড করা যায়নি।"));
    } finally {
      setLoadingHistory(false);
    }
  }, [page]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  if (!user || user.role !== "Admin") {
    return <Navigate to="/login" replace />;
  }

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await api.downloadFile("/students/import/template", "student-import-template.xlsx");
    } catch (err) {
      toast.error(friendlyError(err, "টেমপ্লেট ডাউনলোড করা যায়নি।"));
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!file) { toast.error("এক্সেল ফাইল নির্বাচন করুন।"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const session = await api.postForm<StudentImportSession>("/students/import/upload", formData);
      toast.success("ফাইল পার্স করা হয়েছে — প্রিভিউ যাচাই করে অনুমোদন দিন।");
      navigate(`/admission/import/${session._id}`);
    } catch (err) {
      toast.error(friendlyError(err, "আপলোড ব্যর্থ হয়েছে।"));
    } finally {
      setUploading(false);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admission")} title="ভর্তি পাতায় ফিরে যান">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">এক্সেল থেকে ভর্তি</h1>
            <p className="text-sm text-muted-foreground">এক্সেল ফাইল আপলোড করুন, প্রতিটি সারি যাচাই করুন এবং একে একে অনুমোদন দিয়ে শিক্ষার্থী ভর্তি করুন।</p>
          </div>
        </div>

        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList className="bg-card border">
            <TabsTrigger value="upload">আপলোড</TabsTrigger>
            <TabsTrigger value="history">ইমপোর্ট হিস্ট্রি</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">এক্সেল ফাইল আপলোড করুন</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-dashed p-4 bg-muted/30 space-y-2">
                  <p className="text-sm font-medium">শুরু করার আগে টেমপ্লেট ডাউনলোড করুন</p>
                  <p className="text-xs text-muted-foreground">টেমপ্লেটের কলাম হেডার অপরিবর্তিত রাখুন — কলামের ক্রম পরিবর্তন করা গেলেও নাম পরিবর্তন করা যাবে না। কোর্স ফি ও ভর্তি ফি এক্সেল থেকে নেওয়া হয় না, সবসময় Settings থেকে আসে।</p>
                  <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={downloadingTemplate}>
                    <Download className="h-4 w-4 mr-2" /> {downloadingTemplate ? "ডাউনলোড হচ্ছে..." : "টেমপ্লেট ডাউনলোড করুন"}
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium">এক্সেল ফাইল (.xlsx / .xls) *</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    disabled={uploading}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:text-sm file:font-medium hover:file:bg-primary/20"
                  />
                </div>

                <Button onClick={handleUpload} disabled={uploading || !file}>
                  <UploadCloud className="h-4 w-4 mr-2" />
                  {uploading ? "আপলোড হচ্ছে..." : "আপলোড ও প্রিভিউ দেখুন"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-none shadow-sm">
              {loadingHistory ? (
                <CardContent className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent>
              ) : history.length === 0 ? (
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  এখনো কোনো এক্সেল ইমপোর্ট করা হয়নি।
                </CardContent>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ফাইল</TableHead>
                      <TableHead>আপলোডকারী</TableHead>
                      <TableHead>আপলোডের সময়</TableHead>
                      <TableHead className="text-center">মোট</TableHead>
                      <TableHead className="text-center">অনুমোদিত</TableHead>
                      <TableHead className="text-center">অপেক্ষমাণ</TableHead>
                      <TableHead className="text-center">বাতিল</TableHead>
                      <TableHead className="text-center">ব্যর্থ</TableHead>
                      <TableHead>স্ট্যাটাস</TableHead>
                      <TableHead className="text-right">অ্যাকশন</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((s) => {
                      const badge = STATUS_META[s.status];
                      const uploader = typeof s.uploadedBy === "string" ? s.uploadedBy : s.uploadedBy?.identifier;
                      return (
                        <TableRow key={s._id}>
                          <TableCell className="max-w-[220px] truncate" title={s.originalFileName}>{s.originalFileName}</TableCell>
                          <TableCell className="text-sm">{uploader || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(s.uploadedAt).toLocaleString("bn-BD")}</TableCell>
                          <TableCell className="text-center text-sm">{s.totalRows}</TableCell>
                          <TableCell className="text-center text-sm">{s.approvedRows}</TableCell>
                          <TableCell className="text-center text-sm">{s.pendingRows}</TableCell>
                          <TableCell className="text-center text-sm">{s.rejectedRows}</TableCell>
                          <TableCell className="text-center text-sm">{s.failedRows}</TableCell>
                          <TableCell><Badge variant="outline" className={badge.className}>{badge.label}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/admission/import/${s._id}`)}>
                              <Eye className="h-3.5 w-3.5 mr-1" /> দেখুন
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 p-4 border-t">
                  <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage(meta.page - 1)}>পূর্ববর্তী</Button>
                  <span className="text-sm text-muted-foreground">পৃষ্ঠা {meta.page} / {meta.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage(meta.page + 1)}>পরবর্তী</Button>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
