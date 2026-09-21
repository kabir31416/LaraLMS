import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Settings2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { fromApi, type ApiStudent } from "@/contexts/StudentContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useAttendance, ResultSmsTemplateConfig } from "@/contexts/AttendanceContext";
import type { AttendanceStatus } from "@/types/attendance";
import type { Student } from "@/types/student";
import { toast } from "@/hooks/use-toast";
import { ApiClientError, api } from "@/lib/apiClient";

/**
 * Result Entry — the single place marks and attendance are recorded
 * together for one Subject/Lecture/Date (Phase 5). There is no separate
 * attendance workflow for directors anymore (see routes.tsx/AppSidebar.tsx —
 * "/director/attendance" now redirects here): saving a result always saves
 * attendance for the same students in the same action.
 *
 * Reused for two routes/roles: a Batch Director only sees and can act on
 * their own batch(es) (unchanged); an Admin sees every batch in the system,
 * so Admin can enter results for any batch, not just their own — the
 * backend already allowed this via EXAMS_MANAGE (assertCanActOnBatch in
 * exam.service.ts never restricted Admin), this page was simply never
 * reachable for that role before.
 *
 * "Save Result" and "Send Result" are two distinct actions (Result Entry
 * SMS Split): Save never touches the SMS gateway; Send saves first (the
 * exact same save step) and only then texts guardians using the single,
 * system-wide Result SMS Template — editable only by an Admin (see the
 * "Result SMS টেমপ্লেট" button below, hidden for Batch Director).
 */
const DirectorResults = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const { batches } = useBatches();
  const { courses, getSubjectsByCourse, getCourseSubjectId, lectures } = useAcademic();
  const { listExams, getResultsByExam, getByBatchDate, saveResult, submitResult, resendSms, getResultSmsTemplate, updateResultSmsTemplate } = useAttendance();

  // Admin can enter results for any batch; a Batch Director only their own.
  const myBatches = useMemo(
    () => (isAdmin ? batches : user ? batches.filter((b) => b.directorId === user.staffId) : []),
    [batches, user, isAdmin],
  );

  const [batchId, setBatchId] = useState<string>(myBatches[0]?.id || "");
  useEffect(() => {
    if (!batchId && myBatches[0]) setBatchId(myBatches[0].id);
  }, [myBatches, batchId]);

  const batch = myBatches.find((b) => b.id === batchId);
  // Batch.courseId is a real Course reference, so this is a direct lookup.
  const batchCourse = useMemo(() => courses.find((c) => c.id === batch?.courseId), [courses, batch]);
  const courseSubjects = useMemo(
    () => (batchCourse ? getSubjectsByCourse(batchCourse.id) : []),
    [getSubjectsByCourse, batchCourse],
  );
  const [subjectId, setSubjectId] = useState<string>("");
  const [lectureId, setLectureId] = useState<string>("");
  // Clear a stale subject if it no longer belongs to the selected batch's course.
  useEffect(() => {
    if (subjectId && !courseSubjects.some((s) => s.id === subjectId)) {
      setSubjectId("");
      setLectureId("");
    }
  }, [courseSubjects, subjectId]);
  // The CourseSubject this batch's Course + the selected global Subject resolve to
  // — the actual id Lectures/Exams key off, never the global Subject id alone
  // (the same Subject can be assigned to other Courses with entirely different Lectures).
  const courseSubjectId = batchCourse && subjectId ? getCourseSubjectId(batchCourse.id, subjectId) : undefined;
  const subjectLectures = useMemo(
    () => lectures.filter((l) => l.courseSubjectId === courseSubjectId).sort((a, b) => a.lectureNumber - b.lectureNumber),
    [lectures, courseSubjectId],
  );

  const [fullMarks, setFullMarks] = useState<number>(50);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // This batch's own roster — fetched fresh, scoped by batchId
  // (`/students?batchId=`, already roll-sorted server-side) whenever the
  // selected batch changes, instead of filtering StudentContext's own
  // capped ≤100-row global list, which would silently omit any of this
  // batch's students who fall outside that cap once total students grow.
  const [batchStudents, setBatchStudents] = useState<Student[]>([]);
  useEffect(() => {
    if (!batch) { setBatchStudents([]); return; }
    let cancelled = false;
    api.get<ApiStudent[]>(`/students?batchId=${batch.id}&limit=100`)
      .then((docs) => { if (!cancelled) setBatchStudents(docs.map(fromApi)); })
      .catch(() => { if (!cancelled) setBatchStudents([]); });
    return () => { cancelled = true; };
  }, [batch]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [existingExamId, setExistingExamId] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [busyAction, setBusyAction] = useState<"save" | "send" | "retry" | null>(null);
  const [summary, setSummary] = useState<{ resultsSaved: number; smsSent: number; smsFailed: number; failedStudents: { studentId: string; name: string; roll?: string; reason: "guardianPhoneMissing" | "gatewayFailed" }[] } | null>(null);

  // Synchronous guard: React's `busyAction` state won't disable the buttons
  // until the next render, which two clicks inside the same tick (or a
  // browser that fires both before repainting) can both slip past. Shared
  // across Save/Send/Retry so none of them can overlap either.
  const busyRef = useRef(false);

  // Load any already-saved result for this exact batch+subject+lecture+date
  // combination, so reopening it shows previous entries instead of a blank
  // sheet — and re-saving/re-sending updates that same result rather than
  // creating a duplicate (the backend enforces this too; this is just so
  // the director sees what's already there before they touch anything).
  useEffect(() => {
    setSummary(null);
    if (!batch || !courseSubjectId || !date) {
      setMarks({});
      setAttendance({});
      setExistingExamId(null);
      return;
    }
    let cancelled = false;
    setLoadingExisting(true);
    (async () => {
      try {
        // Fetched without a lectureId filter and matched client-side against
        // the current selection (Result Entry Lecture-optional audit §11) —
        // "no lecture chosen" and "a specific lecture chosen" are two
        // distinct exam identities for the same batch+courseSubject+date
        // (mirroring the backend's own `lectureId ?? { $exists: false }`
        // upsert filter), so a plain query-param filter that's simply
        // omitted when empty would incorrectly match a different exam that
        // does have a lecture.
        const exams = await listExams({ batchId: batch.id, courseSubjectId, date });
        const exam = exams.find((e) => (e.lectureId || undefined) === (lectureId || undefined));
        if (cancelled) return;
        if (!exam) {
          setMarks({});
          setAttendance({});
          setExistingExamId(null);
          return;
        }
        setExistingExamId(exam.id);
        setFullMarks(exam.fullMarks);
        const [results, attendanceEntries] = await Promise.all([getResultsByExam(exam.id), getByBatchDate(batch.id, date)]);
        if (cancelled) return;
        const markMap: Record<string, string> = {};
        for (const r of results) if (r.marks !== null) markMap[r.studentId] = String(r.marks);
        const attMap: Record<string, AttendanceStatus> = {};
        for (const a of attendanceEntries) if (a.source === "Exam" && a.examId === exam.id) attMap[a.studentId] = a.status;
        setMarks(markMap);
        setAttendance(attMap);
      } catch {
        // No existing result yet (or it failed to load) — start from a blank sheet.
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.id, courseSubjectId, lectureId, date]);

  // Rule 1/2: a typed mark means Present, a cleared mark falls back to Absent.
  const handleMarks = (sid: string, val: string) => {
    setMarks((p) => ({ ...p, [sid]: val }));
    setAttendance((p) => ({ ...p, [sid]: val.trim() ? "Present" : "Absent" }));
  };

  // Rule 3/4: flipping the toggle by hand always wins — Absent clears/locks the mark, Present unlocks it.
  const handleToggle = (sid: string, checked: boolean) => {
    const status: AttendanceStatus = checked ? "Present" : "Absent";
    setAttendance((p) => ({ ...p, [sid]: status }));
    if (!checked) setMarks((p) => ({ ...p, [sid]: "" }));
  };

  /**
   * Shared validation + payload build for both Save Result and Send Result
   * — identical save step either way. `lectureId` is optional (Result Entry
   * Lecture-optional audit §11) — omitted from the payload entirely when
   * empty, rather than sent as `""`, so the backend never has to treat an
   * empty string as "no lecture" on its own.
   */
  const buildPayload = (): { batchId: string; courseSubjectId: string; lectureId?: string; date: string; fullMarks: number; items: { studentId: string; marks: number | null; attendance: AttendanceStatus }[] } | null => {
    if (!batch || !courseSubjectId) {
      toast({ title: "তথ্য অসম্পূর্ণ", description: "ব্যাচ ও সাবজেক্ট নির্বাচন করুন।" });
      return null;
    }
    if (!fullMarks || fullMarks <= 0) {
      toast({ title: "ভুল পূর্ণ মান", description: "পূর্ণ মান শূন্যের বেশি হতে হবে।" });
      return null;
    }
    if (batchStudents.length === 0) {
      toast({ title: "কোনো শিক্ষার্থী নেই", description: "এই ব্যাচে কোনো শিক্ষার্থী যুক্ত নেই।" });
      return null;
    }

    // Validate before saving anything — Present always needs a valid 0..fullMarks mark.
    for (const s of batchStudents) {
      const status = attendance[s.id] || "Absent";
      if (status !== "Present") continue;
      const raw = marks[s.id];
      const num = raw?.trim() ? Number(raw) : NaN;
      if (raw === undefined || raw.trim() === "" || Number.isNaN(num)) {
        toast({ title: "নম্বর প্রয়োজন", description: `${s.name} উপস্থিত হিসেবে চিহ্নিত কিন্তু নম্বর দেওয়া হয়নি।` });
        return null;
      }
      if (num < 0 || num > fullMarks) {
        toast({ title: "ভুল নম্বর", description: `${s.name}-এর নম্বর ০ থেকে ${fullMarks}-এর মধ্যে হতে হবে।` });
        return null;
      }
    }

    const items = batchStudents.map((s) => {
      const status: AttendanceStatus = attendance[s.id] || "Absent";
      const raw = marks[s.id];
      const num = status === "Present" && raw?.trim() ? Number(raw) : null;
      return { studentId: s.id, marks: num, attendance: status };
    });

    return { batchId: batch.id, courseSubjectId, lectureId: lectureId || undefined, date, fullMarks, items };
  };

  const errorMessage = (err: unknown, fallback: string) => (err instanceof ApiClientError ? err.message : fallback);

  /** "Save Result" — only saves marks + attendance, never calls the SMS API. Safe to click repeatedly. */
  const handleSave = async () => {
    if (busyRef.current) return;
    const payload = buildPayload();
    if (!payload) return;

    busyRef.current = true;
    setBusyAction("save");
    setSummary(null);
    try {
      const result = await saveResult(payload);
      setExistingExamId(result.examId);
      toast({ title: "রেজাল্ট সংরক্ষিত হয়েছে", description: "Result successfully saved. SMS পাঠানো হয়নি।" });
    } catch (err) {
      toast({ title: "সংরক্ষণ ব্যর্থ", description: errorMessage(err, "রেজাল্ট সংরক্ষণ করা যায়নি।") });
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  };

  /** "Send Result" — saves first, and only after that save actually commits does it text guardians. SMS failure never rolls back the save. */
  const handleSend = async () => {
    if (busyRef.current) return;
    const payload = buildPayload();
    if (!payload) return;

    busyRef.current = true;
    setBusyAction("send");
    setSummary(null);
    try {
      const result = await submitResult(payload);
      setExistingExamId(result.examId);
      setSummary(result);
      if (result.smsFailed > 0) {
        toast({ title: "আংশিক সফল", description: `Result saved, but SMS পাঠানো যায়নি ${result.smsFailed} জনের জন্য। সংরক্ষণ: ${result.resultsSaved} জন, SMS: ${result.smsSent} জন।` });
      } else {
        toast({ title: "রেজাল্ট পাঠানো হয়েছে", description: `সংরক্ষণ: ${result.resultsSaved} জন। SMS পাঠানো হয়েছে: ${result.smsSent} জনকে।` });
      }
    } catch (err) {
      toast({ title: "ব্যর্থ", description: errorMessage(err, "রেজাল্ট পাঠানো যায়নি।") });
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  };

  const handleRetrySms = async () => {
    if (busyRef.current || !existingExamId || !summary?.failedStudents.length) return;
    busyRef.current = true;
    setBusyAction("retry");
    try {
      const retry = await resendSms(existingExamId, summary.failedStudents.map((f) => f.studentId));
      setSummary((prev) => (prev ? { ...prev, smsSent: prev.smsSent + retry.smsSent, smsFailed: retry.smsFailed, failedStudents: retry.failedStudents } : prev));
      toast({ title: "পুনরায় পাঠানো হয়েছে", description: `SMS পাঠানো হয়েছে: ${retry.smsSent} জনকে। ব্যর্থ: ${retry.smsFailed} জন।` });
    } catch (err) {
      toast({ title: "ব্যর্থ", description: errorMessage(err, "SMS পুনরায় পাঠানো যায়নি।") });
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  };

  const failureReasonLabel = (reason: "guardianPhoneMissing" | "gatewayFailed") =>
    reason === "guardianPhoneMissing" ? "অভিভাবকের মোবাইল নম্বর নেই" : "SMS গেটওয়ে ব্যর্থ";

  const busy = busyAction !== null;

  const [templateOpen, setTemplateOpen] = useState(false);

  if (!user || (user.role !== "Batch Director" && user.role !== "Admin")) return <Navigate to="/login" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">রেজাল্ট এন্ট্রি</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "ব্যাচ নির্বাচন করে নম্বর ও উপস্থিতি একসাথে দিন — যেকোনো ব্যাচের জন্য" : "এখান থেকেই নম্বর ও উপস্থিতি একসাথে দিন — কোর্স আপনার ব্যাচ থেকে অটো লোড হবে"}
            </p>
          </div>
          {/* SMS ফরম্যাট এখন একটিমাত্র, সিস্টেম-ওয়াইড সেটিং — শুধু Admin ড্যাশবোর্ড থেকে সেট করা যাবে। */}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)} className="self-start sm:self-auto">
              <Settings2 className="h-4 w-4 mr-2" />
              Result SMS টেমপ্লেট
            </Button>
          )}
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-base">এক্সাম তথ্য</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {myBatches.length > 1 && (
              <div>
                <Label>ব্যাচ</Label>
                <Select value={batchId} onValueChange={(v) => { setBatchId(v); setSubjectId(""); setLectureId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {myBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>কোর্স</Label>
              <Input value={batchCourse?.name || "—"} disabled />
            </div>
            <div>
              <Label>সাবজেক্ট</Label>
              <Select
                value={subjectId}
                onValueChange={(v) => { setSubjectId(v); setLectureId(""); }}
                disabled={courseSubjects.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={courseSubjects.length === 0 ? "সাবজেক্ট নেই" : "নির্বাচন"} />
                </SelectTrigger>
                <SelectContent>
                  {courseSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {courseSubjects.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  এই কোর্সে কোনো সাবজেক্ট নেই — একাডেমিক সেটিংস থেকে যোগ করুন।
                </p>
              )}
            </div>
            <div>
              <Label>লেকচার (ঐচ্ছিক)</Label>
              <Select value={lectureId || "none"} onValueChange={(v) => setLectureId(v === "none" ? "" : v)} disabled={!subjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="লেকচার নির্বাচন করুন (ঐচ্ছিক)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— কোনো লেকচার নয় —</SelectItem>
                  {subjectLectures.map((l) => <SelectItem key={l.id} value={l.id}>{l.lectureNumber}. {l.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>তারিখ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>মোট নম্বর (Total Marks)</Label>
              <Input type="number" min={1} value={fullMarks} onChange={(e) => setFullMarks(Number(e.target.value))} />
            </div>
            {existingExamId && (
              <div className="md:col-span-3">
                <Badge variant="outline" className="text-xs">এই এন্ট্রির আগের রেজাল্ট পাওয়া গেছে — নিচে দেখানো হচ্ছে, নতুন করে সংরক্ষণ/পাঠালে তা হালনাগাদ হবে (নতুন এন্ট্রি তৈরি হবে না)</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-base">শিক্ষার্থী তালিকা ({batchStudents.length})</CardTitle></CardHeader>
          <CardContent>
            {/* Desktop/tablet: table layout, unchanged. */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>রোল</TableHead>
                    <TableHead>Registration ID</TableHead>
                    <TableHead>নাম</TableHead>
                    <TableHead className="w-[120px]">নম্বর</TableHead>
                    <TableHead className="w-[160px] text-center">উপস্থিতি</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingExisting ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</TableCell></TableRow>
                  ) : batchStudents.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">কোনো শিক্ষার্থী নেই</TableCell></TableRow>
                  ) : batchStudents.map((s) => {
                    const status: AttendanceStatus = attendance[s.id] || "Absent";
                    const isPresent = status === "Present";
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.rollNumber || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{s.studentId}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={fullMarks}
                            value={marks[s.id] || ""}
                            onChange={(e) => handleMarks(s.id, e.target.value)}
                            disabled={!isPresent}
                            placeholder="—"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <span className={`text-xs ${!isPresent ? "text-destructive font-medium" : "text-muted-foreground"}`}>অনুপস্থিত</span>
                            <Switch checked={isPresent} onCheckedChange={(c) => handleToggle(s.id, c)} />
                            <span className={`text-xs ${isPresent ? "text-success font-medium" : "text-muted-foreground"}`}>উপস্থিত</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/*
              Mobile: a table here squeezes the mark input to near-unusable
              width once রোল/নাম/উপস্থিতি all fight for the same row (Result
              Entry Mobile UI Fix). Each student instead gets its own
              full-width row: roll+name on top so they stay clearly attached
              to the input below them, then a large touch-friendly numeric
              input plus the attendance toggle — no column ever shrinks the
              input to fit unrelated content.
            */}
            <div className="md:hidden space-y-2">
              {loadingExisting ? (
                <p className="text-center py-8 text-sm text-muted-foreground">লোড হচ্ছে...</p>
              ) : batchStudents.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">কোনো শিক্ষার্থী নেই</p>
              ) : batchStudents.map((s) => {
                const status: AttendanceStatus = attendance[s.id] || "Absent";
                const isPresent = status === "Present";
                return (
                  <div key={s.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">রোল: {s.rollNumber || "—"} · Reg ID: {s.studentId}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs ${!isPresent ? "text-destructive font-medium" : "text-muted-foreground"}`}>অনুপস্থিত</span>
                        <Switch checked={isPresent} onCheckedChange={(c) => handleToggle(s.id, c)} />
                        <span className={`text-xs ${isPresent ? "text-success font-medium" : "text-muted-foreground"}`}>উপস্থিত</span>
                      </div>
                    </div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={fullMarks}
                      value={marks[s.id] || ""}
                      onChange={(e) => handleMarks(s.id, e.target.value)}
                      disabled={!isPresent}
                      placeholder={`নম্বর (০ - ${fullMarks})`}
                      className="w-full h-12 text-lg"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
              <Button onClick={handleSave} disabled={busy || loadingExisting} variant="outline" size="lg">
                {busyAction === "save" ? "সংরক্ষণ হচ্ছে..." : "Save Result"}
              </Button>
              <Button onClick={handleSend} disabled={busy || loadingExisting} size="lg">
                {busyAction === "send" ? "পাঠানো হচ্ছে..." : "Send Result"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {summary && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-base">সংরক্ষণ সারাংশ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-2xl font-bold">{summary.resultsSaved}</p>
                  <p className="text-xs text-muted-foreground">রেজাল্ট সংরক্ষিত</p>
                </div>
                <div className="rounded-lg bg-success/10 p-3">
                  <p className="text-2xl font-bold text-success">{summary.smsSent}</p>
                  <p className="text-xs text-muted-foreground">SMS পাঠানো হয়েছে</p>
                </div>
                <div className="rounded-lg bg-destructive/10 p-3">
                  <p className="text-2xl font-bold text-destructive">{summary.smsFailed}</p>
                  <p className="text-xs text-muted-foreground">SMS ব্যর্থ</p>
                </div>
              </div>
              {summary.failedStudents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    যাদের SMS পাঠানো যায়নি: {summary.failedStudents.map((f) => `${f.name}${f.roll ? ` (রোল ${f.roll})` : ""} — ${failureReasonLabel(f.reason)}`).join("; ")}
                  </p>
                  <Button variant="outline" size="sm" onClick={handleRetrySms} disabled={busy}>
                    {busyAction === "retry" ? "পাঠানো হচ্ছে..." : "ব্যর্থ SMS আবার পাঠান"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <ResultSmsTemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        getResultSmsTemplate={getResultSmsTemplate}
        updateResultSmsTemplate={updateResultSmsTemplate}
      />
    </DashboardLayout>
  );
};

/**
 * Result SMS Template editor — a Batch Director's own template (Batch
 * Director Result SMS Template System), stored server-side (Staff.
 * resultSmsTemplate / Settings.resultSmsTemplate), never hardcoded in the
 * frontend. Placeholders are validated against the actual variable list
 * the backend returns (RESULT_SMS_VARIABLES) — never an invented field.
 */
function ResultSmsTemplateDialog({
  open,
  onOpenChange,
  getResultSmsTemplate,
  updateResultSmsTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getResultSmsTemplate: () => Promise<ResultSmsTemplateConfig>;
  updateResultSmsTemplate: (template: string) => Promise<ResultSmsTemplateConfig>;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ResultSmsTemplateConfig | null>(null);
  const [template, setTemplate] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const cfg = await getResultSmsTemplate();
        if (cancelled) return;
        setConfig(cfg);
        setTemplate(cfg.effectiveTemplate);
      } catch {
        if (!cancelled) toast({ title: "ব্যর্থ", description: "টেমপ্লেট লোড করা যায়নি।" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, getResultSmsTemplate]);

  const unknownPlaceholders = useMemo(() => {
    if (!config) return [];
    const knownKeys = new Set(config.variables.map((v) => v.key));
    const found = new Set<string>();
    for (const m of template.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)) {
      if (!knownKeys.has(m[1])) found.add(m[1]);
    }
    return Array.from(found);
  }, [template, config]);

  const previewText = useMemo(() => {
    if (!config) return "";
    const sample: Record<string, string> = {
      studentName: "রহিম উদ্দিন", roll: "12", registrationId: "REG-1023", courseName: "HSC কোচিং",
      batchName: "সকাল ব্যাচ", examName: "গণিত - অধ্যায় ৩", subjectName: "গণিত", fullMarks: "100",
      obtainedMarks: "৮৫", percentage: "৮৫", grade: "A+", result: "পাস", guardianName: "আব্দুল করিম", date: "১৫-০৯-২০২৬",
      highestMark: "৯৮",
    };
    return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_m, key: string) => sample[key] ?? "");
  }, [template, config]);

  const insertVariable = (key: string) => {
    const el = textareaRef.current;
    const placeholder = `{{${key}}}`;
    if (!el) {
      setTemplate((t) => t + placeholder);
      return;
    }
    const start = el.selectionStart ?? template.length;
    const end = el.selectionEnd ?? template.length;
    const next = template.slice(0, start) + placeholder + template.slice(end);
    setTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + placeholder.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSave = async () => {
    if (!template.trim()) {
      toast({ title: "খালি টেমপ্লেট", description: "টেমপ্লেট খালি রাখা যাবে না।" });
      return;
    }
    if (unknownPlaceholders.length > 0) {
      toast({ title: "অসমর্থিত ভ্যারিয়েবল", description: `এই ভ্যারিয়েবলগুলো সমর্থিত নয়: ${unknownPlaceholders.map((k) => `{{${k}}}`).join(", ")}` });
      return;
    }
    setSaving(true);
    try {
      const cfg = await updateResultSmsTemplate(template.trim());
      setConfig(cfg);
      setTemplate(cfg.effectiveTemplate);
      toast({ title: "টেমপ্লেট সংরক্ষিত হয়েছে" });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "ব্যর্থ", description: err instanceof ApiClientError ? err.message : "টেমপ্লেট সংরক্ষণ করা যায়নি।" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col overflow-hidden max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle>Result SMS টেমপ্লেট</DialogTitle>
          <DialogDescription>
            "Send Result" চাপলে এই টেমপ্লেট দিয়ে অভিভাবকের নম্বরে SMS পাঠানো হবে। নিচের ভ্যারিয়েবলগুলো ব্যবহার করতে পারবেন।
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">লোড হচ্ছে...</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div>
              <Label className="mb-1.5 block">উপলব্ধ ভ্যারিয়েবল (ক্লিক করলে যোগ হবে)</Label>
              <div className="flex flex-wrap gap-1.5">
                {config?.variables.map((v) => (
                  <Button key={v.key} type="button" variant="secondary" size="sm" className="h-7 text-xs font-mono" onClick={() => insertVariable(v.key)} title={v.label}>
                    {`{{${v.key}}}`}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">টেমপ্লেট</Label>
              <Textarea ref={textareaRef} value={template} onChange={(e) => setTemplate(e.target.value)} rows={6} className="font-mono text-sm resize-y" />
              {unknownPlaceholders.length > 0 && (
                <p className="mt-1.5 text-xs text-destructive">
                  অসমর্থিত ভ্যারিয়েবল: {unknownPlaceholders.map((k) => `{{${k}}}`).join(", ")}
                </p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                এটি প্রতিষ্ঠানের একমাত্র Result SMS ফরম্যাট — যেকোনো Batch Director "Send Result" চাপলে এই একই ফরম্যাটে SMS যাবে।
              </p>
            </div>

            <div>
              <Label className="mb-1.5 block">প্রিভিউ (নমুনা তথ্য দিয়ে)</Label>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">{previewText || "—"}</div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>বাতিল</Button>
          <Button onClick={handleSave} disabled={saving || loading}>{saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DirectorResults;
