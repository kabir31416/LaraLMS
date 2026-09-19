import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import type { ClassExam, ClassExamType } from "@/types/academic";
import { toast } from "sonner";

export function ClassExamsTab() {
  const { classExams, lectures, addClassExam, updateClassExam, deleteClassExam, settings, getSubjectForCourseSubject } = useAcademic();
  const { batches } = useBatches();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ClassExam | null>(null);
  const [form, setForm] = useState({
    type: "Class" as ClassExamType, lectureId: "", title: "", date: "", time: "",
    duration: settings.defaultExamDuration, totalMarks: 100, passMarks: 33, batchId: "",
  });

  const openNew = () => {
    setEdit(null);
    setForm({ type: "Class", lectureId: lectures[0]?.id || "", title: "", date: "", time: "", duration: settings.defaultExamDuration, totalMarks: 100, passMarks: Math.round(settings.passingPercentage), batchId: "" });
    setOpen(true);
  };
  const openEdit = (c: ClassExam) => {
    setEdit(c);
    setForm({ type: c.type, lectureId: c.lectureId, title: c.title, date: c.date, time: c.time, duration: c.duration, totalMarks: c.totalMarks || 100, passMarks: c.passMarks || 33, batchId: c.batchId || "" });
    setOpen(true);
  };

  const submit = () => {
    if (!form.title || !form.lectureId || !form.date) { toast.error("সব ফিল্ড পূরণ করুন"); return; }
    const payload: Omit<ClassExam, "id"> = {
      type: form.type, lectureId: form.lectureId, title: form.title,
      date: form.date, time: form.time, duration: form.duration,
      ...(form.type === "Exam" ? {
        totalMarks: form.totalMarks, passMarks: form.passMarks, status: "Open" as const,
        batchId: form.batchId || undefined, questions: edit?.questions || [],
      } : {}),
    };
    if (edit) { updateClassExam(edit.id, payload); toast.success("আপডেট"); }
    else { addClassExam(payload); toast.success("যোগ"); }
    setOpen(false);
  };

  const lecName = (id: string) => {
    const l = lectures.find((x) => x.id === id);
    if (!l) return "—";
    const s = getSubjectForCourseSubject(l.courseSubjectId);
    return `${l.title} (${s?.name || ""})`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">মোট {classExams.length}টি ক্লাস/এক্সাম</p>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন ক্লাস/এক্সাম</Button>
      </div>
      <Card className="border-none shadow-sm">
        <Table>
          <TableHeader><TableRow><TableHead>ধরন</TableHead><TableHead>শিরোনাম</TableHead><TableHead>লেকচার</TableHead><TableHead>তারিখ</TableHead><TableHead>সময়</TableHead><TableHead className="w-[120px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
          <TableBody>
            {classExams.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">কোনো এন্ট্রি নেই</TableCell></TableRow>
            ) : classExams.map((c) => (
              <TableRow key={c.id}>
                <TableCell><Badge variant={c.type === "Exam" ? "default" : "outline"}>{c.type === "Exam" ? "এক্সাম" : "ক্লাস"}</Badge></TableCell>
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell className="text-sm">{lecName(c.lectureId)}</TableCell>
                <TableCell>{c.date}</TableCell>
                <TableCell>{c.time}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { deleteClassExam(c.id); toast.success("মুছে ফেলা হয়েছে"); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{edit ? "সম্পাদনা" : "নতুন ক্লাস/এক্সাম"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div><Label>ধরন</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ClassExamType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Class">ক্লাস</SelectItem><SelectItem value="Exam">এক্সাম</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>লেকচার *</Label>
              <Select value={form.lectureId} onValueChange={(v) => setForm({ ...form, lectureId: v })}>
                <SelectTrigger><SelectValue placeholder="লেকচার নির্বাচন" /></SelectTrigger>
                <SelectContent>{lectures.map((l) => (<SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>শিরোনাম *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>তারিখ *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>সময়</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
            <div><Label>সময়কাল (মিনিট)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) || 0 })} /></div>
            {form.type === "Exam" && (
              <>
                <div><Label>মোট নম্বর</Label><Input type="number" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: Number(e.target.value) || 0 })} /></div>
                <div><Label>পাস নম্বর</Label><Input type="number" value={form.passMarks} onChange={(e) => setForm({ ...form, passMarks: Number(e.target.value) || 0 })} /></div>
                <div className="col-span-2"><Label>ব্যাচ (ঐচ্ছিক)</Label>
                  <Select value={form.batchId || "none"} onValueChange={(v) => setForm({ ...form, batchId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— সকল ব্যাচ —</SelectItem>
                      {batches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3"><Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button><Button onClick={submit}>{edit ? "আপডেট" : "যোগ"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
