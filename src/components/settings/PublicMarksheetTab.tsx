import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import type { PublicResultsSettings } from "@/types/academic";
import { toast } from "sonner";

/**
 * Public Marksheet Settings (Settings §19) — mirrors PublicInfoTab.tsx's
 * pattern exactly for the /marksheet feature. `visibleFields` is
 * server-side allowlisted (PUBLIC_RESULTS_ALLOWED_FIELDS) — marks/
 * percentage/grade are the feature's own purpose and are never gated here,
 * and phone/guardian/address/payment were never part of the DTO to begin
 * with, so they can't be toggled on even by mistake.
 */
const ALLOWED_FIELDS: { key: string; label: string }[] = [
  { key: "photo", label: "শিক্ষার্থীর ছবি" },
  { key: "registrationId", label: "আইডি" },
  { key: "course", label: "কোর্স" },
  { key: "batch", label: "ব্যাচ" },
  { key: "rank", label: "অবস্থান (Top 3)" },
];

export function PublicMarksheetTab() {
  const [settings, setSettings] = useState<PublicResultsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<PublicResultsSettings>("/settings/public-results")
      .then(setSettings)
      .catch((err) => toast.error(err instanceof ApiClientError ? err.message : "লোড করা যায়নি"))
      .finally(() => setLoading(false));
  }, []);

  const save = async (patch: Partial<PublicResultsSettings>) => {
    if (!settings) return;
    const prev = settings;
    setSettings({ ...settings, ...patch });
    setSaving(true);
    try {
      await api.patch("/settings/public-results", patch);
    } catch (err) {
      setSettings(prev);
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const toggleField = (key: string) => {
    if (!settings) return;
    const has = settings.visibleFields.includes(key);
    save({ visibleFields: has ? settings.visibleFields.filter((f) => f !== key) : [...settings.visibleFields, key] });
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">লোড হচ্ছে...</div>;
  if (!settings) return <div className="text-sm text-destructive py-8 text-center">সেটিংস লোড করা যায়নি</div>;

  return (
    <Card className="border-none shadow-sm max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">পাবলিক মার্কশিট (/marksheet)</CardTitle>
        <p className="text-xs text-muted-foreground">লগইন ছাড়াই যে কেউ রেজিস্ট্রেশন নম্বর দিয়ে ফলাফল দেখতে পারবে — নিচে নিয়ন্ত্রণ করুন</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between border rounded-lg p-3">
          <div>
            <p className="font-medium text-sm">সম্পূর্ণ সুবিধা সক্রিয়</p>
            <p className="text-xs text-muted-foreground">বন্ধ থাকলে /marksheet পেইজ থেকে কোনো ফলাফল দেখা যাবে না</p>
          </div>
          <Switch checked={settings.enabled} disabled={saving} onCheckedChange={(v) => save({ enabled: v })} />
        </div>
        <div className="flex items-center justify-between border rounded-lg p-3">
          <p className="text-sm font-medium">ব্যক্তিগত ফলাফল</p>
          <Switch checked={settings.individualEnabled} disabled={saving} onCheckedChange={(v) => save({ individualEnabled: v })} />
        </div>
        <div className="flex items-center justify-between border rounded-lg p-3">
          <p className="text-sm font-medium">ব্যাচ ভিত্তিক ফলাফল</p>
          <Switch checked={settings.batchEnabled} disabled={saving} onCheckedChange={(v) => save({ batchEnabled: v })} />
        </div>
        <div className="flex items-center justify-between border rounded-lg p-3">
          <div>
            <p className="font-medium text-sm">শুধু প্রকাশিত ফলাফল দেখাবে</p>
            <p className="text-xs text-muted-foreground">বন্ধ করলে অপ্রকাশিত এক্সামও পাবলিকভাবে দেখা যাবে — সুপারিশ করা হয় না</p>
          </div>
          <Switch checked={settings.requirePublished} disabled={saving} onCheckedChange={(v) => save({ requirePublished: v })} />
        </div>

        <div className="space-y-2">
          <Label>অতিরিক্ত যা দেখা যাবে</Label>
          <div className="grid grid-cols-2 gap-2 border rounded-lg p-3">
            {ALLOWED_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={settings.visibleFields.includes(f.key)} onCheckedChange={() => toggleField(f.key)} />
                {f.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">নাম, রোল, নম্বর, শতাংশ ও গ্রেড সবসময় দেখা যাবে — এগুলো এই ফিচারের মূল উদ্দেশ্য। মোবাইল, ঠিকানা, পেমেন্ট তথ্য কখনোই পাবলিক করা যাবে না।</p>
        </div>
      </CardContent>
    </Card>
  );
}
