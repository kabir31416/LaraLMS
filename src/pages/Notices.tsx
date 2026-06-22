import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pin, PinOff, Edit, Trash2 } from "lucide-react";
import { useNotices } from "@/contexts/NoticeContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { NOTICE_TYPE_LABELS, PRIORITY_LABELS, type Notice, type NoticePriority, type NoticeType } from "@/types/notice";
import { format } from "date-fns";
import { toast } from "sonner";

const priorityColor: Record<NoticePriority, string> = {
  Normal: "bg-muted text-foreground",
  Important: "bg-info/10 text-info border-info/20",
  Urgent: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function Notices() {
  const { notices, addNotice, updateNotice, deleteNotice, togglePin } = useNotices();
  const { courses } = useAcademic();
  const { batches } = useBatches();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const blank = {
    title: "", description: "", type: "All" as NoticeType, targetId: "" as string | undefined,
    publishDate: format(new Date(), "yyyy-MM-dd"), expiryDate: "", priority: "Normal" as NoticePriority, pinned: false,
  };
  const [form, setForm] = useState(blank);

  const openCreate = () => { setEditing(null); setForm(blank); setOpen(true); };
  const openEdit = (n: Notice) => {
    setEditing(n);
    setForm({ title: n.title, description: n.description, type: n.type, targetId: n.targetId, publishDate: n.publishDate, expiryDate: n.expiryDate || "", priority: n.priority, pinned: n.pinned });
    setOpen(true);
  };

  const save = () => {
    if (!form.title.trim()) { toast.error("শিরোনাম দিন"); return; }
    const payload = { ...form, expiryDate: form.expiryDate || undefined, targetId: (form.type === "Course" || form.type === "Batch") ? form.targetId : undefined };
    if (editing) { updateNotice(editing.id, payload); toast.success("নোটিশ আপডেট হয়েছে"); }
    else { addNotice(payload); toast.success("নোটিশ তৈরি হয়েছে"); }
    setOpen(false);
  };

  const sorted = [...notices].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.publishDate.localeCompare(a.publishDate);
  });

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">নোটিশ ব্যবস্থাপনা</h1>
            <p className="text-sm text-muted-foreground">শিক্ষার্থী, স্টাফ এবং ডিরেক্টরদের জন্য নোটিশ তৈরি করুন</p>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> নতুন নোটিশ</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.length === 0 ? (
            <Card className="md:col-span-2"><CardContent className="py-10 text-center text-muted-foreground">কোনো নোটিশ নেই</CardContent></Card>
          ) : sorted.map((n) => (
            <Card key={n.id} className={n.pinned ? "border-primary/40" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {n.pinned && <Pin className="h-4 w-4 text-primary" />}
                    {n.title}
                  </CardTitle>
                  <Badge variant="outline" className={priorityColor[n.priority]}>{PRIORITY_LABELS[n.priority]}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{NOTICE_TYPE_LABELS[n.type]}</Badge>
                  <span>প্রকাশ: {n.publishDate}</span>
                  {n.expiryDate && <span>মেয়াদ: {n.expiryDate}</span>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-3 whitespace-pre-wrap">{n.description}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => togglePin(n.id)}>
                    {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(n)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => { deleteNotice(n.id); toast.success("ডিলিট হয়েছে"); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "নোটিশ এডিট করুন" : "নতুন নোটিশ"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>শিরোনাম</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>বিবরণ</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ধরন</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as NoticeType, targetId: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(NOTICE_TYPE_LABELS) as NoticeType[]).map((t) => <SelectItem key={t} value={t}>{NOTICE_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>প্রাধান্য</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as NoticePriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(PRIORITY_LABELS) as NoticePriority[]).map((t) => <SelectItem key={t} value={t}>{PRIORITY_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {form.type === "Course" && (
              <div><Label>কোর্স</Label>
                <Select value={form.targetId || ""} onValueChange={(v) => setForm({ ...form, targetId: v })}>
                  <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.type === "Batch" && (
              <div><Label>ব্যাচ</Label>
                <Select value={form.targetId || ""} onValueChange={(v) => setForm({ ...form, targetId: v })}>
                  <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>প্রকাশ তারিখ</Label><Input type="date" value={form.publishDate} onChange={(e) => setForm({ ...form, publishDate: e.target.value })} /></div>
              <div><Label>মেয়াদ শেষ</Label><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button onClick={save}>সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}