import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessPage, useMessScope } from "@/components/mess/MessShell";
import { api } from "@/lib/apiClient";
import { useAcademic } from "@/contexts/AcademicContext";
import { errMsg, MEMBERSHIP_STATUS_LABELS, type MessSettings } from "@/lib/mess";

const LIST_FIELDS: { key: "roomTypes" | "seatTypes" | "expenseCategories" | "complaintCategories" | "maintenanceCategories"; label: string }[] = [
  { key: "roomTypes", label: "রুমের ধরন" },
  { key: "seatTypes", label: "সিটের ধরন" },
  { key: "expenseCategories", label: "খরচের খাত" },
  { key: "complaintCategories", label: "অভিযোগের ক্যাটাগরি" },
  { key: "maintenanceCategories", label: "রক্ষণাবেক্ষণের ক্যাটাগরি" },
];

export default function MessSettingsPage() {
  const { settings, reloadSettings, messes } = useMessScope();
  const { paymentMethods } = useAcademic();
  const [f, setF] = useState<MessSettings | null>(null);
  const [lists, setLists] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!settings) return;
    setF(settings);
    setLists(Object.fromEntries(LIST_FIELDS.map((l) => [l.key, (settings[l.key] ?? []).join("\n")])));
  }, [settings]);
  if (!f) return <MessPage title="মেস সেটিংস" hideMessFilter><p className="text-sm text-muted-foreground">লোড হচ্ছে...</p></MessPage>;
  const set = <K extends keyof MessSettings>(k: K, v: MessSettings[K]) => setF({ ...f, [k]: v });
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        defaultMessId: f.defaultMessId || undefined,
        billingDay: Number(f.billingDay), dueDay: Number(f.dueDay), gracePeriodDays: Number(f.gracePeriodDays),
        defaultRent: Number(f.defaultRent), defaultDeposit: Number(f.defaultDeposit),
        receiptPrefix: f.receiptPrefix, billPrefix: f.billPrefix,
        lateFeeEnabled: f.lateFeeEnabled, lateFeeAmount: Number(f.lateFeeAmount), prorationEnabled: f.prorationEnabled,
        discountApprovalRequired: f.discountApprovalRequired, refundApprovalRequired: f.refundApprovalRequired, expenseApprovalRequired: f.expenseApprovalRequired,
        paymentMethods: f.paymentMethods, paymentSmsEnabled: f.paymentSmsEnabled,
        ...Object.fromEntries(LIST_FIELDS.map((l) => [l.key, (lists[l.key] ?? "").split("\n").map((x) => x.trim()).filter(Boolean)])),
      };
      await api.patch("/mess/settings", body);
      toast.success("মেস সেটিংস সংরক্ষিত হয়েছে");
      await reloadSettings();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  const activeMethods = paymentMethods.filter((m) => m.status === "সক্রিয়");
  return (
    <MessPage title="মেস সেটিংস" subtitle="বিলিং, আর্থিক অনুমোদন ও তালিকা — প্রতিষ্ঠানের তথ্য (রসিদে) কেন্দ্রীয় সেটিংস থেকে আসে" hideMessFilter actions={<Button disabled={busy} onClick={save}>{busy ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</Button>}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">সাধারণ / বিলিং</CardTitle><CardDescription>বিলিং চক্র: মাসিক • মুদ্রা: BDT (৳)</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5"><Label>ডিফল্ট মেস</Label>
              <Select value={f.defaultMessId || "__none"} onValueChange={(v) => set("defaultMessId", v === "__none" ? undefined : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__none">—</SelectItem>{messes.map((m) => <SelectItem key={m._id} value={m._id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>বিল ইস্যুর দিন (১-২৮)</Label><Input type="number" min={1} max={28} value={f.billingDay} onChange={(e) => set("billingDay", Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>পরিশোধের শেষ দিন (১-২৮)</Label><Input type="number" min={1} max={28} value={f.dueDay} onChange={(e) => set("dueDay", Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>গ্রেস পিরিয়ড (দিন)</Label><Input type="number" min={0} value={f.gracePeriodDays} onChange={(e) => set("gracePeriodDays", Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>ডিফল্ট ভাড়া (৳)</Label><Input type="number" min={0} value={f.defaultRent} onChange={(e) => set("defaultRent", Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>ডিফল্ট জামানত (৳)</Label><Input type="number" min={0} value={f.defaultDeposit} onChange={(e) => set("defaultDeposit", Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>রসিদ প্রিফিক্স</Label><Input value={f.receiptPrefix} onChange={(e) => set("receiptPrefix", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>বিল প্রিফিক্স</Label><Input value={f.billPrefix} onChange={(e) => set("billPrefix", e.target.value)} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">আর্থিক নিয়ম</CardTitle><CardDescription>বিলম্ব ফি ও আংশিক মাসের ভাড়া ডিফল্টভাবে বন্ধ</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Toggle label="বিলম্ব ফি চালু" hint="গ্রেস পিরিয়ড পেরোনো অপরিশোধিত বিল থাকলে পরবর্তী বিলে নির্দিষ্ট ফি যুক্ত হবে" checked={f.lateFeeEnabled} onChange={(v) => set("lateFeeEnabled", v)} />
            {f.lateFeeEnabled && <div className="space-y-1.5"><Label>বিলম্ব ফি (৳)</Label><Input type="number" min={0} value={f.lateFeeAmount} onChange={(e) => set("lateFeeAmount", Number(e.target.value))} /></div>}
            <Toggle label="আংশিক মাসের ভাড়া (প্রোরেশন)" hint="মাসের মাঝখানে বিলিং শুরু হলে প্রথম বিলে দিন অনুযায়ী ভাড়া" checked={f.prorationEnabled} onChange={(v) => set("prorationEnabled", v)} />
            <Toggle label="ছাড়/সমন্বয়ে অনুমোদন প্রয়োজন" hint="চালু থাকলে শুধু আর্থিক অনুমোদনকারী ছাড় বা বিল সমন্বয় দিতে পারবেন" checked={f.discountApprovalRequired} onChange={(v) => set("discountApprovalRequired", v)} />
            <Toggle label="জামানত ফেরতে অনুমোদন প্রয়োজন" checked={f.refundApprovalRequired} onChange={(v) => set("refundApprovalRequired", v)} />
            <Toggle label="খরচে অনুমোদন প্রয়োজন" checked={f.expenseApprovalRequired} onChange={(v) => set("expenseApprovalRequired", v)} />
            <Toggle label="পেমেন্ট নিলে শিক্ষার্থীকে SMS" hint="SMS ব্যর্থ হলেও পেমেন্ট সফল থাকবে" checked={f.paymentSmsEnabled} onChange={(v) => set("paymentSmsEnabled", v)} />
            <div className="space-y-1.5">
              <Label>মেসে ব্যবহারযোগ্য পেমেন্ট পদ্ধতি (কিছু না বাছলে সব সক্রিয় পদ্ধতি)</Label>
              <div className="grid grid-cols-2 gap-1">
                {activeMethods.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={f.paymentMethods.includes(m.name)} onCheckedChange={(v) => set("paymentMethods", v === true ? [...f.paymentMethods, m.name] : f.paymentMethods.filter((x) => x !== m.name))} />{m.name}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">পরিচালনাগত তালিকা</CardTitle><CardDescription>প্রতি লাইনে একটি। আগের রেকর্ডে ব্যবহৃত নাম বদলালে পুরনো রেকর্ড অপরিবর্তিত থাকে।</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LIST_FIELDS.map((l) => (
              <div key={l.key} className="space-y-1.5"><Label>{l.label}</Label><Textarea rows={6} value={lists[l.key] ?? ""} onChange={(e) => setLists({ ...lists, [l.key]: e.target.value })} /></div>
            ))}
            <div className="space-y-1.5">
              <Label>সদস্যপদের অবস্থা (সিস্টেম-নির্ধারিত)</Label>
              <div className="rounded-md border p-2 text-sm space-y-0.5">{Object.values(MEMBERSHIP_STATUS_LABELS).map((s) => <p key={s}>{s}</p>)}</div>
              <p className="text-xs text-muted-foreground">অবস্থাগুলো কর্মপ্রবাহের সাথে যুক্ত, তাই পরিবর্তনযোগ্য নয়। নোটিশের ধরনও নির্দিষ্ট।</p>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="py-4 text-sm text-muted-foreground">মিল ব্যবস্থাপনা (মিল এন্ট্রি, মিল কাউন্ট, মিল রেট, মিল বিলিং) এই সংস্করণে অন্তর্ভুক্ত নয় — ভবিষ্যতে বিলের নতুন আইটেম হিসেবে যুক্ত করার উপযোগী করে কাঠামো রাখা হয়েছে।</CardContent>
        </Card>
      </div>
    </MessPage>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-2">
      <div><p className="text-sm font-medium">{label}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
