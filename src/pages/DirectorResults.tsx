import { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { useStudents } from "@/contexts/StudentContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useAttendance } from "@/contexts/AttendanceContext";
import type { AttendanceStatus } from "@/types/attendance";
import { toast } from "@/hooks/use-toast";

/**
 * Result Entry — the single place a Batch Director records both marks and
 * attendance for one Subject/Lecture/Date (Phase 5). There is no separate
 * attendance workflow for directors anymore (see routes.tsx/AppSidebar.tsx —
 * "/director/attendance" now redirects here): saving a result always saves
 * attendance for the same students in the same action.
 */
const DirectorResults = () => {
  const { user } = useAuth();
  const { batches } = useBatches();
  const { students } = useStudents();
  const { courses, subjects, lectures } = useAcademic();
  const { listExams, getResultsByExam, getByBatchDate, submitResult, resendSms } = useAttendance();

  const myBatches = useMemo(
    () => (user ? batches.filter((b) => b.directorId === user.staffId) : []),
    [batches, user],
  );

  const [batchId, setBatchId] = useState<string>(myBatches[0]?.id || "");
  useEffect(() => {
    if (!batchId && myBatches[0]) setBatchId(myBatches[0].id);
  }, [myBatches, batchId]);

  const batch = myBatches.find((b) => b.id === batchId);
  // Batch.courseId is a real Course reference, so this is a direct lookup.
  const batchCourse = useMemo(() => courses.find((c) => c.id === batch?.courseId), [courses, batch]);
  const courseSubjects = useMemo(
    () => (batchCourse ? subjects.filter((s) => s.courseId === batchCourse.id) : []),
    [subjects, batchCourse],
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
  const subjectLectures = useMemo(
    () => lectures.filter((l) => l.subjectId === subjectId).sort((a, b) => a.lectureNumber - b.lectureNumber),
    [lectures, subjectId],
  );

  const [fullMarks, setFullMarks] = useState<number>(50);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const batchStudents = useMemo(() => students.filter((s) => s.batchId === batch?.id), [students, batch]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [existingExamId, setExistingExamId] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ resultsSaved: number; smsSent: number; smsFailed: number; failedStudents: { studentId: string; name: string; roll?: string }[] } | null>(null);

  // Load any already-saved result for this exact batch+subject+lecture+date
  // combination, so reopening it shows previous entries instead of a blank
  // sheet — and re-sending updates that same result rather than creating a
  // duplicate (the backend enforces this too; this is just so the director
  // sees what's already there before they touch anything).
  useEffect(() => {
    setSummary(null);
    if (!batch || !subjectId || !lectureId || !date) {
      setMarks({});
      setAttendance({});
      setExistingExamId(null);
      return;
    }
    let cancelled = false;
    setLoadingExisting(true);
    (async () => {
      try {
        const exams = await listExams({ batchId: batch.id, subjectId, lectureId, date });
        const exam = exams[0];
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
  }, [batch?.id, subjectId, lectureId, date]);

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

  const handleSend = async () => {
    if (!batch || !subjectId || !lectureId) {
      toast({ title: "তথ্য অসম্পূর্ণ", description: "ব্যাচ, সাবজেক্ট ও লেকচার নির্বাচন করুন।" });
      return;
    }
    if (!fullMarks || fullMarks <= 0) {
      toast({ title: "ভুল পূর্ণ মান", description: "পূর্ণ মান শূন্যের বেশি হতে হবে।" });
      return;
    }
    if (batchStudents.length === 0) {
      toast({ title: "কোনো শিক্ষার্থী নেই", description: "এই ব্যাচে কোনো শিক্ষার্থী যুক্ত নেই।" });
      return;
    }

    // Validate before sending anything — Present always needs a valid 0..fullMarks mark.
    for (const s of batchStudents) {
      const status = attendance[s.id] || "Absent";
      if (status !== "Present") continue;
      const raw = marks[s.id];
      const num = raw?.trim() ? Number(raw) : NaN;
      if (raw === undefined || raw.trim() === "" || Number.isNaN(num)) {
        toast({ title: "নম্বর প্রয়োজন", description: `${s.name} উপস্থিত হিসেবে চিহ্নিত কিন্তু নম্বর দেওয়া হয়নি।` });
        return;
      }
      if (num < 0 || num > fullMarks) {
        toast({ title: "ভুল নম্বর", description: `${s.name}-এর নম্বর ০ থেকে ${fullMarks}-এর মধ্যে হতে হবে।` });
        return;
      }
    }

    const items = batchStudents.map((s) => {
      const status: AttendanceStatus = attendance[s.id] || "Absent";
      const raw = marks[s.id];
      const num = status === "Present" && raw?.trim() ? Number(raw) : null;
      return { studentId: s.id, marks: num, attendance: status };
    });

    setSaving(true);
    setSummary(null);
    try {
      const result = await submitResult({ batchId: batch.id, subjectId, lectureId, date, fullMarks, items });
      setExistingExamId(result.examId);
      setSummary(result);
      toast({
        title: "রেজাল্ট সংরক্ষিত হয়েছে",
        description: `সংরক্ষণ: ${result.resultsSaved} জন। SMS পাঠানো হয়েছে: ${result.smsSent} জনকে। ব্যর্থ: ${result.smsFailed} জন।`,
      });
    } catch {
      toast({ title: "ব্যর্থ", description: "রেজাল্ট সংরক্ষণ করা যায়নি" });
    } finally {
      setSaving(false);
    }
  };

  const handleRetrySms = async () => {
    if (!existingExamId || !summary?.failedStudents.length) return;
    setSaving(true);
    try {
      const retry = await resendSms(existingExamId, summary.failedStudents.map((f) => f.studentId));
      setSummary((prev) => (prev ? { ...prev, smsSent: prev.smsSent + retry.smsSent, smsFailed: retry.smsFailed, failedStudents: retry.failedStudents } : prev));
      toast({ title: "পুনরায় পাঠানো হয়েছে", description: `SMS পাঠানো হয়েছে: ${retry.smsSent} জনকে। ব্যর্থ: ${retry.smsFailed} জন।` });
    } catch {
      toast({ title: "ব্যর্থ", description: "SMS পুনরায় পাঠানো যায়নি" });
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== "Batch Director") return <Navigate to="/login" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">রেজাল্ট এন্ট্রি</h1>
          <p className="text-sm text-muted-foreground">এখান থেকেই নম্বর ও উপস্থিতি একসাথে দিন — কোর্স আপনার ব্যাচ থেকে অটো লোড হবে</p>
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
              <Label>লেকচার</Label>
              <Select value={lectureId} onValueChange={setLectureId} disabled={!subjectId || subjectLectures.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={subjectId && subjectLectures.length === 0 ? "লেকচার নেই" : "নির্বাচন"} />
                </SelectTrigger>
                <SelectContent>
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
                <Badge variant="outline" className="text-xs">এই এন্ট্রির আগের রেজাল্ট পাওয়া গেছে — নিচে দেখানো হচ্ছে, নতুন করে পাঠালে তা হালনাগাদ হবে</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-base">শিক্ষার্থী তালিকা ({batchStudents.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>রোল</TableHead>
                    <TableHead>নাম</TableHead>
                    <TableHead className="w-[120px]">নম্বর</TableHead>
                    <TableHead className="w-[160px] text-center">উপস্থিতি</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingExisting ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</TableCell></TableRow>
                  ) : batchStudents.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">কোনো শিক্ষার্থী নেই</TableCell></TableRow>
                  ) : batchStudents.map((s) => {
                    const status: AttendanceStatus = attendance[s.id] || "Absent";
                    const isPresent = status === "Present";
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.rollNumber || "—"}</TableCell>
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
            <div className="flex justify-end mt-4">
              <Button onClick={handleSend} disabled={saving || loadingExisting} size="lg">
                {saving ? "পাঠানো হচ্ছে..." : "Send Result"}
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
                    যাদের SMS পাঠানো যায়নি: {summary.failedStudents.map((f) => `${f.name}${f.roll ? ` (রোল ${f.roll})` : ""}`).join(", ")}
                  </p>
                  <Button variant="outline" size="sm" onClick={handleRetrySms} disabled={saving}>
                    ব্যর্থ SMS আবার পাঠান
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DirectorResults;
