import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, MoreVertical, UserPlus, Search, ArrowLeft, X, ArrowRightLeft } from "lucide-react";
import { useBatches } from "@/contexts/BatchContext";
import { useStaff } from "@/contexts/StaffContext";
import { useStudents } from "@/contexts/StudentContext";
import { useAcademic } from "@/contexts/AcademicContext";
import type { Batch } from "@/types/batch";
import type { Student } from "@/types/student";
import { BatchForm } from "@/components/batches/BatchForm";
import { AssignStudentsDialog } from "@/components/batches/AssignStudentsDialog";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

const Batches = () => {
  const { batches, deleteBatch } = useBatches();
  const { staff, getStaff } = useStaff();
  const { students, withdrawStudent } = useStudents();
  const { getCourse } = useAcademic();
  const [search, setSearch] = useState("");
  const [filterDirector, setFilterDirector] = useState("all");
  const [open, setOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);
  const [transferStudent, setTransferStudentTarget] = useState<Student | null>(null);

  const directors = staff.filter((s) => s.staffType === "Batch Director");
  const courseName = (id?: string) => getCourse(id || "")?.name || "—";
  const studentCount = (batchId: string) => students.filter((s) => s.batchId === batchId).length;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return batches.filter((b) => {
      const matchSearch = !q || b.name.toLowerCase().includes(q) || courseName(b.courseId).toLowerCase().includes(q);
      const matchDir = filterDirector === "all" || b.directorId === filterDirector;
      return matchSearch && matchDir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, search, filterDirector]);

  const directorName = (id?: string) => (id ? getStaff(id)?.name || "—" : "—");

  const handleDelete = async (id: string) => {
    try {
      await deleteBatch(id);
      toast.success("ব্যাচ মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "মুছতে ব্যর্থ হয়েছে");
    }
  };

  const handleWithdraw = async (studentId: string) => {
    try {
      await withdrawStudent(studentId);
      toast.success("শিক্ষার্থী সরানো হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সরাতে ব্যর্থ হয়েছে");
    }
  };

  const openBatch = batches.find((b) => b.id === openBatchId);
  const openBatchStudents = openBatch ? students.filter((s) => s.batchId === openBatch.id) : [];

  if (openBatch) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setOpenBatchId(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{openBatch.name}</h1>
              <p className="text-sm text-muted-foreground">
                {courseName(openBatch.courseId)} · {openBatch.batchTime} · রুম {openBatch.roomNumber || "—"} · ডিরেক্টর: {directorName(openBatch.directorId)}
              </p>
            </div>
            <Button onClick={() => setAssignFor(openBatch.id)}>
              <UserPlus className="mr-2 h-4 w-4" /> শিক্ষার্থী যোগ
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label="মোট শিক্ষার্থী" value={String(openBatchStudents.length)} />
            <StatBox label="দিন" value={openBatch.days.length ? openBatch.days.join(", ") : "—"} />
            <StatBox label="সময়" value={openBatch.batchTime} />
            <StatBox label="শুরু" value={openBatch.startDate} />
          </div>

          <Card className="border-none shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>আইডি</TableHead>
                  <TableHead>রোল</TableHead>
                  <TableHead>নাম</TableHead>
                  <TableHead>মোবাইল</TableHead>
                  <TableHead>কোর্স</TableHead>
                  <TableHead className="w-[140px] text-right">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openBatchStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">কোনো শিক্ষার্থী যোগ করা হয়নি</TableCell></TableRow>
                ) : (
                  openBatchStudents.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.studentId}</TableCell>
                      <TableCell className="font-mono text-xs">{s.rollNumber || "—"}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.mobile}</TableCell>
                      <TableCell>{s.course}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="অন্য ব্যাচে স্থানান্তর"
                          onClick={() => setTransferStudentTarget(s)}
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          title="ব্যাচ থেকে সরান"
                          onClick={() => handleWithdraw(s.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <AssignStudentsDialog open={!!assignFor} onOpenChange={(v) => !v && setAssignFor(null)} batchId={openBatch.id} />
          <TransferDialog student={transferStudent} onOpenChange={(v) => !v && setTransferStudentTarget(null)} currentBatchId={openBatch.id} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ব্যাচ ম্যানেজমেন্ট</h1>
            <p className="text-sm text-muted-foreground">মোট {batches.length}টি ব্যাচ</p>
          </div>
          <Button onClick={() => { setEditBatch(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> নতুন ব্যাচ
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ব্যাচ বা কোর্স..." className="pl-9" />
          </div>
          <Select value={filterDirector} onValueChange={setFilterDirector}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="ডিরেক্টর" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সকল ডিরেক্টর</SelectItem>
              {directors.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="border-none shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ব্যাচ</TableHead>
                <TableHead>কোর্স</TableHead>
                <TableHead>সময়</TableHead>
                <TableHead className="hidden md:table-cell">দিন</TableHead>
                <TableHead>রুম</TableHead>
                <TableHead>ডিরেক্টর</TableHead>
                <TableHead className="text-center">শিক্ষার্থী</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">কোনো ব্যাচ পাওয়া যায়নি</TableCell></TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setOpenBatchId(b.id)}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{courseName(b.courseId)}</TableCell>
                    <TableCell className="text-sm">{b.batchTime}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{b.days.join(", ") || "—"}</TableCell>
                    <TableCell>{b.roomNumber || "—"}</TableCell>
                    <TableCell>{directorName(b.directorId)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{studentCount(b.id)}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAssignFor(b.id)}><UserPlus className="mr-2 h-4 w-4" /> শিক্ষার্থী যোগ</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditBatch(b); setOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> সম্পাদনা</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(b.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> মুছে ফেলুন
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <BatchForm open={open} onOpenChange={setOpen} editBatch={editBatch} />
        <AssignStudentsDialog open={!!assignFor} onOpenChange={(v) => !v && setAssignFor(null)} batchId={assignFor || ""} />
      </div>
    </DashboardLayout>
  );
};

/** Batch transfer — Phase 1 §3/§14: moves a student to a new batch while keeping every historical record exactly where it was. */
function TransferDialog({
  student,
  onOpenChange,
  currentBatchId,
}: {
  student: Student | null;
  onOpenChange: (v: boolean) => void;
  currentBatchId: string;
}) {
  const { batches } = useBatches();
  const { transferStudent } = useStudents();
  const [toBatchId, setToBatchId] = useState("");
  const [reason, setReason] = useState("");
  const [newRoll, setNewRoll] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const otherBatches = batches.filter((b) => b.id !== currentBatchId);

  const submit = async () => {
    if (!student) return;
    if (!toBatchId) { toast.error("গন্তব্য ব্যাচ নির্বাচন করুন"); return; }
    if (!reason.trim()) { toast.error("স্থানান্তরের কারণ লিখুন"); return; }
    setSubmitting(true);
    try {
      await transferStudent(student.id, toBatchId, reason.trim(), newRoll.trim() || undefined);
      toast.success(`${student.name}-কে স্থানান্তর করা হয়েছে`);
      onOpenChange(false);
      setToBatchId(""); setReason(""); setNewRoll("");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "স্থানান্তর ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!student} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>ব্যাচ স্থানান্তর — {student?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>গন্তব্য ব্যাচ *</Label>
            <Select value={toBatchId} onValueChange={setToBatchId}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                {otherBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>নতুন রোল নম্বর (ঐচ্ছিক)</Label>
            <Input value={newRoll} onChange={(e) => setNewRoll(e.target.value)} placeholder={student?.rollNumber || ""} />
          </div>
          <div className="space-y-1.5">
            <Label>স্থানান্তরের কারণ *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <p className="text-xs text-muted-foreground">পূর্বের ব্যাচের উপস্থিতি, ফলাফল ও পেমেন্ট রেকর্ড অপরিবর্তিত থাকবে।</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>বাতিল</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "স্থানান্তর হচ্ছে..." : "স্থানান্তর করুন"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-none shadow-sm p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold mt-1">{value}</p>
    </Card>
  );
}

export default Batches;
