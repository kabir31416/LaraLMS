import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import type { GradeBand } from "@/types/academic";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

/**
 * Result Configuration (Settings §12) — passing percentage and the Grade
 * System table. This is the one place the Grade System is edited; the
 * public /marksheet feature and (via src/lib/grading.ts) internal result
 * views both read the same Settings.gradeScale rather than each keeping
 * their own copy.
 */
export function ResultSettingsTab() {
  const { settings, updateSettings } = useAcademic();
  const [passingPercentage, setPassingPercentage] = useState(settings.passingPercentage);
  const [defaultExamDuration, setDefaultExamDuration] = useState(settings.defaultExamDuration);
  const [gradeScale, setGradeScale] = useState<GradeBand[]>(settings.gradeScale.length ? settings.gradeScale : [{ minPercent: 0, grade: "F" }]);
  const [saving, setSaving] = useState(false);

  const save = async (extra?: Partial<typeof settings>) => {
    setSaving(true);
    try {
      await updateSettings({
        passingPercentage: Number(passingPercentage) || 0,
        defaultExamDuration: Number(defaultExamDuration) || 0,
        gradeScale,
        ...extra,
      });
      toast.success("সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const updateBand = (i: number, patch: Partial<GradeBand>) =>
    setGradeScale((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const addBand = () => setGradeScale((prev) => [...prev, { minPercent: 0, grade: "" }]);
  const removeBand = (i: number) => setGradeScale((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">ফলাফল কনফিগারেশন</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>পাসিং পার্সেন্টেজ (%)</Label>
              <Input type="number" value={passingPercentage} onChange={(e) => setPassingPercentage(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label>এক্সাম ডিফল্ট সময়কাল (মিনিট)</Label>
              <Input type="number" value={defaultExamDuration} onChange={(e) => setDefaultExamDuration(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div><p className="font-medium text-sm">প্রশ্ন এলোমেলো (Shuffle)</p><p className="text-xs text-muted-foreground">এক্সাম শুরুর সময় প্রশ্নের ক্রম এলোমেলো হবে</p></div>
            <Switch checked={settings.shuffleQuestions} onCheckedChange={(v) => save({ shuffleQuestions: v })} />
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div><p className="font-medium text-sm">ফলাফল প্রকাশ (Publish)</p><p className="text-xs text-muted-foreground">এক্সাম শেষে ফলাফল স্বয়ংক্রিয় প্রকাশ হবে</p></div>
            <Switch checked={settings.publishResults} onCheckedChange={(v) => save({ publishResults: v })} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">গ্রেড সিস্টেম</CardTitle>
          <Button size="sm" variant="outline" onClick={addBand}><Plus className="mr-1 h-4 w-4" /> নতুন গ্রেড</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_40px] gap-2 text-xs text-muted-foreground px-1">
            <span>সর্বনিম্ন শতাংশ</span><span>গ্রেড</span><span />
          </div>
          {gradeScale.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_40px] gap-2 items-center">
              <Input type="number" value={b.minPercent} onChange={(e) => updateBand(i, { minPercent: Number(e.target.value) || 0 })} />
              <Input value={b.grade} onChange={(e) => updateBand(i, { grade: e.target.value })} placeholder="A+" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeBand(i)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">সর্বোচ্চ মিলে যাওয়া সর্বনিম্ন শতাংশের গ্রেড প্রয়োগ হয় — যেমন ৮০+ হলে A+, ৭০-৭৯ হলে A।</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save()} disabled={saving}>{saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</Button>
      </div>
    </div>
  );
}
