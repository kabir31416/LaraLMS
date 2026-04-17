import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DAYS, TEACHERS, type RoutineEntry, type Day } from "@/types/routine";
import { BATCHES, SECTIONS, SUBJECTS } from "@/types/student";
import { useRoutines } from "@/contexts/RoutineContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editEntry?: RoutineEntry | null;
}

export function RoutineForm({ open, onOpenChange, editEntry }: Props) {
  const { routines, addRoutine, updateRoutine } = useRoutines();
  const [day, setDay] = useState<Day>("শনিবার");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [teacherId, setTeacherId] = useState("");
  const [room, setRoom] = useState("");
  const [batches, setBatches] = useState<string[]>([]);
  const [section, setSection] = useState<string>("none");

  useEffect(() => {
    if (editEntry) {
      setDay(editEntry.day);
      setStartTime(editEntry.startTime);
      setEndTime(editEntry.endTime);
      setSubject(editEntry.subject);
      setTeacherId(editEntry.teacherId);
      setRoom(editEntry.room || "");
      setBatches(editEntry.batches);
      setSection(editEntry.section || "none");
    } else if (open) {
      setDay("শনিবার");
      setStartTime("09:00");
      setEndTime("10:00");
      setSubject(SUBJECTS[0]);
      setTeacherId("");
      setRoom("");
      setBatches([]);
      setSection("none");
    }
  }, [editEntry, open]);

  // Teachers available on the chosen day & time (not booked elsewhere)
  const availableTeachers = TEACHERS.filter((t) => {
    const conflict = routines.some(
      (r) =>
        r.id !== editEntry?.id &&
        r.teacherId === t.id &&
        r.day === day &&
        timeOverlap(r.startTime, r.endTime, startTime, endTime)
    );
    return !conflict;
  });

  const toggleBatch = (b: string) => {
    setBatches((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  };

  const handleSubmit = () => {
    if (!teacherId) return toast.error("শিক্ষক নির্বাচন করুন");
    if (batches.length === 0) return toast.error("কমপক্ষে একটি ব্যাচ নির্বাচন করুন");
    if (startTime >= endTime) return toast.error("শেষ সময় শুরু সময়ের পরে হতে হবে");

    const data: Omit<RoutineEntry, "id"> = {
      day,
      startTime,
      endTime,
      subject,
      teacherId,
      room: room || undefined,
      batches,
      section: section === "none" ? undefined : section,
    };

    if (editEntry) {
      updateRoutine(editEntry.id, data);
      toast.success("রুটিন আপডেট হয়েছে");
    } else {
      addRoutine(data);
      toast.success("রুটিন যোগ করা হয়েছে");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editEntry ? "রুটিন সম্পাদনা" : "নতুন রুটিন যোগ করুন"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>দিন *</Label>
              <Select value={day} onValueChange={(v) => setDay(v as Day)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>শুরু সময় *</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>শেষ সময় *</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>বিষয় *</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>শিক্ষক *</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger><SelectValue placeholder="উপলব্ধ শিক্ষক" /></SelectTrigger>
                <SelectContent>
                  {availableTeachers.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">এই সময়ে কোনো শিক্ষক উপলব্ধ নেই</div>
                  ) : (
                    availableTeachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} <span className="text-muted-foreground text-xs">({t.subject})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">শুধুমাত্র এই সময়ে ফাঁকা শিক্ষক দেখানো হচ্ছে</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>রুম</Label>
              <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="যেমন: ১০১" />
            </div>
            <div className="space-y-1.5">
              <Label>সেকশন</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">কোনোটি নয়</SelectItem>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>ব্যাচ নির্বাচন * <span className="text-xs text-muted-foreground font-normal">(একাধিক নির্বাচন করুন)</span></Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg">
              {BATCHES.map((b) => (
                <label key={b} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={batches.includes(b)} onCheckedChange={() => toggleBatch(b)} />
                  <span>{b}</span>
                </label>
              ))}
            </div>
            {batches.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {batches.map((b) => (
                  <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
            <Button onClick={handleSubmit}>{editEntry ? "আপডেট করুন" : "যোগ করুন"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function timeOverlap(s1: string, e1: string, s2: string, e2: string) {
  return s1 < e2 && s2 < e1;
}
