import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAcademic } from "@/contexts/AcademicContext";
import { ApiClientError } from "@/contexts/AuthContext";
import { DEFAULT_PERFORMANCE_RULES, type PerformanceRules } from "@/types/analytics";
import { useUnsavedChanges } from "./unsavedChanges";

/**
 * Thresholds for Student Performance Analytics (Settings → ফলাফল). Saved via
 * the existing PATCH /settings (SETTINGS_MANAGE, audited). Only affects how
 * analytics label students — never a mark, attendance entry or batch.
 */
const FIELDS: { key: keyof PerformanceRules; label: string; hint: string; group: "band" | "trend" | "risk"; min: number; max: number; step?: number }[] = [
  { key: "excellentMin", label: "চমৎকার (≥ %)", hint: "গড় নম্বর এর বেশি হলে চমৎকার", group: "band", min: 0, max: 100 },
  { key: "goodMin", label: "ভালো (≥ %)", hint: "", group: "band", min: 0, max: 100 },
  { key: "averageMin", label: "মোটামুটি (≥ %)", hint: "এর নিচে \"উন্নতি প্রয়োজন\"", group: "band", min: 0, max: 100 },
  { key: "minExams", label: "ন্যূনতম পরীক্ষা", hint: "এর কম হলে \"পর্যাপ্ত তথ্য নেই\"", group: "band", min: 1, max: 20 },
  { key: "trendWindow", label: "ট্রেন্ড উইন্ডো (পরীক্ষা)", hint: "শেষ N বনাম আগের N", group: "trend", min: 2, max: 10 },
  { key: "trendDelta", label: "ট্রেন্ড পরিবর্তন (পয়েন্ট)", hint: "এর বেশি বদলালে উন্নতি/অবনতি", group: "trend", min: 0.5, max: 50, step: 0.5 },
  { key: "lowAttendancePct", label: "কম উপস্থিতি (< %)", hint: "", group: "risk", min: 0, max: 100 },
  { key: "minAttendanceEntries", label: "ন্যূনতম উপস্থিতি দিন", hint: "এর কম দিনের তথ্যে উপস্থিতি বিচার হবে না", group: "risk", min: 1, max: 100 },
  { key: "riskLookback", label: "শেষ কয়টি পরীক্ষা দেখা হবে", hint: "", group: "risk", min: 2, max: 20 },
  { key: "riskFailCount", label: "ফেলের সংখ্যা (≥)", hint: "ন্যূনতম ২ — একটি কম নম্বরে কখনো নয়", group: "risk", min: 2, max: 20 },
  { key: "riskAbsentCount", label: "অনুপস্থিতির সংখ্যা (≥)", hint: "", group: "risk", min: 1, max: 20 },
  { key: "riskDeclineDelta", label: "অবনতি (≥ পয়েন্ট)", hint: "এত পয়েন্ট কমলে ঝুঁকি", group: "risk", min: 1, max: 100 },
];

const GROUPS: { key: "band" | "trend" | "risk"; label: string }[] = [
  { key: "band", label: "পারফরম্যান্স শ্রেণি" },
  { key: "trend", label: "ট্রেন্ড" },
  { key: "risk", label: "ঝুঁকি নির্ণয় (যেকোনো একটি হলে)" },
];

export function PerformanceRulesCard() {
  const { settings, updateSettings } = useAcademic();
  const saved = useMemo<PerformanceRules>(() => ({ ...DEFAULT_PERFORMANCE_RULES, ...(settings.performanceRules ?? {}) }), [settings.performanceRules]);
  const [form, setForm] = useState<PerformanceRules>(saved);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(saved), [saved]);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedChanges("performance-rules", dirty);

  const error = (() => {
    for (const f of FIELDS) {
      const v = form[f.key];
      if (!Number.isFinite(v) || v < f.min || v > f.max) return `${f.label}: ${f.min}–${f.max} এর মধ্যে দিন`;
    }
    if (!(form.excellentMin > form.goodMin && form.goodMin > form.averageMin)) return "চমৎকার > ভালো > মোটামুটি — এই ক্রম রাখতে হবে";
    if (form.riskFailCount > form.riskLookback || form.riskAbsentCount > form.riskLookback) return "ফেল/অনুপস্থিতির সংখ্যা দেখা পরীক্ষার সংখ্যার বেশি হতে পারবে না";
    return null;
  })();

  const save = async () => {
    if (error) { toast.error(error); return; }
    setSaving(true);
    try {
      await updateSettings({ performanceRules: form });
      toast.success("অ্যানালিটিক্সের নিয়ম সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" aria-hidden />পারফরম্যান্স অ্যানালিটিক্সের নিয়ম</CardTitle>
        <CardDescription>শুধু অ্যানালিটিক্সে শিক্ষার্থীকে কীভাবে চিহ্নিত করা হবে তা ঠিক করে — কোনো নম্বর, উপস্থিতি বা ব্যাচ বদলায় না।</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {GROUPS.map((g) => (
          <fieldset key={g.key} className="space-y-2">
            <legend className="text-sm font-medium">{g.label}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.filter((f) => f.group === g.key).map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label htmlFor={`pr-${f.key}`} className="text-xs">{f.label}</Label>
                  <Input id={`pr-${f.key}`} type="number" min={f.min} max={f.max} step={f.step ?? 1} value={Number.isFinite(form[f.key]) ? form[f.key] : ""} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value === "" ? NaN : Number(e.target.value) }))} />
                  {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && error && <span className="mr-auto text-sm text-destructive">{error}</span>}
          {dirty && !error && <span className="mr-auto text-sm text-warning">অসংরক্ষিত পরিবর্তন আছে</span>}
          <Button variant="ghost" disabled={saving || JSON.stringify(form) === JSON.stringify(DEFAULT_PERFORMANCE_RULES)} onClick={() => setForm(DEFAULT_PERFORMANCE_RULES)}>ডিফল্ট মান</Button>
          <Button variant="outline" disabled={!dirty || saving} onClick={() => setForm(saved)}>বাতিল</Button>
          <Button disabled={!dirty || saving || !!error} onClick={save}>{saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
