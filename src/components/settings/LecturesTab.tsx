import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import type { Lecture } from "@/types/academic";
import { toast } from "sonner";

export function LecturesTab() {
  const { lectures, subjects, courses, addLecture, updateLecture, deleteLecture } = useAcademic();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Lecture | null>(null);
  const [form, setForm] = useState({ title: "", subjectId: "", lectureNumber: 1, description: "" });
  const [filterSubject, setFilterSubject] = useState("all");

  const openNew = () => { setEdit(null); setForm({ title: "", subjectId: subjects[0]?.id || "", lectureNumber: lectures.length + 1, description: "" }); setOpen(true); };
  const openEdit = (l: Lecture) => { setEdit(l); setForm({ title: l.title, subjectId: l.subjectId, lectureNumber: l.lectureNumber, description: l.description || "" }); setOpen(true); };

  const submit = () => {
    if (!form.title || !form.subjectId) { toast.error("সব ফিল্ড পূরণ করুন"); return; }
    if (edit) { updateLecture(edit.id, form); toast.success("লেকচার আপডেট"); }
    else { addLecture(form); toast.success("লেকচার যোগ"); }
    setOpen(false);
  };

  const subjectName = (id: string) => {
    const s = subjects.find((x) => x.id === id);
    if (!s) return "—";
    const c = courses.find((c) => c.id === s.courseId);
    return `${s.name} (${c?.name || ""})`;
  };
  const filtered = filterSubject === "all" ? lectures : lectures.filter((l) => l.subjectId === filterSubject);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল সাবজেক্ট</SelectItem>
            {subjects.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন লেকচার</Button>
      </div>
      <Card className="border-none shadow-sm">
        <Table>
          <TableHeader><TableRow><TableHead className="w-[60px]">নং</TableHead><TableHead>শিরোনাম</TableHead><TableHead>সাবজেক্ট</TableHead><TableHead className="w-[120px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">কোনো লেকচার নেই</TableCell></TableRow>
            ) : filtered.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">{l.lectureNumber}</TableCell>
                <TableCell className="font-medium">{l.title}</TableCell>
                <TableCell className="text-sm">{subjectName(l.subjectId)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { deleteLecture(l.id); toast.success("মুছে ফেলা হয়েছে"); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "লেকচার সম্পাদনা" : "নতুন লেকচার"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>শিরোনাম *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>সাবজেক্ট *</Label>
                <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                  <SelectTrigger><SelectValue placeholder="সাবজেক্ট নির্বাচন" /></SelectTrigger>
                  <SelectContent>{subjects.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div><Label>লেকচার নং</Label><Input type="number" value={form.lectureNumber} onChange={(e) => setForm({ ...form, lectureNumber: Number(e.target.value) || 1 })} /></div>
            </div>
            <div><Label>বিবরণ</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button><Button onClick={submit}>{edit ? "আপডেট" : "যোগ"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
