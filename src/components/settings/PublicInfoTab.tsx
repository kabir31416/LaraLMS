import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * No-login /info search (Phase 1 §16, Phase 3 Module 27) — this is the
 * admin control panel for it. There was no frontend for PublicInfoSettings
 * before this; the feature existed only as a backend config document
 * defaulting to `enabled: false`, so an admin had no way to turn it on.
 */
const ALLOWED_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "নাম" },
  { key: "registrationId", label: "রেজিস্ট্রেশন আইডি" },
  { key: "rollNumber", label: "রোল নম্বর" },
  { key: "course", label: "কোর্স" },
  { key: "currentBatch", label: "বর্তমান ব্যাচ" },
  { key: "batchDirector", label: "ব্যাচ ডিরেক্টর" },
  { key: "admissionStatus", label: "ভর্তির অবস্থা" },
  { key: "resultSummary", label: "ফলাফল সারাংশ" },
  { key: "attendanceSummary", label: "উপস্থিতির হার" },
  { key: "photo", label: "ছবি" },
];

interface PublicInfoSettings {
  enabled: boolean;
  searchMethods: { registrationId: boolean; phone: boolean; name: boolean };
  visibleFields: string[];
}

export function PublicInfoTab() {
  const [settings, setSettings] = useState<PublicInfoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<PublicInfoSettings>("/settings/public-info")
      .then(setSettings)
      .catch((err) => toast.error(err instanceof ApiClientError ? err.message : "লোড করা যায়নি"))
      .finally(() => setLoading(false));
  }, []);

  const save = async (patch: Partial<PublicInfoSettings>) => {
    if (!settings) return;
    const prev = settings;
    setSettings({ ...settings, ...patch });
    setSaving(true);
    try {
      await api.patch("/settings/public-info", patch);
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
        <CardTitle className="text-base">পাবলিক তথ্য অনুসন্ধান (/info)</CardTitle>
        <p className="text-xs text-muted-foreground">লগইন ছাড়াই যে কেউ শিক্ষার্থীর সীমিত তথ্য খুঁজতে পারবে — নিচে সক্রিয় করুন ও নিয়ন্ত্রণ করুন</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between border rounded-lg p-3">
          <div>
            <p className="font-medium text-sm">সক্রিয় করুন</p>
            <p className="text-xs text-muted-foreground">বন্ধ থাকলে /info পেইজ থেকে কোনো অনুসন্ধান করা যাবে না</p>
          </div>
          <Switch checked={settings.enabled} disabled={saving} onCheckedChange={(v) => save({ enabled: v })} />
        </div>

        <div className="space-y-2">
          <Label>অনুসন্ধান পদ্ধতি</Label>
          <div className="flex flex-wrap gap-4 border rounded-lg p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settings.searchMethods.registrationId}
                onCheckedChange={(v) => save({ searchMethods: { ...settings.searchMethods, registrationId: !!v } })}
              />
              রেজিস্ট্রেশন আইডি
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settings.searchMethods.phone}
                onCheckedChange={(v) => save({ searchMethods: { ...settings.searchMethods, phone: !!v } })}
              />
              মোবাইল নম্বর
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settings.searchMethods.name}
                onCheckedChange={(v) => save({ searchMethods: { ...settings.searchMethods, name: !!v } })}
              />
              নাম (এনুমারেশন-প্রবণ, সতর্কতার সাথে চালু করুন)
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>ফলাফলে যা দেখা যাবে</Label>
          <div className="grid grid-cols-2 gap-2 border rounded-lg p-3">
            {ALLOWED_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={settings.visibleFields.includes(f.key)} onCheckedChange={() => toggleField(f.key)} />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
