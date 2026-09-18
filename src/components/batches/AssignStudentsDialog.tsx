import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { useStudents } from "@/contexts/StudentContext";
import { useBatches } from "@/contexts/BatchContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";
import { matchesStudentQuery, studentIdentifierLabel } from "@/lib/studentDisplay";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batchId: string;
}

export function AssignStudentsDialog({ open, onOpenChange, batchId }: Props) {
  const { students, refreshStudents } = useStudents();
  const { batches, enrollBulk } = useBatches();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const currentBatch = batches.find((b) => b.id === batchId);

  // Only students with no current batch can be enrolled here — a student
  // already in another batch needs Transfer instead (Phase 1 §14).
  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (s.batchId) return false;
      return matchesStudentQuery(search, { name: s.name, rollNumber: s.rollNumber, systemId: s.studentId, mobile: s.mobile });
    });
  }, [students, search]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    if (picked.length === 0) {
      toast.error("কমপক্ষে একজন শিক্ষার্থী নির্বাচন করুন");
      return;
    }
    setSubmitting(true);
    try {
      const result = await enrollBulk(batchId, picked);
      await refreshStudents();
      if (result.succeeded.length) toast.success(`${result.succeeded.length} জন শিক্ষার্থী যোগ হয়েছে`);
      if (result.failed.length) toast.warning(`${result.failed.length} জনকে যোগ করা যায়নি`);
      setPicked([]);
      setSearch("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "যোগ করতে ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>শিক্ষার্থী যোগ করুন — {currentBatch?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, রোল, আইডি বা মোবাইল..." className="pl-9" />
          </div>
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-2 space-y-1">
              {filtered.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">কোনো শিক্ষার্থী পাওয়া যায়নি</div>
              ) : (
                filtered.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={picked.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{studentIdentifierLabel({ rollNumber: s.rollNumber, systemId: s.studentId })} · {s.mobile}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">নির্বাচিত: {picked.length}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>বাতিল</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? "যোগ হচ্ছে..." : "যোগ করুন"}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
