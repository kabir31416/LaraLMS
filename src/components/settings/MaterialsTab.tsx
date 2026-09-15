import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useMaterials } from "@/contexts/MaterialContext";
import type { MasterDataStatus } from "@/types/academic";
import type { DuplicateDistributionRule, MaterialType } from "@/types/material";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

const RULE_LABELS: Record<DuplicateDistributionRule, string> = {
  allow: "Allow — কোনো সতর্কতা ছাড়াই সবসময় বিতরণ করা যাবে",
  warn: "Warning — আগে দেওয়া হয়ে থাকলে সতর্ক করবে, তবে আবার বিতরণ করা যাবে",
  block: "Block — আগে দেওয়া হয়ে থাকলে বিতরণ সম্পূর্ণভাবে আটকে দেবে",
};

/**
 * Coaching Material Inventory Settings (§2/§21) — Material Types master
 * data (mirrors FinanceTab's Payment Method CRUD exactly) plus the
 * Duplicate Distribution rule and default Minimum Stock suggestion.
 */
export function MaterialsTab() {
  const {
    materialTypes, addMaterialType, updateMaterialType, deleteMaterialType,
    materialSettings, updateMaterialSettings,
  } = useMaterials();

  const [savingRule, setSavingRule] = useState(false);
  const [defaultMinStock, setDefaultMinStock] = useState(materialSettings.defaultMinimumStock);
  const [savingMinStock, setSavingMinStock] = useState(false);

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<MaterialType | null>(null);
  const [form, setForm] = useState<{ name: string; status: MasterDataStatus; displayOrder: number }>({ name: "", status: "সক্রিয়", displayOrder: 0 });

  const saveRule = async (rule: DuplicateDistributionRule) => {
    setSavingRule(true);
    try {
      await updateMaterialSettings({ duplicateDistributionRule: rule });
      toast.success("সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSavingRule(false);
    }
  };

  const saveMinStock = async () => {
    setSavingMinStock(true);
    try {
      await updateMaterialSettings({ defaultMinimumStock: Number(defaultMinStock) || 0 });
      toast.success("সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSavingMinStock(false);
    }
  };

  const openNew = () => { setEdit(null); setForm({ name: "", status: "সক্রিয়", displayOrder: materialTypes.length }); setOpen(true); };
  const openEdit = (t: MaterialType) => { setEdit(t); setForm({ name: t.name, status: t.status, displayOrder: t.displayOrder || 0 }); setOpen(true); };

  const submit = async () => {
    if (!form.name.trim()) { toast.error("নাম আবশ্যক"); return; }
    try {
      if (edit) { await updateMaterialType(edit.id, form); toast.success("আপডেট হয়েছে"); }
      else { await addMaterialType(form); toast.success("যোগ করা হয়েছে"); }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    }
  };

  const toggleStatus = async (t: MaterialType) => {
    try {
      await updateMaterialType(t.id, { status: t.status === "সক্রিয়" ? "নিষ্ক্রিয়" : "সক্রিয়" });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পরিবর্তন ব্যর্থ হয়েছে");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMaterialType(id);
      toast.success("মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "মুছতে ব্যর্থ হয়েছে — ইতিমধ্যে ব্যবহৃত টাইপ নিষ্ক্রিয় করুন");
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">ম্যাটেরিয়াল টাইপ</CardTitle>
          <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন টাইপ</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>নাম</TableHead><TableHead>ক্রম</TableHead><TableHead>অবস্থা</TableHead><TableHead className="w-[100px] text-right">অ্যাকশন</TableHead></TableRow></TableHeader>
            <TableBody>
              {materialTypes.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">কোনো ম্যাটেরিয়াল টাইপ নেই</TableCell></TableRow>
              ) : materialTypes.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.displayOrder ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={t.status === "সক্রিয়"} onCheckedChange={() => toggleStatus(t)} />
                      <Badge variant="outline" className={t.status === "সক্রিয়" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>{t.status}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">ডুপ্লিকেট বিতরণ নীতি</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">একই শিক্ষার্থীকে একই ম্যাটেরিয়াল আবার দেওয়ার চেষ্টা করলে সিস্টেম কী করবে তা নির্ধারণ করুন।</p>
          <Select value={materialSettings.duplicateDistributionRule} onValueChange={(v) => saveRule(v as DuplicateDistributionRule)} disabled={savingRule}>
            <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(RULE_LABELS) as DuplicateDistributionRule[]).map((r) => (
                <SelectItem key={r} value={r}>{RULE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">ডিফল্ট মিনিমাম স্টক</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[200px]">
              <Label>ডিফল্ট মিনিমাম স্টক অ্যালার্ট</Label>
              <Input type="number" value={defaultMinStock} onChange={(e) => setDefaultMinStock(Number(e.target.value) || 0)} />
            </div>
            <Button onClick={saveMinStock} disabled={savingMinStock}>{savingMinStock ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">নতুন ম্যাটেরিয়াল যোগ করার ফর্মে ডিফল্ট মান হিসেবে দেখাবে — বিদ্যমান ম্যাটেরিয়ালে প্রযোজ্য হবে না।</p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "ম্যাটেরিয়াল টাইপ সম্পাদনা" : "নতুন ম্যাটেরিয়াল টাইপ"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="যেমন: Lecture Sheet" /></div>
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
