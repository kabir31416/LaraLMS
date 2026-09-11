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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { useStudents } from "@/contexts/StudentContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useAttendance } from "@/contexts/AttendanceContext";
import { toast } from "@/hooks/use-toast";

const DirectorResults = () => {
  const { user } = useAuth();
  const { batches } = useBatches();
  const { students } = useStudents();
  const { courses, subjects, lectures } = useAcademic();
  const { addExam, saveResults, saveAttendance } = useAttendance();

  const myBatches = useMemo(
    () => (user ? batches.filter((b) => b.directorId === user.staffId) : []),
    [batches, user],
  );

  const [batchId, setBatchId] = useState<string>(myBatches[0]?.id || "");
  useEffect(() => {
    if (!batchId && myBatches[0]) setBatchId(myBatches[0].id);
  }, [myBatches, batchId]);

  const batch = myBatches.find((b) => b.id === batchId);
  // Batch.course may hold either the course id or the course name — match both,
  // so the subject list always stays in sync with একাডেমিক সেটিংস.
  const batchCourse = useMemo(() => {
    if (!batch?.course) return undefined;
    const key = String(batch.course).trim().toLowerCase();
    return courses.find((c) => c.id === batch.course) || courses.find((c) => c.name.trim().toLowerCase() === key);
  }, [courses, batch]);
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



  const [title, setTitle] = useState("");
  const [fullMarks, setFullMarks] = useState<number>(50);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const batchStudents = students.filter((s) => batch?.studentIds.includes(s.id));
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState<Record<string, "Present" | "Absent">>({});

  // Auto: marks entered → Present
  const handleMarks = (sid: string, val: string) => {
    setMarks((p) => ({ ...p, [sid]: val }));
    setAttendance((p) => ({ ...p, [sid]: val.trim() ? "Present" : "Absent" }));
  };

  const handleSave = () => {
    if (!batch || !subjectId || !lectureId || !title.trim()) {
      toast({ title: "তথ্য অসম্পূর্ণ", description: "ব্যাচ, সাবজেক্ট, লেকচার ও এক্সাম শিরোনাম দিন।" });
      return;
    }
    const exam = addExam({ batchId: batch.id, subjectId, lectureId, title, fullMarks, date });
    saveResults(
      exam.id,
      batchStudents.map((s) => ({
        studentId: s.id,
        marks: marks[s.id]?.trim() ? Number(marks[s.id]) : null,
      })),
    );
    saveAttendance(
      batch.id,
      date,
      batchStudents.map((s) => ({ studentId: s.id, status: attendance[s.id] || "Absent" })),
      "Exam",
      exam.id,
    );
    toast({ title: "সংরক্ষিত", description: `${batchStudents.length} জনের রেজাল্ট ও উপস্থিতি সেভ হয়েছে।` });
    setMarks({}); setAttendance({}); setTitle("");
  };

  if (!user || user.role !== "Batch Director") return <Navigate to="/login" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">রেজাল্ট এন্ট্রি (অফলাইন এক্সাম)</h1>
          <p className="text-sm text-muted-foreground">কোর্স আপনার ব্যাচ থেকে অটো লোড হবে</p>
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
              <Input value={batch?.course || "—"} disabled />
            </div>
            <div>
              <Label>সাবজেক্ট</Label>
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setLectureId(""); }}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                <SelectContent>
                  {courseSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>লেকচার</Label>
              <Select value={lectureId} onValueChange={setLectureId}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                <SelectContent>
                  {subjectLectures.map((l) => <SelectItem key={l.id} value={l.id}>{l.lectureNumber}. {l.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>এক্সাম শিরোনাম</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="সাপ্তাহিক টেস্ট" />
            </div>
            <div>
              <Label>পূর্ণ মান</Label>
              <Input type="number" value={fullMarks} onChange={(e) => setFullMarks(Number(e.target.value))} />
            </div>
            <div>
              <Label>তারিখ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-base">শিক্ষার্থী তালিকা ({batchStudents.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>আইডি</TableHead>
                  <TableHead>নাম</TableHead>
                  <TableHead className="w-[140px]">প্রাপ্ত নম্বর</TableHead>
                  <TableHead className="w-[140px]">উপস্থিতি</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">কোনো শিক্ষার্থী নেই</TableCell></TableRow>
                ) : batchStudents.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.studentId}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Input type="number" max={fullMarks} value={marks[s.id] || ""} onChange={(e) => handleMarks(s.id, e.target.value)} placeholder="—" />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={attendance[s.id] || "Absent"}
                        onValueChange={(v: "Present" | "Absent") => setAttendance((p) => ({ ...p, [s.id]: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Present">উপস্থিত</SelectItem>
                          <SelectItem value="Absent">অনুপস্থিত</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave}>সংরক্ষণ করুন</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DirectorResults;