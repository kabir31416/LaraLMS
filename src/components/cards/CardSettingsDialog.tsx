import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Palette } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { FitCard, IdCardBack, IdCardFront } from "./CardDesigns";
import type { CardInstitution, CardSettings, CardStudent } from "@/types/cards";

const SWATCHES = ["#1e3a8a", "#1d4ed8", "#0f766e", "#15803d", "#7c2d12", "#9f1239", "#6d28d9", "#0f172a"];

/** Design options for ID/admit cards — institution name/logo/contact always come from Institution Settings. */
export function CardSettingsDialog({ open, onOpenChange, settings, institution, sample, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: CardSettings;
  institution: CardInstitution;
  sample: CardStudent | null;
  onSaved: (s: CardSettings) => void;
}) {
  const [f, setF] = useState<CardSettings>(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setF(settings); }, [open, settings]);
  const set = <K extends keyof CardSettings>(k: K, v: CardSettings[K]) => setF((p) => ({ ...p, [k]: v }));
  const student: CardStudent = sample ?? { id: "sample", name: "নমুনা শিক্ষার্থী", studentId: "LMS-01001", registrationNumber: "101", photo: null, phone: "01700000000", bloodGroup: "B+", courseId: null, course: "HSC একাডেমিক", batchId: null, batch: "ব্যাচ A", session: "২০২৬-২৭", sessionEnd: "2026-12-31", emergencyContact: "01800000000", status: "সক্রিয়" };
  const validUntil = f.validityMode === "date" ? f.validUntil : f.validityMode === "session" ? student.sessionEnd : null;
  const widthMm = f.idCardLayout === "portrait" ? 53.98 : 85.6;

  const save = async () => {
    if (f.validityMode === "date" && !f.validUntil) { toast.error("মেয়াদের তারিখ দিন"); return; }
    setSaving(true);
    try {
      const { primaryColor, idCardLayout, idCardShowBack, validityMode, validUntil: vu, idCardRules, idCardShowEmergencyContact, idCardShowQr, admitShowQr, admitDefaultInstructions, admitCardsPerPage } = f;
      const saved = await api.patch<CardSettings>("/id-cards/settings", { primaryColor, idCardLayout, idCardShowBack, validityMode, validUntil: vu || "", idCardRules, idCardShowEmergencyContact, idCardShowQr, admitShowQr, admitDefaultInstructions, admitCardsPerPage });
      onSaved(saved);
      toast.success("কার্ডের ডিজাইন সেটিংস সংরক্ষিত হয়েছে");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ করা যায়নি");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" aria-hidden />কার্ডের ডিজাইন সেটিংস</DialogTitle>
          <DialogDescription>প্রতিষ্ঠানের নাম, লোগো, ঠিকানা ও যোগাযোগ “সেটিংস → প্রতিষ্ঠান” থেকে আসে। এখানে রং, লেআউট ও কার্ডের অন্যান্য অপশন।</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>ব্র্যান্ড রং</Label>
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((c) => (
                  <button key={c} type="button" onClick={() => set("primaryColor", c)} aria-label={`রং ${c}`} className={cn("h-8 w-8 rounded-full border-2 transition-transform hover:scale-110", f.primaryColor.toLowerCase() === c ? "border-foreground" : "border-transparent")} style={{ background: c }} />
                ))}
                <Input type="color" value={f.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} className="h-9 w-14 cursor-pointer p-1" aria-label="নিজস্ব রং" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>আইডি কার্ডের লেআউট</Label>
              <RadioGroup value={f.idCardLayout} onValueChange={(v) => set("idCardLayout", v as CardSettings["idCardLayout"])} className="grid grid-cols-2 gap-2">
                {([["landscape", "আড়াআড়ি (Landscape)"], ["portrait", "খাড়া (Portrait)"]] as const).map(([v, l]) => (
                  <Label key={v} htmlFor={`lay-${v}`} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-normal", f.idCardLayout === v && "border-primary bg-primary/5")}><RadioGroupItem id={`lay-${v}`} value={v} />{l}</Label>
                ))}
              </RadioGroup>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>মেয়াদ</Label>
                <Select value={f.validityMode} onValueChange={(v) => set("validityMode", v as CardSettings["validityMode"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="session">কোর্সের সেশন শেষ পর্যন্ত</SelectItem>
                    <SelectItem value="date">নির্দিষ্ট তারিখ পর্যন্ত</SelectItem>
                    <SelectItem value="none">মেয়াদ দেখাবেন না</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {f.validityMode === "date" && (
                <div className="space-y-1.5"><Label htmlFor="cs-valid">মেয়াদ শেষের তারিখ</Label><Input id="cs-valid" type="date" value={f.validUntil ?? ""} onChange={(e) => set("validUntil", e.target.value)} /></div>
              )}
            </div>
            <div className="space-y-3 rounded-lg border p-3">
              {([
                ["idCardShowBack", "কার্ডের পিছনের দিক প্রিন্ট করুন", "যোগাযোগ, নিয়মাবলি, জরুরি যোগাযোগ ও QR"],
                ["idCardShowQr", "আইডি কার্ডে QR কোড", "স্ক্যান করলে শুধু নাম, আইডি, কোর্স ও ব্যাচ যাচাই হয় — ফোন/ঠিকানা নয়"],
                ["idCardShowEmergencyContact", "জরুরি যোগাযোগ (অভিভাবকের মোবাইল)", "শুধু পিছনের দিকে প্রিন্ট হয়"],
                ["admitShowQr", "অ্যাডমিট কার্ডে QR কোড", "পরীক্ষার হলে কার্ড যাচাইয়ের জন্য"],
              ] as const).map(([k, l, h]) => (
                <div key={k} className="flex items-start justify-between gap-3">
                  <Label htmlFor={`cs-${k}`} className="font-normal leading-snug">{l}<span className="block text-xs text-muted-foreground">{h}</span></Label>
                  <Switch id={`cs-${k}`} checked={f[k]} onCheckedChange={(v) => set(k, v)} />
                </div>
              ))}
            </div>
            <div className="space-y-1.5"><Label htmlFor="cs-rules">কার্ডের নিয়মাবলি (প্রতি লাইনে একটি)</Label><Textarea id="cs-rules" rows={3} value={f.idCardRules} onChange={(e) => set("idCardRules", e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="cs-ins">নতুন পরীক্ষার ডিফল্ট নির্দেশনা (প্রতি লাইনে একটি)</Label><Textarea id="cs-ins" rows={3} value={f.admitDefaultInstructions} onChange={(e) => set("admitDefaultInstructions", e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>অ্যাডমিট কার্ড প্রতি পৃষ্ঠায়</Label>
              <Select value={String(f.admitCardsPerPage)} onValueChange={(v) => set("admitCardsPerPage", Number(v) as 1 | 2)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">১টি (পূর্ণ A4 — ডিফল্ট)</SelectItem><SelectItem value="2">২টি (অর্ধেক A4)</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
            <p className="text-sm font-medium">লাইভ প্রিভিউ</p>
            <div className="space-y-3 rounded-xl bg-muted/50 p-4">
              <FitCard widthMm={widthMm} maxScale={f.idCardLayout === "portrait" ? 1.1 : 1.4}><IdCardFront student={student} institution={institution} settings={f} validUntil={validUntil} /></FitCard>
              {f.idCardShowBack && <FitCard widthMm={widthMm} maxScale={f.idCardLayout === "portrait" ? 1.1 : 1.4}><IdCardBack student={student} institution={institution} settings={f} /></FitCard>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>বাতিল</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}সংরক্ষণ করুন</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
