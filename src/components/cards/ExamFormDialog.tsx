import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Info, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelect } from "@/components/common/SearchSelect";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { cn } from "@/lib/utils";
import { EXAM_TYPES, EXAM_TYPE_LABEL, formatDuration, type ExamSchedule, type ExamType } from "@/types/cards";

interface Form {
  name: string;
  examType: ExamType | "";
  courseId: string;
  batchId: string;
  allowCrossBatch: boolean;
  sessionId: string;
  subjectId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: string;
  venue: string;
  instructions: string;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Create / edit a scheduled exam. Course & batch are locked once students are assigned (the server enforces the same). */
export function ExamFormDialog({ open, onOpenChange, exam, assignedCount = 0, generatedCount = 0, defaultInstructions, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  exam?: ExamSchedule | null;
  assignedCount?: number;
  generatedCount?: number;
  defaultInstructions: string;
  onSaved: (e: ExamSchedule) => void;
}) {
  const { activeCourses, activeSessions, getSubjectsByCourse, getCourse } = useAcademic();
  const { batches } = useBatches();
  const blank: Form = { name: "", examType: "", courseId: "", batchId: "", allowCrossBatch: false, sessionId: "", subjectId: "", date: "", startTime: "", endTime: "", durationMinutes: "", venue: "", instructions: defaultInstructions };
  const [f, setF] = useState<Form>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState<"draft" | "published" | "save" | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF(exam ? {
      name: exam.name, examType: exam.examType, courseId: exam.course?.id ?? "", batchId: exam.batch?.id ?? "", allowCrossBatch: exam.allowCrossBatch,
      sessionId: exam.session?.id ?? "", subjectId: exam.subject?.id ?? "", date: exam.date, startTime: exam.startTime ?? "", endTime: exam.endTime ?? "",
      durationMinutes: exam.durationMinutes ? String(exam.durationMinutes) : "", venue: exam.venue ?? "", instructions: exam.instructions ?? "",
    } : { ...blank, instructions: defaultInstructions });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exam]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: undefined })); };
  const locked = !!exam && assignedCount > 0;
  const courseBatches = useMemo(() => batches.filter((b) => b.courseId === f.courseId), [batches, f.courseId]);
  const subjects = f.courseId ? getSubjectsByCourse(f.courseId) : [];
  const computed = f.startTime && f.endTime ? toMin(f.endTime) - toMin(f.startTime) : null;

  const setCourse = (courseId: string) => {
    const c = getCourse(courseId);
    setF((p) => ({ ...p, courseId, batchId: batches.some((b) => b.id === p.batchId && b.courseId === courseId) ? p.batchId : "", subjectId: "", sessionId: c?.sessionId ?? p.sessionId }));
    setErrors((p) => ({ ...p, courseId: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (f.name.trim().length < 2) e.name = "পরীক্ষার নাম লিখুন";
    if (!f.examType) e.examType = "পরীক্ষার ধরন নির্বাচন করুন";
    if (!f.courseId) e.courseId = "কোর্স নির্বাচন করুন";
    if (!f.date) e.date = "পরীক্ষার তারিখ দিন";
    if (computed !== null && computed <= 0) e.endTime = "শেষের সময় শুরুর সময়ের পরে হতে হবে";
    if (!f.startTime !== !f.endTime && !f.durationMinutes) e.durationMinutes = "শুরু ও শেষের সময় দুটোই দিন, অথবা সময়কাল লিখুন";
    if (f.durationMinutes && (!/^\d+$/.test(f.durationMinutes) || Number(f.durationMinutes) < 1)) e.durationMinutes = "সঠিক মিনিট লিখুন";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (status: "draft" | "published" | "save") => {
    if (!validate()) return;
    setSaving(status);
    const body = {
      name: f.name.trim(), examType: f.examType, courseId: f.courseId, batchId: f.batchId || null, allowCrossBatch: f.allowCrossBatch,
      sessionId: f.sessionId || null, subjectId: f.subjectId || null, date: f.date, startTime: f.startTime || null, endTime: f.endTime || null,
      durationMinutes: computed === null && f.durationMinutes ? Number(f.durationMinutes) : null, venue: f.venue.trim() || null, instructions: f.instructions.trim() || null,
    };
    try {
      const saved = exam
        ? await api.patch<ExamSchedule & { printedChanged?: boolean }>(`/exam-schedules/${exam.id}`, locked ? { ...body, courseId: undefined, batchId: undefined } : body)
        : await api.post<ExamSchedule>("/exam-schedules", { ...body, status });
      if (exam && (saved as { printedChanged?: boolean }).printedChanged && generatedCount > 0) toast.warning("পরীক্ষার তথ্য পরিবর্তিত হয়েছে — তৈরি অ্যাডমিট কার্ডগুলো পুনরায় তৈরি করুন");
      else toast.success(exam ? "পরীক্ষার তথ্য হালনাগাদ হয়েছে" : status === "published" ? "পরীক্ষা তৈরি ও প্রকাশ হয়েছে" : "পরীক্ষা খসড়া হিসেবে সংরক্ষিত");
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k.replace(/^body\./, ""), v[0]])) as Partial<Record<keyof Form, string>>);
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ করা যায়নি");
    } finally {
      setSaving(null);
    }
  };

  const err = (k: keyof Form) => errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exam ? "পরীক্ষা সম্পাদনা" : "নতুন পরীক্ষা তৈরি"}</DialogTitle>
          <DialogDescription>{exam ? `${exam.code} — পরিবর্তন অ্যাডমিট কার্ডের পরবর্তী প্রিভিউ ও পুনরায় তৈরি করা কার্ডে প্রতিফলিত হবে।` : "তারকা (*) চিহ্নিত ঘর আবশ্যক। বাকিগুলো থাকলে অ্যাডমিট কার্ডে দেখাবে।"}</DialogDescription>
        </DialogHeader>
        {exam && generatedCount > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-sm text-warning"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{generatedCount}টি অ্যাডমিট কার্ড তৈরি হয়েছে। তারিখ/সময়/কক্ষ ইত্যাদি বদলালে সেগুলো “পরিবর্তিত” দেখাবে — পুনরায় তৈরি করে আবার প্রিন্ট করুন।</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ex-name">পরীক্ষার নাম *</Label><Input id="ex-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="যেমন: মডেল টেস্ট — ০৩" aria-invalid={!!errors.name} />{err("name")}</div>
          <div className="space-y-1.5">
            <Label>পরীক্ষার ধরন *</Label>
            <Select value={f.examType} onValueChange={(v) => set("examType", v as ExamType)}>
              <SelectTrigger aria-label="পরীক্ষার ধরন" aria-invalid={!!errors.examType}><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>{EXAM_TYPES.map((t) => <SelectItem key={t} value={t}>{EXAM_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>{err("examType")}
          </div>
          <div className="space-y-1.5"><Label htmlFor="ex-date">পরীক্ষার তারিখ *</Label><Input id="ex-date" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} aria-invalid={!!errors.date} />{err("date")}</div>
          <div className="space-y-1.5">
            <Label>কোর্স *</Label>
            <SearchSelect label="কোর্স" value={f.courseId} onChange={setCourse} placeholder="কোর্স নির্বাচন করুন" options={activeCourses.map((c) => ({ value: c.id, label: c.name }))} disabled={locked} className={cn(errors.courseId && "border-destructive")} />
            {err("courseId")}
          </div>
          <div className="space-y-1.5">
            <Label>ব্যাচ</Label>
            <SearchSelect label="ব্যাচ" value={f.batchId} onChange={(v) => set("batchId", v)} placeholder={f.courseId ? "সকল ব্যাচ (কোর্সভিত্তিক)" : "আগে কোর্স নির্বাচন করুন"} allLabel="সকল ব্যাচ (কোর্সভিত্তিক)" options={courseBatches.map((b) => ({ value: b.id, label: b.name }))} disabled={!f.courseId || locked} />
            {locked && <p className="text-xs text-muted-foreground">শিক্ষার্থী নির্ধারিত থাকায় কোর্স/ব্যাচ পরিবর্তন করা যাবে না</p>}
          </div>
          {f.batchId && (
            <div className="flex items-start justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
              <Label htmlFor="ex-cross" className="font-normal leading-snug">অন্য ব্যাচের শিক্ষার্থীও অংশ নিতে পারবে<span className="block text-xs text-muted-foreground">চালু থাকলে একই কোর্সের যেকোনো ব্যাচের শিক্ষার্থী যোগ করা যাবে; বন্ধ থাকলে শুধু নির্বাচিত ব্যাচ</span></Label>
              <Switch id="ex-cross" checked={f.allowCrossBatch} onCheckedChange={(v) => set("allowCrossBatch", v)} />
            </div>
          )}
          <div className="space-y-1.5"><Label htmlFor="ex-start">শুরুর সময়</Label><Input id="ex-start" type="time" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ex-end">শেষের সময়</Label><Input id="ex-end" type="time" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} aria-invalid={!!errors.endTime} />{err("endTime")}</div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-dur">সময়কাল (মিনিট)</Label>
            {computed !== null && computed > 0 ? <Input id="ex-dur" value={formatDuration(computed)} disabled /> : <Input id="ex-dur" inputMode="numeric" value={f.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} placeholder="যেমন: 90" aria-invalid={!!errors.durationMinutes} />}
            {computed !== null && computed > 0 ? <p className="text-xs text-muted-foreground">শুরু ও শেষের সময় থেকে স্বয়ংক্রিয়</p> : err("durationMinutes")}
          </div>
          <div className="space-y-1.5"><Label htmlFor="ex-venue">কেন্দ্র / কক্ষ</Label><Input id="ex-venue" value={f.venue} onChange={(e) => set("venue", e.target.value)} placeholder="যেমন: মূল ক্যাম্পাস, রুম ২০১" /></div>
          <div className="space-y-1.5">
            <Label>বিষয় (ঐচ্ছিক)</Label>
            <Select value={f.subjectId || "none"} onValueChange={(v) => set("subjectId", v === "none" ? "" : v)} disabled={!f.courseId}>
              <SelectTrigger aria-label="বিষয়"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">নির্দিষ্ট বিষয় নেই</SelectItem>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>পরীক্ষার সেশন</Label>
            <Select value={f.sessionId || "none"} onValueChange={(v) => set("sessionId", v === "none" ? "" : v)}>
              <SelectTrigger aria-label="সেশন"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">উল্লেখ নেই</SelectItem>{activeSessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ex-ins">পরীক্ষার্থীদের জন্য নির্দেশনা (প্রতি লাইনে একটি)</Label><Textarea id="ex-ins" rows={4} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!saving}>বাতিল</Button>
          {exam ? (
            <Button onClick={() => submit("save")} disabled={!!saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}সংরক্ষণ করুন</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => submit("draft")} disabled={!!saving}>{saving === "draft" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}খসড়া হিসেবে সংরক্ষণ</Button>
              <Button onClick={() => submit("published")} disabled={!!saving}>{saving === "published" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}সংরক্ষণ ও প্রকাশ</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
