import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademic } from "@/contexts/AcademicContext";
import { useMaterials } from "@/contexts/MaterialContext";
import type { Material } from "@/types/material";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editMaterial?: Material | null;
  onSaved?: () => void;
}

const EMPTY_FORM = {
  name: "",
  materialType: "",
  courseId: "",
  subjectId: "none",
  isPaid: false,
  price: 0,
  openingStock: 0,
  minimumStock: 0,
  description: "",
};

/** Add/Edit Material (§1) — opening stock is only editable while creating; afterward, stock changes only happen through Add Stock / Adjustment so every change stays auditable. */
export function MaterialFormDialog({ open, onOpenChange, editMaterial, onSaved }: Props) {
  const { activeCourses, subjects } = useAcademic();
  const { activeMaterialTypes, addMaterial, updateMaterial, materialSettings } = useMaterials();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editMaterial) {
      setForm({
        name: editMaterial.name,
        materialType: editMaterial.materialType,
        courseId: editMaterial.courseId,
        subjectId: editMaterial.subjectId || "none",
        isPaid: editMaterial.isPaid,
        price: editMaterial.price,
        openingStock: editMaterial.openingStock,
        minimumStock: editMaterial.minimumStock,
        description: editMaterial.description || "",
      });
    } else {
      setForm({ ...EMPTY_FORM, minimumStock: materialSettings.defaultMinimumStock });
    }
  }, [open, editMaterial, materialSettings.defaultMinimumStock]);

  const subjectsForCourse = subjects.filter((s) => s.courseId === form.courseId);

  const submit = async () => {
    if (!form.name.trim()) { toast.error("নাম আবশ্যক"); return; }
    if (!form.materialType) { toast.error("ম্যাটেরিয়াল টাইপ নির্বাচন করুন"); return; }
    if (!form.courseId) { toast.error("কোর্স নির্বাচন করুন"); return; }
    if (form.isPaid && form.price <= 0) { toast.error("পেইড ম্যাটেরিয়ালের জন্য মূল্য শূন্যের বেশি হতে হবে"); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        materialType: form.materialType,
        courseId: form.courseId,
        subjectId: form.subjectId === "none" ? undefined : form.subjectId,
        isPaid: form.isPaid,
        price: form.isPaid ? form.price : 0,
        openingStock: form.openingStock,
        minimumStock: form.minimumStock,
        description: form.description.trim() || undefined,
      };
      if (editMaterial) {
        await updateMaterial(editMaterial.id, payload);
        toast.success("আপডেট হয়েছে");
      } else {
        await addMaterial(payload);
        toast.success("ম্যাটেরিয়াল যোগ করা হয়েছে");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editMaterial ? "ম্যাটেরিয়াল সম্পাদনা" : "নতুন ম্যাটেরিয়াল"}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>ম্যাটেরিয়ালের নাম *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="যেমন: বাংলা ১ম পত্র Lecture Sheet" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ম্যাটেরিয়াল টাইপ *</Label>
              <Select value={form.materialType} onValueChange={(v) => setForm({ ...form, materialType: v })}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  {activeMaterialTypes.map((t) => (<SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>কোর্স *</Label>
              <Select value={form.courseId} onValueChange={(v) => setForm({ ...form, courseId: v, subjectId: "none" })}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  {activeCourses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>সাবজেক্ট (ঐচ্ছিক)</Label>
            <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })} disabled={!form.courseId}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">নির্দিষ্ট করবেন না</SelectItem>
                {subjectsForCourse.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">পেইড ম্যাটেরিয়াল</p>
              <p className="text-xs text-muted-foreground">বন্ধ থাকলে ফ্রি — মূল্য স্বয়ংক্রিয়ভাবে ০ হবে</p>
            </div>
            <Switch checked={form.isPaid} onCheckedChange={(v) => setForm({ ...form, isPaid: v, price: v ? form.price : 0 })} />
          </div>

          {form.isPaid && (
            <div className="space-y-1.5">
              <Label>মূল্য (৳) *</Label>
              <Input type="number" min={1} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{editMaterial ? "প্রারম্ভিক স্টক" : "প্রারম্ভিক স্টক"}</Label>
              <Input type="number" min={0} value={form.openingStock} onChange={(e) => setForm({ ...form, openingStock: Number(e.target.value) || 0 })} disabled={!!editMaterial} />
              {editMaterial && <p className="text-xs text-muted-foreground">পরিবর্তনের জন্য স্টক ম্যানেজমেন্ট ব্যবহার করুন</p>}
            </div>
            <div className="space-y-1.5">
              <Label>মিনিমাম স্টক অ্যালার্ট</Label>
              <Input type="number" min={0} value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: Number(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>বিবরণ (ঐচ্ছিক)</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "সংরক্ষণ হচ্ছে..." : editMaterial ? "আপডেট" : "যোগ করুন"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
