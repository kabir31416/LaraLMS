import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Video, ExternalLink, Pencil } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { useAuth } from "@/contexts/AuthContext";
import type { VideoClass } from "@/types/academic";
import { toast } from "sonner";

function ytId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v");
  } catch { return null; }
}

export default function VideoClasses() {
  const { user } = useAuth();
  const { courses, getSubjectsByCourse, getLecturesBySubject, lectures: allLectures, videos, addVideo, updateVideo, deleteVideo } = useAcademic();
  const { batches } = useBatches();
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [lectureId, setLectureId] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<VideoClass | null>(null);
  const [form, setForm] = useState({ title: "", youtubeLink: "", description: "", duration: "", lectureId: "", batchId: "" });

  const subjects = courseId ? getSubjectsByCourse(courseId) : [];
  const lectures = subjectId ? getLecturesBySubject(subjectId) : [];

  const visible = useMemo(() => {
    let list = videos;
    if (lectureId) list = list.filter((v) => v.lectureId === lectureId);
    else if (subjectId) {
      const lecIds = new Set(lectures.map((l) => l.id));
      list = list.filter((v) => lecIds.has(v.lectureId));
    }
    if (user?.role === "Batch Director") {
      const ids = new Set(batches.filter((b) => b.directorId === user.staffId).map((b) => b.id));
      list = list.filter((v) => !v.batchId || ids.has(v.batchId));
    }
    return list;
  }, [videos, lectureId, subjectId, lectures, user, batches]);

  const openNew = () => {
    setEdit(null);
    setForm({ title: "", youtubeLink: "", description: "", duration: "", lectureId: lectureId || "", batchId: "" });
    setOpen(true);
  };
  const openEdit = (v: VideoClass) => {
    setEdit(v);
    setForm({ title: v.title, youtubeLink: v.youtubeLink, description: v.description || "", duration: v.duration, lectureId: v.lectureId, batchId: v.batchId || "" });
    setOpen(true);
  };

  const submit = () => {
    if (!form.title || !form.youtubeLink || !form.lectureId) { toast.error("শিরোনাম, লিংক, লেকচার প্রয়োজন"); return; }
    const payload = { ...form, batchId: form.batchId || undefined };
    if (edit) { updateVideo(edit.id, payload); toast.success("আপডেট"); }
    else { addVideo(payload); toast.success("ভিডিও যোগ"); }
    setOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ভিডিও ক্লাস</h1>
            <p className="text-sm text-muted-foreground">কোর্স → সাবজেক্ট → লেকচার অনুযায়ী ভিডিও</p>
          </div>
          {user?.role === "Admin" && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন ভিডিও</Button>}
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label className="text-xs">কোর্স</Label>
              <Select value={courseId} onValueChange={(v) => { setCourseId(v); setSubjectId(""); setLectureId(""); }}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                <SelectContent>{courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">সাবজেক্ট</Label>
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setLectureId(""); }} disabled={!courseId}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                <SelectContent>{subjects.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">লেকচার</Label>
              <Select value={lectureId} onValueChange={setLectureId} disabled={!subjectId}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                <SelectContent>{lectures.map((l) => (<SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {visible.length === 0 ? (
          <Card className="border-none shadow-sm"><CardContent className="py-16 text-center text-muted-foreground"><Video className="mx-auto h-10 w-10 mb-2 opacity-50" />কোনো ভিডিও পাওয়া যায়নি</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((v) => {
              const id = ytId(v.youtubeLink);
              return (
                <Card key={v.id} className="border-none shadow-sm overflow-hidden">
                  <div className="aspect-video bg-muted relative">
                    {id ? (
                      <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${id}`} title={v.title} allowFullScreen />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground"><Video className="h-10 w-10" /></div>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm line-clamp-2">{v.title}</p>
                      {v.duration && <Badge variant="outline" className="shrink-0">{v.duration}</Badge>}
                    </div>
                    {v.description && <p className="text-xs text-muted-foreground line-clamp-2">{v.description}</p>}
                    <div className="flex items-center justify-between pt-1">
                      <a href={v.youtubeLink} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> YouTube</a>
                      {user?.role === "Admin" && (
                        <div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { deleteVideo(v.id); toast.success("মুছে ফেলা হয়েছে"); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{edit ? "ভিডিও সম্পাদনা" : "নতুন ভিডিও ক্লাস"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>শিরোনাম *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>YouTube লিংক *</Label><Input value={form.youtubeLink} onChange={(e) => setForm({ ...form, youtubeLink: e.target.value })} placeholder="https://youtube.com/watch?v=..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>লেকচার *</Label>
                <Select value={form.lectureId} onValueChange={(v) => setForm({ ...form, lectureId: v })}>
                  <SelectTrigger><SelectValue placeholder="লেকচার" /></SelectTrigger>
                  <SelectContent>{allLectures.map((l) => (<SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div><Label>সময়কাল</Label><Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="৪৫ মিনিট" /></div>
            </div>
            <div><Label>ব্যাচ (ঐচ্ছিক)</Label>
              <Select value={form.batchId || "none"} onValueChange={(v) => setForm({ ...form, batchId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— সকল ব্যাচ —</SelectItem>
                  {batches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>বিবরণ</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button><Button onClick={submit}>{edit ? "আপডেট" : "যোগ"}</Button></div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
