import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Pencil, Save, X, Printer, FileSpreadsheet, ArrowLeft, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useAttendance } from "@/contexts/AttendanceContext";
import { api } from "@/lib/apiClient";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { printReport, exportExcel } from "@/lib/exporters";
import { toast } from "@/hooks/use-toast";

/**
 * Result Management — an internal Admin/Batch Director viewing + editing
 * screen over the exact same OfflineExam/OfflineResult data Result Entry
 * writes and the public /marksheet reads (backend/.../resultManagement.
 * service.ts). Not a competing result system: editing a mark here updates
 * the same record Result Entry itself would, so every other view (Result
 * Entry, /marksheet, reports) picks up the change immediately.
 */

interface StudentResultSummaryRow {
  studentId: string;
  registrationId: string;
  name: string;
  rollNumber?: string;
  phone: string;
  course?: string;
  batchName?: string;
  totalObtained: number;
  totalFullMarks: number;
  percentage: number | null;
  grade: string;
  result: "পাস" | "ফেল" | null;
}

interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ResultRowView {
  resultId: string;
  examId: string;
  subjectName: string;
  lectureTitle: string;
  examTitle: string;
  batchName: string;
  date: string;
  fullMarks: number;
  obtainedMarks: number | null;
  percentage: number | null;
  grade: string;
  result: "পাস" | "ফেল" | "অনুপস্থিত";
  isPublished: boolean;
}

interface StudentResultDetail {
  student: {
    id: string;
    name: string;
    registrationId: string;
    rollNumber?: string;
    course?: string;
    batchName?: string;
    phone: string;
  };
  rows: ResultRowView[];
}

interface BatchResultColumn {
  examId: string;
  subjectName: string;
  lectureTitle: string;
  examTitle: string;
  date: string;
  fullMarks: number;
}

interface BatchResultCell {
  resultId: string | null;
  value: number | null;
  status: "present" | "absent" | "na";
}

interface BatchResultRow {
  studentId: string;
  rollNumber: string;
  registrationId: string;
  name: string;
  cells: BatchResultCell[];
  totalObtained: number;
  totalFullMarks: number;
  percentage: number;
  grade: string;
}

interface BatchResultView {
  batch: { id: string; name: string; courseName: string | null };
  columns: BatchResultColumn[];
  rows: BatchResultRow[];
}

function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

const ResultManagement = () => {
  const { user } = useAuth();
  const isDirector = user?.role === "Batch Director";

  if (!user || (user.role !== "Admin" && user.role !== "Batch Director")) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">ফলাফল ব্যবস্থাপনা</h1>
          <p className="text-sm text-muted-foreground">শিক্ষার্থী বা ব্যাচভিত্তিক ফলাফল দেখুন এবং প্রয়োজনে নম্বর সম্পাদনা করুন</p>
        </div>

        <Tabs defaultValue="individual">
          <TabsList>
            <TabsTrigger value="individual">শিক্ষার্থী ফলাফল</TabsTrigger>
            <TabsTrigger value="batch">ব্যাচভিত্তিক ফলাফল</TabsTrigger>
          </TabsList>
          <TabsContent value="individual" className="mt-4">
            <IndividualResultTab isDirector={isDirector} />
          </TabsContent>
          <TabsContent value="batch" className="mt-4">
            <BatchResultTab isDirector={isDirector} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

/* -------------------------------------------------------------------- */
/* Individual Result                                                     */
/* -------------------------------------------------------------------- */

const PAGE_SIZE = 50;

function IndividualResultTab({ isDirector }: { isDirector: boolean }) {
  const { user } = useAuth();
  const { batches } = useBatches();

  // Director: batch filter options are only their own batches (backend
  // still independently enforces this via readScope regardless of what the
  // dropdown offers). Admin: every batch, plus "সকল ব্যাচ" (all).
  const myBatches = useMemo(
    () => (isDirector && user ? batches.filter((b) => b.directorId === user.staffId) : batches),
    [batches, isDirector, user],
  );

  const [batchId, setBatchId] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<StudentResultSummaryRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const [topStudents, setTopStudents] = useState<StudentResultSummaryRow[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);

  const buildFilterQs = useCallback(() => {
    const qs = new URLSearchParams();
    if (batchId !== "all") qs.set("batchId", batchId);
    if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
    return qs;
  }, [batchId, debouncedSearch]);

  const loadList = useCallback(() => {
    setLoadingList(true);
    const qs = buildFilterQs();
    qs.set("page", String(page));
    qs.set("limit", String(PAGE_SIZE));
    api
      .getWithMeta<StudentResultSummaryRow[]>(`/result-management/students?${qs.toString()}`)
      .then((res) => { setItems(res.data); setMeta((res.meta as unknown as ListMeta) ?? null); })
      .catch((err) => toast({ title: "লোড ব্যর্থ", description: friendlyError(err, "শিক্ষার্থী তালিকা লোড করা যায়নি।") }))
      .finally(() => setLoadingList(false));
  }, [buildFilterQs, page]);

  useEffect(() => { loadList(); }, [loadList]);
  // Any filter change other than page itself restarts at page 1.
  useEffect(() => { setPage(1); }, [batchId, debouncedSearch]);

  useEffect(() => {
    setLoadingTop(true);
    const qs = new URLSearchParams({ limit: "10" });
    if (batchId !== "all") qs.set("batchId", batchId);
    api
      .get<StudentResultSummaryRow[]>(`/result-management/top-students?${qs.toString()}`)
      .then(setTopStudents)
      .catch(() => setTopStudents([]))
      .finally(() => setLoadingTop(false));
  }, [batchId]);

  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [detail, setDetail] = useState<StudentResultDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadDetail = useCallback((studentId: string) => {
    setLoadingDetail(true);
    api
      .get<StudentResultDetail>(`/result-management/students/${studentId}`)
      .then(setDetail)
      .catch((err) => {
        toast({ title: "লোড ব্যর্থ", description: friendlyError(err, "ফলাফল লোড করা যায়নি।") });
        setDetail(null);
      })
      .finally(() => setLoadingDetail(false));
  }, []);

  useEffect(() => {
    if (selectedStudent) loadDetail(selectedStudent.id);
    else setDetail(null);
  }, [selectedStudent, loadDetail]);

  const handleMarkUpdated = (row: ResultRowView) => {
    setDetail((prev) => (prev ? { ...prev, rows: prev.rows.map((r) => (r.resultId === row.resultId ? row : r)) } : prev));
  };

  const handlePrint = () => {
    if (!detail) return;
    printReport(
      `ফলাফল — ${detail.student.name}`,
      ["বিষয়", "পরীক্ষা", "তারিখ", "পূর্ণমান", "প্রাপ্ত নম্বর", "শতকরা", "গ্রেড", "ফলাফল"],
      detail.rows.map((r) => [r.subjectName, r.examTitle, r.date, r.fullMarks, r.obtainedMarks ?? "অনুপস্থিত", r.percentage ?? "-", r.grade || "-", r.result]),
    );
  };

  const handleExport = () => {
    if (!detail) return;
    exportExcel({
      filename: `result-${detail.student.registrationId}`,
      title: `ফলাফল — ${detail.student.name}`,
      headers: ["বিষয়", "পরীক্ষা", "তারিখ", "পূর্ণমান", "প্রাপ্ত নম্বর", "শতকরা", "গ্রেড", "ফলাফল"],
      rows: detail.rows.map((r) => [r.subjectName, r.examTitle, r.date, r.fullMarks, r.obtainedMarks ?? "অনুপস্থিত", r.percentage ?? "-", r.grade || "-", r.result]),
    });
  };

  // Drill-down into one student's full result history.
  if (selectedStudent) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setSelectedStudent(null)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />তালিকায় ফিরুন
        </Button>

        {loadingDetail && (
          <Card className="border-none shadow-sm"><CardContent className="py-8"><Skeleton className="h-32 w-full" /></CardContent></Card>
        )}

        {!loadingDetail && detail && (
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap print:hidden">
              <div>
                <CardTitle className="text-base">{detail.student.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  আইডি: {detail.student.registrationId} • রোল: {detail.student.rollNumber || "—"} • কোর্স: {detail.student.course || "—"} • ব্যাচ: {detail.student.batchName || "—"} • মোবাইল: {detail.student.phone}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}><FileSpreadsheet className="h-4 w-4 mr-1.5" />এক্সপোর্ট</Button>
                <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1.5" />প্রিন্ট</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>বিষয়</TableHead>
                      <TableHead>পরীক্ষা</TableHead>
                      <TableHead>তারিখ</TableHead>
                      <TableHead className="text-right">পূর্ণমান</TableHead>
                      <TableHead className="w-[140px]">প্রাপ্ত নম্বর</TableHead>
                      <TableHead className="text-right">শতকরা</TableHead>
                      <TableHead>গ্রেড</TableHead>
                      <TableHead>ফলাফল</TableHead>
                      <TableHead className="print:hidden">প্রকাশিত</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">কোনো ফলাফল পাওয়া যায়নি</TableCell></TableRow>
                    ) : detail.rows.map((row) => (
                      <ResultRowEditable key={row.resultId} row={row} onUpdated={handleMarkUpdated} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const resultBadge = (result: "পাস" | "ফেল" | null) => (
    <Badge
      className={
        result === "পাস" ? "bg-success/10 text-success border-success/20"
          : result === "ফেল" ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-muted text-muted-foreground"
      }
    >
      {result ?? "কোনো ফলাফল নেই"}
    </Badge>
  );

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">ফিল্টার</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>ব্যাচ</Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সকল ব্যাচ</SelectItem>
                {myBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>খুঁজুন (আইডি, রোল, নাম বা মোবাইল)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="খুঁজুন..." className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {!loadingTop && topStudents.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" />সেরা ১০ শিক্ষার্থী
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">SL</TableHead>
                    <TableHead>রোল</TableHead>
                    <TableHead>Registration ID</TableHead>
                    <TableHead>নাম</TableHead>
                    <TableHead>মোবাইল</TableHead>
                    <TableHead>ব্যাচ</TableHead>
                    <TableHead className="text-right">শতকরা</TableHead>
                    <TableHead>গ্রেড</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topStudents.map((s, i) => (
                    <TableRow key={s.studentId} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedStudent({ id: s.studentId, name: s.name })}>
                      <TableCell className="text-xs font-medium">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{s.rollNumber || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{s.registrationId}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm">{s.phone}</TableCell>
                      <TableCell className="text-sm">{s.batchName || "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{s.percentage}</TableCell>
                      <TableCell>{s.grade}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">সকল শিক্ষার্থীর ফলাফল ({meta?.total.toLocaleString("bn-BD") ?? "…"})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">SL</TableHead>
                  <TableHead>রোল</TableHead>
                  <TableHead>Registration ID</TableHead>
                  <TableHead>নাম</TableHead>
                  <TableHead>মোবাইল</TableHead>
                  <TableHead>কোর্স</TableHead>
                  <TableHead>ব্যাচ</TableHead>
                  <TableHead className="text-right">প্রাপ্ত/পূর্ণমান</TableHead>
                  <TableHead className="text-right">শতকরা</TableHead>
                  <TableHead>গ্রেড</TableHead>
                  <TableHead>ফলাফল</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingList ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">কোনো শিক্ষার্থী পাওয়া যায়নি</TableCell></TableRow>
                ) : items.map((s, i) => (
                  <TableRow key={s.studentId} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedStudent({ id: s.studentId, name: s.name })}>
                    <TableCell className="text-xs">{meta ? (meta.page - 1) * meta.limit + i + 1 : i + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{s.rollNumber || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{s.registrationId}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm">{s.phone}</TableCell>
                    <TableCell className="text-sm">{s.course || "—"}</TableCell>
                    <TableCell className="text-sm">{s.batchName || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{s.totalObtained}/{s.totalFullMarks}</TableCell>
                    <TableCell className="text-right">{s.percentage ?? "-"}</TableCell>
                    <TableCell>{s.grade || "-"}</TableCell>
                    <TableCell>{resultBadge(s.result)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
              <p className="text-sm text-muted-foreground">
                মোট {meta.total.toLocaleString("bn-BD")} জনের মধ্যে {((meta.page - 1) * meta.limit + 1).toLocaleString("bn-BD")}–
                {Math.min(meta.page * meta.limit, meta.total).toLocaleString("bn-BD")} জন দেখানো হচ্ছে
              </p>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      className={meta.page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      onClick={() => meta.page > 1 && setPage(meta.page - 1)}
                    />
                  </PaginationItem>
                  {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1)
                    .map((p, idx, arr) => (
                      <PaginationItem key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 ? <span className="px-2 text-muted-foreground">…</span> : null}
                        <PaginationLink isActive={p === meta.page} className="cursor-pointer" onClick={() => setPage(p)}>
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      className={meta.page >= meta.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      onClick={() => meta.page < meta.totalPages && setPage(meta.page + 1)}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** One editable "obtained marks" row — pencil to enter edit mode, check to save, X to cancel. Never creates a new record: only PATCHes the existing resultId. */
function ResultRowEditable({ row, onUpdated }: { row: ResultRowView; onUpdated: (row: ResultRowView) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.obtainedMarks === null ? "" : String(row.obtainedMarks));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const startEdit = () => {
    setValue(row.obtainedMarks === null ? "" : String(row.obtainedMarks));
    setEditing(true);
  };

  const save = async () => {
    if (savingRef.current) return;
    const marks = value.trim() === "" ? null : Number(value);
    if (marks !== null && (Number.isNaN(marks) || marks < 0 || marks > row.fullMarks)) {
      toast({ title: "ভুল নম্বর", description: `নম্বর ০ থেকে ${row.fullMarks}-এর মধ্যে হতে হবে।` });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const updated = await api.patch<ResultRowView>(`/result-management/results/${row.resultId}`, { marks });
      onUpdated(updated);
      setEditing(false);
      toast({ title: "নম্বর হালনাগাদ হয়েছে" });
    } catch (err) {
      toast({ title: "ব্যর্থ", description: friendlyError(err, "নম্বর সংরক্ষণ করা যায়নি।") });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <TableRow>
      <TableCell>{row.subjectName}</TableCell>
      <TableCell className="text-sm">{row.examTitle} <span className="text-xs text-muted-foreground">({row.lectureTitle})</span></TableCell>
      <TableCell className="text-xs">{row.date}</TableCell>
      <TableCell className="text-right">{row.fullMarks}</TableCell>
      <TableCell>
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={row.fullMarks}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 w-20"
              autoFocus
              disabled={saving}
            />
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={save} disabled={saving}>
              <Save className="h-4 w-4 text-success" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditing(false)} disabled={saving}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{row.obtainedMarks ?? "অনুপস্থিত"}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 print:hidden" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">{row.percentage ?? "-"}</TableCell>
      <TableCell>{row.grade || "-"}</TableCell>
      <TableCell>
        <Badge
          className={
            row.result === "পাস" ? "bg-success/10 text-success border-success/20"
              : row.result === "ফেল" ? "bg-destructive/10 text-destructive border-destructive/20"
              : "bg-muted text-muted-foreground"
          }
        >
          {row.result}
        </Badge>
      </TableCell>
      <TableCell className="print:hidden">
        {row.isPublished ? <Badge variant="outline" className="text-xs">প্রকাশিত</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground">অপ্রকাশিত</Badge>}
      </TableCell>
    </TableRow>
  );
}

/* -------------------------------------------------------------------- */
/* Batch-wise Result                                                     */
/* -------------------------------------------------------------------- */

function BatchResultTab({ isDirector }: { isDirector: boolean }) {
  const { user } = useAuth();
  const { batches } = useBatches();
  const { courses, getSubjectsByCourse, getLecturesBySubject } = useAcademic();
  const { listExams } = useAttendance();

  const myBatches = useMemo(
    () => (isDirector && user ? batches.filter((b) => b.directorId === user.staffId) : batches),
    [batches, isDirector, user],
  );

  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [lectureId, setLectureId] = useState("");
  const [examId, setExamId] = useState("");
  const [examOptions, setExamOptions] = useState<{ id: string; title: string; date: string }[]>([]);

  const courseBatches = useMemo(
    () => (courseId ? myBatches.filter((b) => b.courseId === courseId) : myBatches),
    [myBatches, courseId],
  );
  const courseSubjects = useMemo(() => (courseId ? getSubjectsByCourse(courseId) : []), [getSubjectsByCourse, courseId]);
  const subjectLectures = useMemo(
    () => (courseId && subjectId ? getLecturesBySubject(courseId, subjectId) : []),
    [getLecturesBySubject, courseId, subjectId],
  );

  useEffect(() => { setBatchId(""); setSubjectId(""); setLectureId(""); setExamId(""); }, [courseId]);
  useEffect(() => { setLectureId(""); setExamId(""); }, [subjectId]);
  useEffect(() => { setExamId(""); }, [lectureId]);

  useEffect(() => {
    if (!batchId) { setExamOptions([]); return; }
    let cancelled = false;
    listExams({ batchId, subjectId: subjectId || undefined, lectureId: lectureId || undefined })
      .then((exams) => { if (!cancelled) setExamOptions(exams.map((e) => ({ id: e.id, title: e.title, date: e.date }))); })
      .catch(() => { if (!cancelled) setExamOptions([]); });
    return () => { cancelled = true; };
  }, [batchId, subjectId, lectureId, listExams]);

  const [view, setView] = useState<BatchResultView | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!batchId) return;
    setLoading(true);
    const qs = new URLSearchParams({ batchId });
    if (subjectId) qs.set("subjectId", subjectId);
    if (lectureId) qs.set("lectureId", lectureId);
    if (examId) qs.set("examId", examId);
    api
      .get<BatchResultView>(`/result-management/batch?${qs.toString()}`)
      .then(setView)
      .catch((err) => {
        toast({ title: "লোড ব্যর্থ", description: friendlyError(err, "ফলাফল লোড করা যায়নি।") });
        setView(null);
      })
      .finally(() => setLoading(false));
  }, [batchId, subjectId, lectureId, examId]);

  useEffect(() => { if (batchId) load(); else setView(null); }, [batchId, subjectId, lectureId, examId, load]);

  const handleCellUpdated = (rowIndex: number, colIndex: number, updated: ResultRowView) => {
    setView((prev) => {
      if (!prev) return prev;
      const rows = [...prev.rows];
      const row = { ...rows[rowIndex] };
      const cells = [...row.cells];
      cells[colIndex] = { resultId: updated.resultId, value: updated.obtainedMarks, status: updated.obtainedMarks === null ? "absent" : "present" };
      row.cells = cells;
      let totalObtained = 0, totalFullMarks = 0;
      cells.forEach((c, i) => { if (c.status === "present") { totalObtained += c.value as number; totalFullMarks += prev.columns[i].fullMarks; } });
      row.totalObtained = totalObtained;
      row.totalFullMarks = totalFullMarks;
      row.percentage = totalFullMarks > 0 ? Math.round((totalObtained / totalFullMarks) * 10000) / 100 : 0;
      row.grade = updated.grade || row.grade;
      rows[rowIndex] = row;
      return { ...prev, rows };
    });
  };

  const handlePrint = () => {
    if (!view) return;
    printReport(
      `ব্যাচভিত্তিক ফলাফল — ${view.batch.name}`,
      ["SL", "রোল", "রেজিঃ আইডি", "নাম", ...view.columns.map((c) => `${c.subjectName} (${c.date})`), "মোট প্রাপ্ত", "মোট পূর্ণমান", "শতকরা", "গ্রেড"],
      view.rows.map((r, i) => [
        i + 1, r.rollNumber, r.registrationId, r.name,
        ...r.cells.map((c) => (c.status === "na" ? "না" : c.status === "absent" ? "অনুপস্থিত" : c.value ?? "-")),
        r.totalObtained, r.totalFullMarks, r.percentage, r.grade,
      ]),
    );
  };

  const handleExport = () => {
    if (!view) return;
    exportExcel({
      filename: `batch-result-${view.batch.name}`,
      title: `ব্যাচভিত্তিক ফলাফল — ${view.batch.name}`,
      headers: ["SL", "রোল", "রেজিঃ আইডি", "নাম", ...view.columns.map((c) => `${c.subjectName} (${c.date})`), "মোট প্রাপ্ত", "মোট পূর্ণমান", "শতকরা", "গ্রেড"],
      rows: view.rows.map((r, i) => [
        i + 1, r.rollNumber, r.registrationId, r.name,
        ...r.cells.map((c) => (c.status === "na" ? "না" : c.status === "absent" ? "অনুপস্থিত" : c.value ?? "-")),
        r.totalObtained, r.totalFullMarks, r.percentage, r.grade,
      ]),
    });
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">ফিল্টার</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <Label>কোর্স</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="সকল কোর্স" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ব্যাচ</Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger><SelectValue placeholder="ব্যাচ নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                {courseBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>সাবজেক্ট (ঐচ্ছিক)</Label>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={!courseId}>
              <SelectTrigger><SelectValue placeholder="সকল সাবজেক্ট" /></SelectTrigger>
              <SelectContent>
                {courseSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>লেকচার (ঐচ্ছিক)</Label>
            <Select value={lectureId} onValueChange={setLectureId} disabled={!subjectId}>
              <SelectTrigger><SelectValue placeholder="সকল লেকচার" /></SelectTrigger>
              <SelectContent>
                {subjectLectures.map((l) => <SelectItem key={l.id} value={l.id}>{l.lectureNumber}. {l.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>এক্সাম (ঐচ্ছিক)</Label>
            <Select value={examId} onValueChange={setExamId} disabled={!batchId || examOptions.length === 0}>
              <SelectTrigger><SelectValue placeholder="সকল এক্সাম" /></SelectTrigger>
              <SelectContent>
                {examOptions.map((e) => <SelectItem key={e.id} value={e.id}>{e.title} ({e.date})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card className="border-none shadow-sm"><CardContent className="py-8"><Skeleton className="h-32 w-full" /></CardContent></Card>
      )}

      {!loading && !batchId && (
        <Card className="border-none shadow-sm"><CardContent className="py-10 text-center text-muted-foreground">ফলাফল দেখতে একটি ব্যাচ নির্বাচন করুন</CardContent></Card>
      )}

      {!loading && view && (
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">{view.batch.name}</CardTitle>
              {view.batch.courseName && <p className="text-xs text-muted-foreground mt-1">কোর্স: {view.batch.courseName}</p>}
            </div>
            {view.rows.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}><FileSpreadsheet className="h-4 w-4 mr-1.5" />এক্সপোর্ট</Button>
                <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1.5" />প্রিন্ট</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">SL</TableHead>
                    <TableHead>রোল</TableHead>
                    <TableHead>রেজিঃ আইডি</TableHead>
                    <TableHead>নাম</TableHead>
                    {view.columns.map((c) => (
                      <TableHead key={c.examId} className="text-center min-w-[110px]">
                        <div className="text-xs">{c.subjectName}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{c.examTitle} • {c.date}</div>
                      </TableHead>
                    ))}
                    <TableHead className="text-right">মোট</TableHead>
                    <TableHead className="text-right">শতকরা</TableHead>
                    <TableHead>গ্রেড</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.rows.length === 0 ? (
                    <TableRow><TableCell colSpan={7 + view.columns.length} className="text-center py-8 text-muted-foreground">কোনো ফলাফল পাওয়া যায়নি</TableCell></TableRow>
                  ) : view.rows.map((row, ri) => (
                    <TableRow key={row.studentId}>
                      <TableCell className="text-xs">{ri + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{row.rollNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{row.registrationId}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      {row.cells.map((cell, ci) => (
                        <BatchCellEditable
                          key={ci}
                          cell={cell}
                          fullMarks={view.columns[ci].fullMarks}
                          onUpdated={(updated) => handleCellUpdated(ri, ci, updated)}
                        />
                      ))}
                      <TableCell className="text-right text-sm">{row.totalObtained}/{row.totalFullMarks}</TableCell>
                      <TableCell className="text-right">{row.percentage}</TableCell>
                      <TableCell>{row.grade}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BatchCellEditable({ cell, fullMarks, onUpdated }: { cell: BatchResultCell; fullMarks: number; onUpdated: (updated: ResultRowView) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cell.value === null ? "" : String(cell.value));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  if (cell.status === "na" || !cell.resultId) {
    return <TableCell className="text-center text-muted-foreground text-xs" title="এই শিক্ষার্থী এই পরীক্ষায় ছিল না">—</TableCell>;
  }

  const save = async () => {
    if (savingRef.current) return;
    const marks = value.trim() === "" ? null : Number(value);
    if (marks !== null && (Number.isNaN(marks) || marks < 0 || marks > fullMarks)) {
      toast({ title: "ভুল নম্বর", description: `নম্বর ০ থেকে ${fullMarks}-এর মধ্যে হতে হবে।` });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const updated = await api.patch<ResultRowView>(`/result-management/results/${cell.resultId}`, { marks });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      toast({ title: "ব্যর্থ", description: friendlyError(err, "নম্বর সংরক্ষণ করা যায়নি।") });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <TableCell className="text-center">
      {editing ? (
        <div className="flex items-center justify-center gap-1">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={fullMarks}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 w-16 text-center px-1"
            autoFocus
            disabled={saving}
          />
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={save} disabled={saving}>
            <Save className="h-3.5 w-3.5 text-success" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="w-full h-full min-h-[2rem] hover:bg-muted/60 rounded px-2 py-1 text-sm"
          onClick={() => { setValue(cell.value === null ? "" : String(cell.value)); setEditing(true); }}
        >
          {cell.status === "absent" ? <span className="text-destructive text-xs">অনুপস্থিত</span> : cell.value}
        </button>
      )}
    </TableCell>
  );
}

export default ResultManagement;
