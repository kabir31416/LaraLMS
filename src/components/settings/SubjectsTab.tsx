import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import type { Subject } from "@/types/academic";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

export function SubjectsTab() {
  const { subjects, courses, addSubject, updateSubject, deleteSubject } = useAcademic();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: "", courseId: "" });
  const [filterCourse, setFilterCourse] = useState("all");

  const openNew = () => { setEdit(null); setForm({ name: "", courseId: courses[0]?.id || "" }); setOpen(true); };
  const openEdit = (s: Subject) => { setEdit(s); setForm({ name: s.name, courseId: s.courseId }); setOpen(true); };

  const submit = async () => {
    if (!form.name || !form.courseId) { toast.error("সব ফিল্ড পূরণ করুন"); return; }
    try {
      if (edit) { await updateSubject(edit.id, form); toast.success("সাবজেক্ট আপডেট"); }
      else { await addSubject(form); toast.success("সাবজেক্ট যোগ"); }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSubject(id);
      toast.success("মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "মুছতে ব্যর্থ হয়েছে");
    }
  };

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name || "—";
  const filtered = filterCourse === "all" ? subjects : subjects.filter((s) => s.courseId === filterCourse);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <Select value={filterCourse} onValueChange={setFilterCourse}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল কোর্স</SelectItem>
            {courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন সাবজেক্ট</Button>
      </div>
      <Card className="border-none shadow-sm">
        <Table>
          <TableHeader><TableRow><TableHead>নাম</TableHead><TableHead>কোর্স</TableHead><TableHead className="w-[120px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-10">কোনো সাবজেক্ট নেই</TableCell></TableRow>
            ) : filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{courseName(s.courseId)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "সাবজেক্ট সম্পাদনা" : "নতুন সাবজেক্ট"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="পদার্থবিজ্ঞান" /></div>
            <div><Label>কোর্স *</Label>
              <Select value={form.courseId} onValueChange={(v) => setForm({ ...form, courseId: v })}>
                <SelectTrigger><SelectValue placeholder="কোর্স নির্বাচন" /></SelectTrigger>
                <SelectContent>{courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button><Button onClick={submit}>{edit ? "আপডেট" : "যোগ"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
