import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import type { InstitutionSettings } from "@/types/academic";
import { toast } from "sonner";

/**
 * Organization-wide branding/config (Settings §2/§9/§20) — reused by
 * Receipt/PDF/Marksheet/Reports and the public /info + /marksheet pages via
 * GET /public/institution, instead of hard-coding a name/logo per module.
 */
export function InstitutionTab() {
  const [settings, setSettings] = useState<InstitutionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<InstitutionSettings>("/settings/institution")
      .then(setSettings)
      .catch((err) => toast.error(err instanceof ApiClientError ? err.message : "লোড করা যায়নি"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.patch<InstitutionSettings>("/settings/institution", settings);
      setSettings(updated);
      toast.success("সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">লোড হচ্ছে...</div>;
  if (!settings) return <div className="text-sm text-destructive py-8 text-center">সেটিংস লোড করা যায়নি</div>;

  const set = <K extends keyof InstitutionSettings>(key: K, value: InstitutionSettings[K]) =>
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">প্রতিষ্ঠানের তথ্য</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>প্রতিষ্ঠানের নাম</Label><Input value={settings.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div><Label>সংক্ষিপ্ত নাম</Label><Input value={settings.shortName || ""} onChange={(e) => set("shortName", e.target.value)} /></div>
            <div><Label>লোগো URL</Label><Input value={settings.logoUrl || ""} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://..." /></div>
            <div><Label>ফোন</Label><Input value={settings.phone || ""} onChange={(e) => set("phone", e.target.value)} /></div>
            <div><Label>ইমেইল</Label><Input value={settings.email || ""} onChange={(e) => set("email", e.target.value)} /></div>
            <div><Label>ওয়েবসাইট</Label><Input value={settings.website || ""} onChange={(e) => set("website", e.target.value)} /></div>
            <div><Label>ফেসবুক পেইজ</Label><Input value={settings.facebookUrl || ""} onChange={(e) => set("facebookUrl", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>ঠিকানা</Label><Input value={settings.address || ""} onChange={(e) => set("address", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>রেজিস্ট্রেশন/লাইসেন্স তথ্য</Label><Input value={settings.registrationInfo || ""} onChange={(e) => set("registrationInfo", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">লোকাল সেটিংস</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>কারেন্সি চিহ্ন</Label><Input value={settings.currencySymbol} onChange={(e) => set("currencySymbol", e.target.value)} /></div>
          <div><Label>তারিখ ফরম্যাট</Label><Input value={settings.dateFormat} onChange={(e) => set("dateFormat", e.target.value)} placeholder="DD/MM/YYYY" /></div>
          <div><Label>টাইমজোন</Label><Input value={settings.timezone} onChange={(e) => set("timezone", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">রসিদ নম্বর ফরম্যাট</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>প্রিফিক্স</Label><Input value={settings.receipt.prefix} onChange={(e) => set("receipt", { ...settings.receipt, prefix: e.target.value })} /></div>
          <div><Label>সংখ্যার প্যাডিং</Label><Input type="number" value={settings.receipt.numberPadding} onChange={(e) => set("receipt", { ...settings.receipt, numberPadding: Number(e.target.value) || 4 })} /></div>
          <div className="flex items-center justify-between border rounded-lg p-3 self-end">
            <p className="text-sm font-medium">প্রতি বছর রিসেট</p>
            <Switch checked={settings.receipt.resetYearly} onCheckedChange={(v) => set("receipt", { ...settings.receipt, resetYearly: v })} />
          </div>
          <p className="text-xs text-muted-foreground md:col-span-3">
            উদাহরণ: {settings.receipt.prefix}-{settings.receipt.resetYearly ? "২০২৬-" : ""}{"০".repeat(Math.max(0, settings.receipt.numberPadding - 1))}১ — পরিবর্তন শুধু ভবিষ্যতের রসিদে প্রযোজ্য হবে, পুরনো রসিদ নম্বর অপরিবর্তিত থাকবে।
          </p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">প্রিন্ট / পিডিএফ</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>স্বাক্ষরকারীর পদবি</Label><Input value={settings.print.signatureLabel} onChange={(e) => set("print", { ...settings.print, signatureLabel: e.target.value })} /></div>
            <div><Label>কাগজের আকার</Label>
              <Select value={settings.print.paperSize} onValueChange={(v) => set("print", { ...settings.print, paperSize: v as "A4" | "Letter" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="A4">A4</SelectItem><SelectItem value="Letter">Letter</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>ফুটার টেক্সট</Label><Input value={settings.print.footerText || ""} onChange={(e) => set("print", { ...settings.print, footerText: e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <p className="text-sm font-medium">ডকুমেন্টে লোগো দেখান</p>
            <Switch checked={settings.print.showLogoOnDocuments} onCheckedChange={(v) => set("print", { ...settings.print, showLogoOnDocuments: v })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</Button>
      </div>
    </div>
  );
}
