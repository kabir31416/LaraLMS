import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import type { MasterDataStatus, Session } from "@/types/academic";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

export function SessionsTab() {
  const { sessions, addSession, updateSession, deleteSession } = useAcademic();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Session | null>(null);
  const [form, setForm] = useState<{ name: string; startDate: string; endDate: string; status: MasterDataStatus }>({ name: "", startDate: "", endDate: "", status: "সক্রিয়" });

  const openNew = () => { setEdit(null); setForm({ name: "", startDate: "", endDate: "", status: "সক্রিয়" }); setOpen(true); };
  const openEdit = (s: Session) => { setEdit(s); setForm({ name: s.name, startDate: s.startDate, endDate: s.endDate, status: s.status }); setOpen(true); };

  const toggleStatus = async (s: Session) => {
    try {
      await updateSession(s.id, { status: s.status === "সক্রিয়" ? "নিষ্ক্রিয়" : "সক্রিয়" });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পরিবর্তন ব্যর্থ হয়েছে");
    }
  };

  const submit = async () => {
    if (!form.name || !form.startDate || !form.endDate) { toast.error("সব ফিল্ড পূরণ করুন"); return; }
    try {
      if (edit) { await updateSession(edit.id, form); toast.success("সেশন আপডেট"); }
      else { await addSession(form); toast.success("সেশন যোগ"); }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id);
      toast.success("মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "মুছতে ব্যর্থ হয়েছে");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">মোট {sessions.length}টি সেশন</p>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন সেশন</Button>
      </div>
      <Card className="border-none shadow-sm">
        <Table>
          <TableHeader><TableRow><TableHead>নাম</TableHead><TableHead>শুরু</TableHead><TableHead>শেষ</TableHead><TableHead>অবস্থা</TableHead><TableHead className="w-[120px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">কোনো সেশন নেই</TableCell></TableRow>
            ) : sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.startDate}</TableCell>
                <TableCell>{s.endDate}</TableCell>
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
          <DialogHeader><DialogTitle>{edit ? "সেশন সম্পাদনা" : "নতুন সেশন"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="সেশন ২০২৭" /></div>
            <div><Label>শুরুর তারিখ *</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><Label>শেষ তারিখ *</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button><Button onClick={submit}>{edit ? "আপডেট" : "যোগ"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
