import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import type { MasterDataStatus, PaymentMethod } from "@/types/academic";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

/**
 * Finance Settings (Settings §9/§10) — the fixed Admission Fee and the
 * reusable Payment Method list, both consumed by Admission/Fee
 * Management/Receipt instead of the old hard-coded "200" and method array.
 */
export function FinanceTab() {
  const { settings, updateSettings, paymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod } = useAcademic();
  const [admissionFee, setAdmissionFee] = useState(settings.admissionFeeBdt);
  const [savingFee, setSavingFee] = useState(false);

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState<{ name: string; status: MasterDataStatus; displayOrder: number }>({ name: "", status: "সক্রিয়", displayOrder: 0 });

  const saveAdmissionFee = async () => {
    setSavingFee(true);
    try {
      await updateSettings({ admissionFeeBdt: Number(admissionFee) || 0 });
      toast.success("সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSavingFee(false);
    }
  };

  const openNew = () => { setEdit(null); setForm({ name: "", status: "সক্রিয়", displayOrder: paymentMethods.length }); setOpen(true); };
  const openEdit = (p: PaymentMethod) => { setEdit(p); setForm({ name: p.name, status: p.status, displayOrder: p.displayOrder || 0 }); setOpen(true); };

  const submit = async () => {
    if (!form.name.trim()) { toast.error("নাম আবশ্যক"); return; }
    try {
      if (edit) { await updatePaymentMethod(edit.id, form); toast.success("আপডেট হয়েছে"); }
      else { await addPaymentMethod(form); toast.success("যোগ করা হয়েছে"); }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    }
  };

  const toggleStatus = async (p: PaymentMethod) => {
    try {
      await updatePaymentMethod(p.id, { status: p.status === "সক্রিয়" ? "নিষ্ক্রিয়" : "সক্রিয়" });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পরিবর্তন ব্যর্থ হয়েছে");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePaymentMethod(id);
      toast.success("মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "মুছতে ব্যর্থ হয়েছে — ইতিমধ্যে ব্যবহৃত মাধ্যম নিষ্ক্রিয় করুন");
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">ভর্তি ফি</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[200px]">
              <Label>নির্দিষ্ট ভর্তি ফি (৳)</Label>
              <Input type="number" value={admissionFee} onChange={(e) => setAdmissionFee(Number(e.target.value) || 0)} />
            </div>
            <Button onClick={saveAdmissionFee} disabled={savingFee}>{savingFee ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            কোর্স ফি থেকে আলাদা — এই পরিবর্তন শুধু ভবিষ্যতের ভর্তিতে প্রযোজ্য হবে। ইতিমধ্যে ভর্তি হওয়া শিক্ষার্থীদের ভর্তি ফি অপরিবর্তিত থাকবে।
          </p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">পেমেন্ট মাধ্যম</CardTitle>
          <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন মাধ্যম</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>নাম</TableHead><TableHead>ক্রম</TableHead><TableHead>অবস্থা</TableHead><TableHead className="w-[100px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
            <TableBody>
              {paymentMethods.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">কোনো পেমেন্ট মাধ্যম নেই</TableCell></TableRow>
              ) : paymentMethods.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.displayOrder ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.status === "সক্রিয়"} onCheckedChange={() => toggleStatus(p)} />
                      <Badge variant="outline" className={p.status === "সক্রিয়" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>{p.status}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "পেমেন্ট মাধ্যম সম্পাদনা" : "নতুন পেমেন্ট মাধ্যম"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="যেমন: বিকাশ" /></div>
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
