import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import type { Lecture } from "@/types/academic";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

/**
 * Lectures are managed under Course → Subject (Subject/Course Refactor) —
 * each Lecture belongs to one CourseSubject, so the same global Subject's
 * Lectures in two different Courses are completely independent lists.
 * Picking a Course, then one of ITS assigned Subjects, resolves the exact
 * CourseSubject every Lecture below is scoped to.
 */
export function LecturesTab() {
  const { lectures, courses, getSubjectsByCourse, getCourseSubjectId, addLecture, updateLecture, deleteLecture } = useAcademic();
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [subjectId, setSubjectId] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Lecture | null>(null);
  const [form, setForm] = useState({ title: "", lectureNumber: 1, description: "" });

  useEffect(() => {
    if (!courseId && courses[0]) setCourseId(courses[0].id);
  }, [courses, courseId]);

  const courseSubjectOptions = useMemo(() => (courseId ? getSubjectsByCourse(courseId) : []), [courseId, getSubjectsByCourse]);
  useEffect(() => {
    if (subjectId && !courseSubjectOptions.some((s) => s.id === subjectId)) setSubjectId("");
  }, [courseSubjectOptions, subjectId]);

  const courseSubjectId = subjectId ? getCourseSubjectId(courseId, subjectId) : undefined;
  const scopedLectures = courseSubjectId
    ? lectures.filter((l) => l.courseSubjectId === courseSubjectId).sort((a, b) => a.lectureNumber - b.lectureNumber)
    : [];

  const openNew = () => { setEdit(null); setForm({ title: "", lectureNumber: scopedLectures.length + 1, description: "" }); setOpen(true); };
  const openEdit = (l: Lecture) => { setEdit(l); setForm({ title: l.title, lectureNumber: l.lectureNumber, description: l.description || "" }); setOpen(true); };

  const toggleStatus = async (l: Lecture) => {
    try {
      await updateLecture(l.id, { status: l.status === "সক্রিয়" ? "নিষ্ক্রিয়" : "সক্রিয়" });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পরিবর্তন ব্যর্থ হয়েছে");
    }
  };

  const submit = async () => {
    if (!form.title || !courseSubjectId) { toast.error("কোর্স, সাবজেক্ট ও শিরোনাম দিন"); return; }
    try {
      if (edit) { await updateLecture(edit.id, form); toast.success("লেকচার আপডেট"); }
      else { await addLecture({ ...form, courseSubjectId, status: "সক্রিয়" }); toast.success("লেকচার যোগ"); }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLecture(id);
      toast.success("মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "মুছতে ব্যর্থ হয়েছে");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>কোর্স</Label>
          <Select value={courseId} onValueChange={(v) => { setCourseId(v); setSubjectId(""); }}>
            <SelectTrigger><SelectValue placeholder="কোর্স নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>{courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>সাবজেক্ট</Label>
          <Select value={subjectId} onValueChange={setSubjectId} disabled={!courseId || courseSubjectOptions.length === 0}>
            <SelectTrigger><SelectValue placeholder={courseSubjectOptions.length === 0 ? "এই কোর্সে সাবজেক্ট নেই" : "সাবজেক্ট নির্বাচন করুন"} /></SelectTrigger>
            <SelectContent>{courseSubjectOptions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
          </Select>
        </div>
      </div>

      {!courseSubjectId ? (
        <p className="text-sm text-muted-foreground py-6 text-center">লেকচার দেখতে/যোগ করতে প্রথমে একটি কোর্স ও সাবজেক্ট নির্বাচন করুন।</p>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন লেকচার</Button>
          </div>
          <Card className="border-none shadow-sm">
            <Table>
              <TableHeader><TableRow><TableHead className="w-[60px]">নং</TableHead><TableHead>শিরোনাম</TableHead><TableHead>অবস্থা</TableHead><TableHead className="w-[120px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
              <TableBody>
                {scopedLectures.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">কোনো লেকচার নেই</TableCell></TableRow>
                ) : scopedLectures.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.lectureNumber}</TableCell>
                    <TableCell className="font-medium">{l.title}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={l.status === "সক্রিয়"} onCheckedChange={() => toggleStatus(l)} />
                        <Badge variant="outline" className={l.status === "সক্রিয়" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>{l.status}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(l.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "লেকচার সম্পাদনা" : "নতুন লেকচার"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>শিরোনাম *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>লেকচার নং</Label><Input type="number" value={form.lectureNumber} onChange={(e) => setForm({ ...form, lectureNumber: Number(e.target.value) || 1 })} /></div>
            <div><Label>বিবরণ</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button><Button onClick={submit}>{edit ? "আপডেট" : "যোগ"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
