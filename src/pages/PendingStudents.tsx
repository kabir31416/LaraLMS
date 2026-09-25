import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { User, Eye } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { useAuth, ApiClientError, hasPermission } from "@/contexts/AuthContext";
import { useStudents } from "@/contexts/StudentContext";
import { useBatches } from "@/contexts/BatchContext";
import { STUDENTS_APPROVE_ENTRY } from "@/lib/permissions";

/**
 * Student Entry Workflow — Admin Pending Applications (/admission/pending).
 * A student created via /newstudententry (and possibly then self-completed
 * via /studententry) sits here as `admissionStatus: "pending"` until an
 * Admin approves or rejects it — it never appears in the normal Student
 * List/Batch List until approved (student.service.ts's buildStudentFilter
 * excludes pending/rejected by default). Approve/Reject both reuse the exact
 * same backend endpoints; this page never enrolls or activates anything
 * itself, it only triggers the server-side action and reflects the result.
 */
interface PendingEntry {
  _id: string;
  name: string;
  registrationId: string;
  currentRollNumber?: string;
  phone: string;
  guardianMobile?: string;
  course?: string;
  requestedBatchId?: string;
  photoUrl?: string;
  createdAt: string;
}

function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export default function PendingStudents() {
  const { user } = useAuth();
  const { refreshStudents } = useStudents();
  const { getBatch } = useBatches();
  const canApprove = hasPermission(user, STUDENTS_APPROVE_ENTRY);

  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<PendingEntry | null>(null);
  const [rejecting, setRejecting] = useState<PendingEntry | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get<PendingEntry[]>("/students?admissionStatus=pending&limit=100")
      .then(setEntries)
      .catch((err) => toast.error(friendlyError(err, "পেন্ডিং আবেদন লোড করা যায়নি")))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleApprove = async (entry: PendingEntry) => {
    if (busyId) return;
    setBusyId(entry._id);
    try {
      await api.post(`/students/${entry._id}/approve-entry`, {});
      toast.success(`${entry.name}-কে অনুমোদন করা হয়েছে`);
      setEntries((prev) => prev.filter((e) => e._id !== entry._id));
      await refreshStudents();
    } catch (err) {
      toast.error(friendlyError(err, "অনুমোদন করা যায়নি"));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejecting || busyId) return;
    setBusyId(rejecting._id);
    try {
      await api.post(`/students/${rejecting._id}/reject-entry`, { reason: rejectReason.trim() || undefined });
      toast.success(`${rejecting.name}-এর আবেদন বাতিল করা হয়েছে`);
      setEntries((prev) => prev.filter((e) => e._id !== rejecting._id));
      setRejecting(null);
      setRejectReason("");
    } catch (err) {
      toast.error(friendlyError(err, "বাতিল করা যায়নি"));
    } finally {
      setBusyId(null);
    }
  };

  const batchName = (id?: string) => (id ? getBatch(id)?.name || "—" : "—");

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">পেন্ডিং আবেদন</h1>
          <p className="text-sm text-muted-foreground">
            /newstudententry থেকে জমা হওয়া আবেদন — অনুমোদনের আগ পর্যন্ত শিক্ষার্থী তালিকা বা ব্যাচে দেখা যাবে না
          </p>
        </div>

        <Card className="border-none shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ছবি</TableHead>
                <TableHead>নাম</TableHead>
                <TableHead>রোল / Reg. ID</TableHead>
                <TableHead>মোবাইল</TableHead>
                <TableHead>অভিভাবক</TableHead>
                <TableHead>কোর্স</TableHead>
                <TableHead>অনুরোধকৃত ব্যাচ</TableHead>
                <TableHead>জমার তারিখ</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">লোড হচ্ছে...</TableCell></TableRow>
              ) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">কোনো পেন্ডিং আবেদন নেই</TableCell></TableRow>
              ) : (
                entries.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell>
                      <Avatar className="h-9 w-9">
                        {e.photoUrl && <AvatarImage src={e.photoUrl} alt={e.name} className="object-cover" />}
                        <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="font-mono text-xs">{e.currentRollNumber || "—"} / {e.registrationId}</TableCell>
                    <TableCell>{e.phone}</TableCell>
                    <TableCell>{e.guardianMobile || "—"}</TableCell>
                    <TableCell>{e.course || "—"}</TableCell>
                    <TableCell>{batchName(e.requestedBatchId)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString("bn-BD")}</TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="বিস্তারিত দেখুন" onClick={() => setViewing(e)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canApprove && (
                        <>
                          <Button size="sm" disabled={busyId === e._id} onClick={() => handleApprove(e)}>
                            অনুমোদন
                          </Button>
                          <Button variant="outline" size="sm" disabled={busyId === e._id} onClick={() => setRejecting(e)}>
                            বাতিল
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>আবেদনের বিস্তারিত</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <Avatar className="h-24 w-24">
                  {viewing.photoUrl && <AvatarImage src={viewing.photoUrl} alt={viewing.name} className="object-cover" />}
                  <AvatarFallback><User className="h-10 w-10" /></AvatarFallback>
                </Avatar>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">নাম</p><p className="font-medium">{viewing.name}</p></div>
                <div><p className="text-xs text-muted-foreground">Registration ID</p><p className="font-mono">{viewing.registrationId}</p></div>
                <div><p className="text-xs text-muted-foreground">রোল</p><p>{viewing.currentRollNumber || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">মোবাইল</p><p>{viewing.phone}</p></div>
                <div><p className="text-xs text-muted-foreground">অভিভাবকের মোবাইল</p><p>{viewing.guardianMobile || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">কোর্স</p><p>{viewing.course || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">অনুরোধকৃত ব্যাচ</p><p>{batchName(viewing.requestedBatchId)}</p></div>
                <div><p className="text-xs text-muted-foreground">জমার তারিখ</p><p>{new Date(viewing.createdAt).toLocaleString("bn-BD")}</p></div>
              </div>
              <div className="flex justify-center"><Badge variant="outline">পেন্ডিং — অনুমোদনের অপেক্ষায়</Badge></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>বন্ধ করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rejecting} onOpenChange={(v) => { if (!v) { setRejecting(null); setRejectReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>আবেদন বাতিল করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejecting?.name}-এর আবেদন বাতিল করা হবে। এই শিক্ষার্থী কোনো ব্যাচে যুক্ত হবে না। জমাকৃত তথ্য ইতিহাসের জন্য সংরক্ষিত থাকবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Textarea placeholder="বাতিলের কারণ (ঐচ্ছিক)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল করুন</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={busyId === rejecting?._id}>আবেদন বাতিল করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
