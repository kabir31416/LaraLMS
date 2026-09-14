import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import type { Course, MasterDataStatus } from "@/types/academic";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

interface CoursesTabProps {
  /** Jumps the parent Settings page to the Subjects section, pre-filtered to this course (Settings §4's "open a Course, manage its Subjects" ask). */
  onManageSubjects?: (courseId: string) => void;
}

export function CoursesTab({ onManageSubjects }: CoursesTabProps = {}) {
  const { courses, sessions, subjects, lectures, addCourse, updateCourse, deleteCourse } = useAcademic();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Course | null>(null);
  const [form, setForm] = useState<{ name: string; sessionId: string; duration: number; fee: number; status: MasterDataStatus; displayOrder: number }>(
    { name: "", sessionId: "", duration: 12, fee: 0, status: "সক্রিয়", displayOrder: 0 },
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const openNew = () => { setEdit(null); setForm({ name: "", sessionId: sessions[0]?.id || "", duration: 12, fee: 0, status: "সক্রিয়", displayOrder: 0 }); setOpen(true); };
  const openEdit = (c: Course) => { setEdit(c); setForm({ name: c.name, sessionId: c.sessionId, duration: c.duration, fee: c.fee || 0, status: c.status, displayOrder: c.displayOrder || 0 }); setOpen(true); };

  const toggleStatus = async (c: Course) => {
    try {
      await updateCourse(c.id, { status: c.status === "সক্রিয়" ? "নিষ্ক্রিয়" : "সক্রিয়" });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পরিবর্তন ব্যর্থ হয়েছে");
    }
  };

  const submit = async () => {
    if (!form.name || !form.sessionId) { toast.error("সব ফিল্ড পূরণ করুন"); return; }
    try {
      if (edit) { await updateCourse(edit.id, form); toast.success("কোর্স আপডেট"); }
      else { await addCourse(form); toast.success("কোর্স যোগ"); }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCourse(id);
      toast.success("মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "মুছতে ব্যর্থ হয়েছে");
    }
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
          <TableHeader><TableRow><TableHead className="w-[36px]" /><TableHead>নাম</TableHead><TableHead>সেশন</TableHead><TableHead>মেয়াদ</TableHead><TableHead>কোর্স ফি</TableHead><TableHead>অবস্থা</TableHead><TableHead className="w-[120px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
          <TableBody>
            {courses.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">কোনো কোর্স নেই</TableCell></TableRow>
            ) : courses.map((c) => {
              const courseSubjects = subjects.filter((s) => s.courseId === c.id);
              const isOpen = expanded === c.id;
              return (
                <Fragment key={c.id}>
                  <TableRow>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(isOpen ? null : c.id)}>
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{sessionName(c.sessionId)}</TableCell>
                    <TableCell>{c.duration} মাস</TableCell>
                    <TableCell>৳ {(c.fee || 0).toLocaleString("bn-BD")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={c.status === "সক্রিয়"} onCheckedChange={() => toggleStatus(c)} />
                        <Badge variant="outline" className={c.status === "সক্রিয়" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>{c.status}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell />
                      <TableCell colSpan={6} className="py-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground">এই কোর্সের সাবজেক্ট ({courseSubjects.length}টি)</p>
                          {onManageSubjects && (
                            <Button size="sm" variant="outline" onClick={() => onManageSubjects(c.id)}>সাবজেক্ট ম্যানেজ করুন</Button>
                          )}
                        </div>
                        {courseSubjects.length === 0 ? (
                          <p className="text-sm text-muted-foreground">কোনো সাবজেক্ট যোগ করা হয়নি</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {courseSubjects.map((s) => (
                              <Badge key={s.id} variant="outline" className={s.status === "নিষ্ক্রিয়" ? "text-muted-foreground" : ""}>
                                {s.name} · {lectures.filter((l) => l.subjectId === s.id).length}টি লেকচার
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label>মেয়াদ (মাস)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) || 0 })} /></div>
              <div><Label>কোর্স ফি (৳)</Label><Input type="number" value={form.fee} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) || 0 })} placeholder="15000" /></div>
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
