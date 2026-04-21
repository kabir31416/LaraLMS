import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademic } from "@/contexts/AcademicContext";
import { toast } from "sonner";

export function OtherSettingsTab() {
  const { settings, sessions, updateSettings } = useAcademic();
  return (
    <Card className="border-none shadow-sm max-w-2xl">
      <CardHeader><CardTitle className="text-base">গুরুত্বপূর্ণ সেটিংস</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>ডিফল্ট সেশন</Label>
          <Select value={settings.defaultSessionId || ""} onValueChange={(v) => { updateSettings({ defaultSessionId: v }); toast.success("সংরক্ষিত"); }}>
            <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
            <SelectContent>{sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>এক্সাম ডিফল্ট সময়কাল (মিনিট)</Label>
            <Input type="number" value={settings.defaultExamDuration}
              onChange={(e) => updateSettings({ defaultExamDuration: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label>পাসিং পার্সেন্টেজ (%)</Label>
            <Input type="number" value={settings.passingPercentage}
              onChange={(e) => updateSettings({ passingPercentage: Number(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="flex items-center justify-between border rounded-lg p-3">
          <div><p className="font-medium text-sm">প্রশ্ন এলোমেলো (Shuffle)</p><p className="text-xs text-muted-foreground">এক্সাম শুরুর সময় প্রশ্নের ক্রম এলোমেলো হবে</p></div>
          <Switch checked={settings.shuffleQuestions} onCheckedChange={(v) => updateSettings({ shuffleQuestions: v })} />
        </div>
        <div className="flex items-center justify-between border rounded-lg p-3">
          <div><p className="font-medium text-sm">ফলাফল প্রকাশ (Publish)</p><p className="text-xs text-muted-foreground">এক্সাম শেষে ফলাফল স্বয়ংক্রিয় প্রকাশ হবে</p></div>
          <Switch checked={settings.publishResults} onCheckedChange={(v) => updateSettings({ publishResults: v })} />
        </div>
      </CardContent>
    </Card>
  );
}
