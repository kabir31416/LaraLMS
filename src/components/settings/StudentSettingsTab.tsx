import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademic } from "@/contexts/AcademicContext";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

/**
 * Student Configuration (Settings §7). Roll uniqueness scope is the one
 * rule that's genuinely a global toggle today; the Admin-controlled vs
 * Student-editable field split is already enforced field-by-field in the
 * backend's Zod schemas (student.validation.ts) rather than being
 * data-driven, so it's documented here rather than duplicated as a second,
 * competing permission system.
 */
export function StudentSettingsTab() {
  const { settings, updateSettings } = useAcademic();

  const save = async (rollNumberScope: "batch" | "course" | "global") => {
    try {
      await updateSettings({ rollNumberScope });
      toast.success("সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">রোল নম্বর নিয়ম</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Label>রোল নম্বর ইউনিক হবে যে পরিসরে</Label>
          <Select value={settings.rollNumberScope} onValueChange={(v) => save(v as "batch" | "course" | "global")}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="batch">ব্যাচ অনুযায়ী</SelectItem>
              <SelectItem value="course">কোর্স অনুযায়ী</SelectItem>
              <SelectItem value="global">সম্পূর্ণ প্রতিষ্ঠান জুড়ে</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground pt-1">নতুন ভর্তি বা রোল পরিবর্তনের সময় এই পরিসরে অন্য কোনো শিক্ষার্থীর একই রোল থাকলে সংরক্ষণ ব্যর্থ হবে।</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">ফিল্ড মালিকানা</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">অ্যাডমিন-নিয়ন্ত্রিত:</span> রেজিস্ট্রেশন নম্বর, রোল, নাম, জন্ম তারিখ, শিক্ষার্থীর মোবাইল, অভিভাবকের মোবাইল, রক্তের গ্রুপ, কোর্স।</p>
          <p><span className="font-medium text-foreground">শিক্ষার্থী-সম্পাদনযোগ্য:</span> ছবি, ঠিকানা, অভিভাবকের নাম/সম্পর্ক/পেশা, HSC ও SSC তথ্য।</p>
          <p className="text-xs pt-1">এই বিভাজন ব্যাকএন্ডে (student.validation.ts) কার্যকর করা আছে — শিক্ষার্থী পোর্টাল থেকে অ্যাডমিন-নিয়ন্ত্রিত ফিল্ড পরিবর্তনের কোনো উপায় নেই।</p>
        </CardContent>
      </Card>
    </div>
  );
}
