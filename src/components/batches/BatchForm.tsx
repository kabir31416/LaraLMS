import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import { useBatches } from "@/contexts/BatchContext";
import { useStaff } from "@/contexts/StaffContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { WEEK_DAYS, type Batch, type WeekDay } from "@/types/batch";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editBatch?: Batch | null;
}

export function BatchForm({ open, onOpenChange, editBatch }: Props) {
  const { addBatch, updateBatch } = useBatches();
  const { getDirectors } = useStaff();
  const { courses } = useAcademic();
  const directors = getDirectors();
  const isEdit = !!editBatch;

  const [form, setForm] = useState(() => init(editBatch));
  const [startDate, setStartDate] = useState<Date | undefined>(
    editBatch?.startDate ? new Date(editBatch.startDate) : new Date(),
  );
  const [days, setDays] = useState<WeekDay[]>(editBatch?.days || []);

  function init(b?: Batch | null) {
    return {
      name: b?.name || "",
      course: b?.course || "",
      batchTime: b?.batchTime || "",
      roomNumber: b?.roomNumber || "",
      directorId: b?.directorId || "",
    };
  }

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const toggleDay = (d: WeekDay) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const handleSubmit = () => {
    if (!form.name || !form.course || !form.batchTime) {
      toast.error("নাম, কোর্স এবং সময় প্রয়োজন");
      return;
    }
    const data = {
      name: form.name,
      course: form.course,
      batchTime: form.batchTime,
      roomNumber: form.roomNumber,
      directorId: form.directorId || undefined,
      days,
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    };
    if (isEdit && editBatch) {
      updateBatch(editBatch.id, data);
      toast.success("ব্যাচ আপডেট হয়েছে");
    } else {
      addBatch(data);
      toast.success("ব্যাচ তৈরি হয়েছে");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "ব্যাচ সম্পাদনা" : "নতুন ব্যাচ"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <Label>ব্যাচের নাম *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="ব্যাচ-২০২৬-A" />
          </div>
          <div className="space-y-1.5">
            <Label>কোর্স *</Label>
            <Select value={form.course} onValueChange={(v) => update("course", v)}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                {courses.length === 0 ? (
                  <SelectItem value="__empty" disabled>প্রথমে সেটিংস থেকে কোর্স যোগ করুন</SelectItem>
                ) : (
                  courses.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ব্যাচের সময় *</Label>
            <Input value={form.batchTime} onChange={(e) => update("batchTime", e.target.value)} placeholder="৫:০০ PM - ৭:০০ PM" />
          </div>
          <div className="space-y-1.5">
            <Label>রুম নম্বর</Label>
            <Input value={form.roomNumber} onChange={(e) => update("roomNumber", e.target.value)} placeholder="১০১" />
          </div>
          <div className="space-y-1.5">
            <Label>শুরুর তারিখ</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd MMMM yyyy", { locale: bn }) : "তারিখ"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label>ব্যাচ ডিরেক্টর</Label>
            <Select value={form.directorId || "none"} onValueChange={(v) => update("directorId", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— কেউ না —</SelectItem>
                {directors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {directors.length === 0 && (
              <p className="text-xs text-muted-foreground">প্রথমে স্টাফ পেজ থেকে Batch Director যোগ করুন</p>
            )}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>দিনসমূহ</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border rounded-lg p-3 bg-muted/30">
              {WEEK_DAYS.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={days.includes(d)} onCheckedChange={() => toggleDay(d)} />
                  {d}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button onClick={handleSubmit}>{isEdit ? "আপডেট" : "তৈরি"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
