import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Eye, FileSpreadsheet, Plus, Trash2, Upload, Lock, Unlock, Pencil } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { useAuth } from "@/contexts/AuthContext";
import type { ClassExam, Question } from "@/types/academic";
import { toast } from "sonner";

export default function Exams() {
  const { user } = useAuth();
  const {
    courses, getSubjectsByCourse, getLecturesBySubject, classExams, addClassExam,
    updateClassExam, deleteClassExam, addQuestions, deleteQuestion, settings,
  } = useAcademic();
  const { batches } = useBatches();

  // Director restriction: only see own batches' exams
  const visibleExams = useMemo(() => {
    const exams = classExams.filter((c) => c.type === "Exam");
    if (user?.role === "Batch Director") {
      const ids = new Set(batches.filter((b) => b.directorIds?.includes(user.staffId)).map((b) => b.id));
      return exams.filter((e) => !e.batchId || ids.has(e.batchId));
    }
    return exams;
  }, [classExams, batches, user]);

  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [lectureId, setLectureId] = useState("");
  const [openExam, setOpenExam] = useState<ClassExam | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editExam, setEditExam] = useState<ClassExam | null>(null);

  const subjects = courseId ? getSubjectsByCourse(courseId) : [];
  const lectures = courseId && subjectId ? getLecturesBySubject(courseId, subjectId) : [];

  const filteredExams = useMemo(() => {
    return visibleExams.filter((e) => {
      if (!lectureId) return true;
      return e.lectureId === lectureId;
    }).filter((e) => {
      if (!subjectId) return true;
      const lec = lectures.find((l) => l.id === e.lectureId);
      return !!lec || lectureId === "";
    });
  }, [visibleExams, lectureId, subjectId, lectures]);

  if (openExam) {
    return <ExamDetail exam={openExam} onBack={() => setOpenExam(null)} />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">এক্সাম</h1>
            <p className="text-sm text-muted-foreground">কোর্স → সাবজেক্ট → লেকচার → এক্সাম</p>
          </div>
          {user?.role === "Admin" && (
            <Button onClick={() => { setEditExam(null); setOpenForm(true); }}>
              <Plus className="mr-2 h-4 w-4" /> নতুন এক্সাম
            </Button>
          )}
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">কোর্স</Label>
              <Select value={courseId} onValueChange={(v) => { setCourseId(v); setSubjectId(""); setLectureId(""); }}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                <SelectContent>{courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">সাবজেক্ট</Label>
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setLectureId(""); }} disabled={!courseId}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                <SelectContent>{subjects.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">লেকচার</Label>
              <Select value={lectureId} onValueChange={setLectureId} disabled={!subjectId}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                <SelectContent>{lectures.map((l) => (<SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <Table>
            <TableHeader><TableRow><TableHead>শিরোনাম</TableHead><TableHead>তারিখ</TableHead><TableHead>সময়</TableHead><TableHead>মোট/পাস</TableHead><TableHead>প্রশ্ন</TableHead><TableHead>স্ট্যাটাস</TableHead><TableHead className="w-[160px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredExams.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">কোনো এক্সাম পাওয়া যায়নি</TableCell></TableRow>
              ) : filteredExams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell>{e.date}</TableCell>
                  <TableCell>{e.duration} মিনিট</TableCell>
                  <TableCell>{e.totalMarks}/{e.passMarks}</TableCell>
                  <TableCell><Badge variant="outline">{e.questions?.length || 0}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={e.status === "Locked" ? "destructive" : "default"}>
                      {e.status === "Locked" ? "লক" : "ওপেন"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpenExam(e)}><Eye className="h-4 w-4" /></Button>
                    {user?.role === "Admin" && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateClassExam(e.id, { status: e.status === "Locked" ? "Open" : "Locked" })}>
                          {e.status === "Locked" ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditExam(e); setOpenForm(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { deleteClassExam(e.id); toast.success("মুছে ফেলা হয়েছে"); }}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <ExamForm open={openForm} onOpenChange={setOpenForm} editExam={editExam} />
    </DashboardLayout>
  );
}

function ExamForm({ open, onOpenChange, editExam }: { open: boolean; onOpenChange: (v: boolean) => void; editExam: ClassExam | null }) {
  const { courses, getSubjectsByCourse, getLecturesBySubject, getLecture, getCourseSubject, addClassExam, updateClassExam, settings } = useAcademic();
  const { batches } = useBatches();

  const initialCourseSubject = (() => {
    if (!editExam) return undefined;
    const lec = getLecture(editExam.lectureId);
    return lec ? getCourseSubject(lec.courseSubjectId) : undefined;
  })();
  const initialCourse = initialCourseSubject?.courseId || "";
  const initialSubject = initialCourseSubject?.subjectId || "";

  const [courseId, setCourseId] = useState(initialCourse);
  const [subjectId, setSubjectId] = useState(initialSubject);
  const [form, setForm] = useState({
    title: editExam?.title || "",
    lectureId: editExam?.lectureId || "",
    date: editExam?.date || "",
    time: editExam?.time || "",
    duration: editExam?.duration || settings.defaultExamDuration,
    totalMarks: editExam?.totalMarks || 100,
    passMarks: editExam?.passMarks || Math.round(settings.passingPercentage),
    batchId: editExam?.batchId || "",
  });

  const subjects = courseId ? getSubjectsByCourse(courseId) : [];
  const lectures = courseId && subjectId ? getLecturesBySubject(courseId, subjectId) : [];

  const submit = () => {
    if (!form.title || !form.lectureId || !form.date) { toast.error("সব ফিল্ড পূরণ করুন"); return; }
    const payload = {
      type: "Exam" as const,
      lectureId: form.lectureId,
      title: form.title,
      date: form.date,
      time: form.time,
      duration: form.duration,
      totalMarks: form.totalMarks,
      passMarks: form.passMarks,
      status: editExam?.status || ("Open" as const),
      batchId: form.batchId || undefined,
      questions: editExam?.questions || [],
    };
    if (editExam) { updateClassExam(editExam.id, payload); toast.success("আপডেট"); }
    else { addClassExam(payload); toast.success("এক্সাম যোগ"); }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editExam ? "এক্সাম সম্পাদনা" : "নতুন এক্সাম"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div><Label>কোর্স *</Label>
            <Select value={courseId} onValueChange={(v) => { setCourseId(v); setSubjectId(""); setForm({ ...form, lectureId: "" }); }}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
              <SelectContent>{courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div><Label>সাবজেক্ট *</Label>
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setForm({ ...form, lectureId: "" }); }} disabled={!courseId}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
              <SelectContent>{subjects.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>লেকচার *</Label>
            <Select value={form.lectureId} onValueChange={(v) => setForm({ ...form, lectureId: v })} disabled={!subjectId}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
              <SelectContent>{lectures.map((l) => (<SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>এক্সাম শিরোনাম *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>তারিখ *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>সময়</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          <div><Label>সময়কাল (মিনিট)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) || 0 })} /></div>
          <div><Label>মোট নম্বর</Label><Input type="number" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: Number(e.target.value) || 0 })} /></div>
          <div><Label>পাস নম্বর</Label><Input type="number" value={form.passMarks} onChange={(e) => setForm({ ...form, passMarks: Number(e.target.value) || 0 })} /></div>
          <div><Label>ব্যাচ (ঐচ্ছিক)</Label>
            <Select value={form.batchId || "none"} onValueChange={(v) => setForm({ ...form, batchId: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— সকল ব্যাচ —</SelectItem>
                {batches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-3"><Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button><Button onClick={submit}>{editExam ? "আপডেট" : "তৈরি"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function ExamDetail({ exam, onBack }: { exam: ClassExam; onBack: () => void }) {
  const { addQuestions, deleteQuestion, classExams } = useAcademic();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Always use latest version
  const live = classExams.find((c) => c.id === exam.id) || exam;
  const questions = live.questions || [];

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed: Omit<Question, "id">[] = [];
      for (const r of rows) {
        const get = (keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(r).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
            if (found && r[found] != null && String(r[found]).trim() !== "") return String(r[found]).trim();
          }
          return "";
        };
        const text = get(["Question", "প্রশ্ন"]);
        const a = get(["Option A", "OptionA", "A"]);
        const b = get(["Option B", "OptionB", "B"]);
        const c = get(["Option C", "OptionC", "C"]);
        const d = get(["Option D", "OptionD", "D"]);
        const correctRaw = get(["Correct Answer", "Correct", "Answer", "সঠিক উত্তর"]).toUpperCase();
        const correct = (["A", "B", "C", "D"] as const).find((x) => correctRaw.startsWith(x));
        if (!text || !a || !b || !correct) continue;
        parsed.push({ text, optionA: a, optionB: b, optionC: c, optionD: d, correct });
      }
      if (parsed.length === 0) {
        toast.error("কোনো বৈধ প্রশ্ন পাওয়া যায়নি। কলাম: Question, Option A, Option B, Option C, Option D, Correct Answer");
        return;
      }
      addQuestions(exam.id, parsed);
      toast.success(`${parsed.length}টি প্রশ্ন যোগ হয়েছে`);
    } catch (err) {
      console.error(err);
      toast.error("ফাইল পড়তে ব্যর্থ");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{live.title}</h1>
            <p className="text-sm text-muted-foreground">{live.date} · {live.duration} মিনিট · মোট {live.totalMarks} · পাস {live.passMarks}</p>
          </div>
          <Button variant="outline" onClick={() => setPreviewOpen(true)}><Eye className="mr-2 h-4 w-4" /> প্রিভিউ</Button>
          {user?.role === "Admin" && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              <Button onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Excel আপলোড</Button>
            </>
          )}
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">প্রশ্নসমূহ ({questions.length})</CardTitle>
            <a className="text-xs text-primary underline" href="#" onClick={(e) => { e.preventDefault(); downloadTemplate(); }}>
              <FileSpreadsheet className="inline h-3 w-3 mr-1" /> টেমপ্লেট ডাউনলোড
            </a>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">কোনো প্রশ্ন নেই। Excel আপলোড করুন।</div>
            ) : (
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <Card key={q.id} className="p-4 bg-muted/30">
                    <div className="flex justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium mb-2">{i + 1}. {q.text}</p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                          {(["A", "B", "C", "D"] as const).map((k) => {
                            const v = ({ A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD })[k];
                            if (!v) return null;
                            return <li key={k} className={q.correct === k ? "text-primary font-medium" : ""}>{k}. {v}</li>;
                          })}
                        </ul>
                      </div>
                      {user?.role === "Admin" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { deleteQuestion(exam.id, q.id); toast.success("মুছে ফেলা হয়েছে"); }}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{live.title} — প্রিভিউ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={q.id} className="border rounded-lg p-3">
                <p className="font-medium mb-2">{i + 1}. {q.text}</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                  <li>A. {q.optionA}</li><li>B. {q.optionB}</li>
                  {q.optionC && <li>C. {q.optionC}</li>}{q.optionD && <li>D. {q.optionD}</li>}
                </ul>
              </div>
            ))}
            {questions.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">কোনো প্রশ্ন নেই</p>}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function downloadTemplate() {
  const data = [
    { Question: "পদার্থের প্রধান অবস্থা কয়টি?", "Option A": "২", "Option B": "৩", "Option C": "৪", "Option D": "৫", "Correct Answer": "B" },
    { Question: "জলের রাসায়নিক সংকেত কী?", "Option A": "H2O", "Option B": "CO2", "Option C": "O2", "Option D": "HO", "Correct Answer": "A" },
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Questions");
  XLSX.writeFile(wb, "exam-questions-template.xlsx");
}
