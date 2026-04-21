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
import type { Course } from "@/types/academic";
import { toast } from "sonner";

export function CoursesTab() {
  const { courses, sessions, addCourse, updateCourse, deleteCourse } = useAcademic();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Course | null>(null);
  const [form, setForm] = useState({ name: "", sessionId: "", duration: 12 });

  const openNew = () => { setEdit(null); setForm({ name: "", sessionId: sessions[0]?.id || "", duration: 12 }); setOpen(true); };
  const openEdit = (c: Course) => { setEdit(c); setForm({ name: c.name, sessionId: c.sessionId, duration: c.duration }); setOpen(true); };

  const submit = () => {
    if (!form.name || !form.sessionId) { toast.error("সব ফিল্ড পূরণ করুন"); return; }
    if (edit) { updateCourse(edit.id, form); toast.success("কোর্স আপডেট"); }
    else { addCourse(form); toast.success("কোর্স যোগ"); }
    setOpen(false);
  };

  const sessionName = (id: string) => sessions.find((s) => s.id === id)?.name || "—";

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">মোট {courses.length}টি কোর্স</p>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন কোর্স</Button>
      </div>
      <Card className="border-none shadow-sm">
        <Table>
          <TableHeader><TableRow><TableHead>নাম</TableHead><TableHead>সেশন</TableHead><TableHead>মেয়াদ</TableHead><TableHead className="w-[120px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
          <TableBody>
            {courses.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">কোনো কোর্স নেই</TableCell></TableRow>
            ) : courses.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{sessionName(c.sessionId)}</TableCell>
                <TableCell>{c.duration} মাস</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { deleteCourse(c.id); toast.success("মুছে ফেলা হয়েছে"); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "কোর্স সম্পাদনা" : "নতুন কোর্স"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="বিজ্ঞান" /></div>
            <div><Label>সেশন *</Label>
              <Select value={form.sessionId} onValueChange={(v) => setForm({ ...form, sessionId: v })}>
                <SelectTrigger><SelectValue placeholder="সেশন নির্বাচন" /></SelectTrigger>
                <SelectContent>{sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div><Label>মেয়াদ (মাস)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) || 0 })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button><Button onClick={submit}>{edit ? "আপডেট" : "যোগ"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
