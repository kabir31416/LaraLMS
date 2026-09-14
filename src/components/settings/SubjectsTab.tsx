import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import type { MasterDataStatus, Subject } from "@/types/academic";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

interface SubjectsTabProps {
  /** Pre-selects the course filter — set when Admin jumps here from a Course row's "সাবজেক্ট ম্যানেজ করুন" button. */
  initialCourseFilter?: string;
}

export function SubjectsTab({ initialCourseFilter }: SubjectsTabProps = {}) {
  const { subjects, courses, addSubject, updateSubject, deleteSubject } = useAcademic();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Subject | null>(null);
  const [form, setForm] = useState<{ name: string; courseId: string; status: MasterDataStatus; displayOrder: number }>({ name: "", courseId: "", status: "সক্রিয়", displayOrder: 0 });
  const [filterCourse, setFilterCourse] = useState(initialCourseFilter || "all");

  useEffect(() => {
    if (initialCourseFilter) setFilterCourse(initialCourseFilter);
  }, [initialCourseFilter]);

  const openNew = () => { setEdit(null); setForm({ name: "", courseId: (filterCourse !== "all" ? filterCourse : courses[0]?.id) || "", status: "সক্রিয়", displayOrder: 0 }); setOpen(true); };
  const openEdit = (s: Subject) => { setEdit(s); setForm({ name: s.name, courseId: s.courseId, status: s.status, displayOrder: s.displayOrder || 0 }); setOpen(true); };

  const toggleStatus = async (s: Subject) => {
    try {
      await updateSubject(s.id, { status: s.status === "সক্রিয়" ? "নিষ্ক্রিয়" : "সক্রিয়" });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পরিবর্তন ব্যর্থ হয়েছে");
    }
  };

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
          <TableHeader><TableRow><TableHead>নাম</TableHead><TableHead>কোর্স</TableHead><TableHead>ক্রম</TableHead><TableHead>অবস্থা</TableHead><TableHead className="w-[120px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">কোনো সাবজেক্ট নেই</TableCell></TableRow>
            ) : filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{courseName(s.courseId)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{s.displayOrder ?? 0}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.status === "সক্রিয়"} onCheckedChange={() => toggleStatus(s)} />
                    <Badge variant="outline" className={s.status === "সক্রিয়" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>{s.status}</Badge>
                  </div>
                </TableCell>
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
            <div><Label>প্রদর্শন ক্রম</Label><Input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) || 0 })} /></div>
            <div className="flex items-center justify-between border rounded-lg p-3">
              <p className="text-sm font-medium">সক্রিয়</p>
              <Switch checked={form.status === "সক্রিয়"} onCheckedChange={(v) => setForm({ ...form, status: v ? "সক্রিয়" : "নিষ্ক্রিয়" })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button><Button onClick={submit}>{edit ? "আপডেট" : "যোগ"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
