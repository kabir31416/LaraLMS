import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import type { MasterDataStatus, Subject } from "@/types/academic";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

/**
 * GLOBAL Subject management (Subject/Course Refactor) — a Subject is
 * created here exactly once, with no Course field at all, and then
 * assigned to as many Courses as needed from the Courses tab's "সাবজেক্ট
 * যোগ করুন" picker. This tab never asks which Course a Subject belongs to,
 * because a Subject no longer belongs to any single Course.
 */
export function SubjectsTab() {
  const { subjects, addSubject, updateSubject, deleteSubject } = useAcademic();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Subject | null>(null);
  const [form, setForm] = useState<{ name: string; code: string; status: MasterDataStatus; displayOrder: number }>({ name: "", code: "", status: "সক্রিয়", displayOrder: 0 });
  const [search, setSearch] = useState("");

  const openNew = () => { setEdit(null); setForm({ name: "", code: "", status: "সক্রিয়", displayOrder: 0 }); setOpen(true); };
  const openEdit = (s: Subject) => { setEdit(s); setForm({ name: s.name, code: s.code || "", status: s.status, displayOrder: s.displayOrder || 0 }); setOpen(true); };

  const toggleStatus = async (s: Subject) => {
    try {
      await updateSubject(s.id, { status: s.status === "সক্রিয়" ? "নিষ্ক্রিয়" : "সক্রিয়" });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পরিবর্তন ব্যর্থ হয়েছে");
    }
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error("সাবজেক্টের নাম দিন"); return; }
    const payload = { name: form.name.trim(), code: form.code.trim() || undefined, status: form.status, displayOrder: form.displayOrder };
    try {
      if (edit) { await updateSubject(edit.id, payload); toast.success("সাবজেক্ট আপডেট হয়েছে"); }
      else { await addSubject(payload); toast.success("সাবজেক্ট যোগ হয়েছে"); }
      setOpen(false);
    } catch (err) {
      // "একই নামে সাবজেক্ট আগে থেকেই আছে" — never a raw Mongo duplicate-key message.
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSubject(id);
      toast.success("মুছে ফেলা হয়েছে");
    } catch (err) {
      // Delete Safety: the backend refuses when this Subject is still assigned to any Course — shown here, never a raw 409.
      toast.error(err instanceof ApiClientError ? err.message : "মুছতে ব্যর্থ হয়েছে");
    }
  };

  const filtered = search.trim()
    ? subjects.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()) || s.code?.toLowerCase().includes(search.trim().toLowerCase()))
    : subjects;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="relative w-full sm:w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="সাবজেক্ট খুঁজুন..." />
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন সাবজেক্ট</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        এটি গ্লোবাল সাবজেক্ট তালিকা — একটি সাবজেক্ট একবার তৈরি করে যেকোনো সংখ্যক কোর্সে যুক্ত করা যাবে (কোর্স ম্যানেজমেন্ট থেকে "সাবজেক্ট যোগ করুন")।
      </p>
      <Card className="border-none shadow-sm">
        <Table>
          <TableHeader><TableRow><TableHead>নাম</TableHead><TableHead>কোড</TableHead><TableHead>ক্রম</TableHead><TableHead>অবস্থা</TableHead><TableHead className="w-[120px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">কোনো সাবজেক্ট নেই</TableCell></TableRow>
            ) : filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm font-mono">{s.code || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{s.displayOrder ?? 0}</TableCell>
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
          <DialogHeader><DialogTitle>{edit ? "সাবজেক্ট সম্পাদনা" : "নতুন সাবজেক্ট"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>সাবজেক্টের নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="বাংলা" /></div>
            <div><Label>কোড (ঐচ্ছিক)</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BAN" /></div>
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
