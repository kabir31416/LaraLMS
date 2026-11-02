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
import {
  effectiveProration, errMsg, MEMBERSHIP_STATUS_LABELS, PRORATION_MODE_LABELS, SMS_EVENT_LABELS, SMS_PLACEHOLDERS, SMS_STATUS_LABELS,
  type MessSettings, type MessSmsEvent, type ProrationMode,
} from "@/lib/mess";

const SMS_TOGGLE: Record<MessSmsEvent, "paymentSmsEnabled" | "billSmsEnabled" | "dueReminderSmsEnabled" | "admissionSmsEnabled" | "checkoutSmsEnabled"> = {
  payment: "paymentSmsEnabled",
  bill: "billSmsEnabled",
  dueReminder: "dueReminderSmsEnabled",
  admission: "admissionSmsEnabled",
  checkout: "checkoutSmsEnabled",
};
const SMS_HINT: Record<MessSmsEvent, string> = {
  payment: "পেমেন্ট নেওয়ার পর শিক্ষার্থীর মোবাইলে",
  bill: "মাসিক বিল তৈরি হলে (স্বয়ংক্রিয় ও ম্যানুয়াল)",
  dueReminder: "প্রতি মাসের পরিশোধের শেষ দিনে বকেয়া থাকলে (মাসে একবার)",
  admission: "ভর্তির প্রারম্ভিক পেমেন্টের পর",
  checkout: "চেক-আউট / চূড়ান্ত হিসাব সম্পন্ন হলে",
};

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
  const [smsEvent, setSmsEvent] = useState<MessSmsEvent>("payment");
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; status: string; errorMessage?: string; message?: string } | null>(null);
  useEffect(() => {
    if (!settings) return;
    setF({ ...settings, prorationMode: effectiveProration(settings) });
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
        defaultRent: Number(f.defaultRent), defaultDeposit: Number(f.defaultDeposit), defaultDiningCharge: Number(f.defaultDiningCharge ?? 0),
        receiptPrefix: f.receiptPrefix, billPrefix: f.billPrefix,
        lateFeeEnabled: f.lateFeeEnabled, lateFeeAmount: Number(f.lateFeeAmount),
        prorationMode: f.prorationMode, autoBillingEnabled: f.autoBillingEnabled,
        billSmsEnabled: f.billSmsEnabled, dueReminderSmsEnabled: f.dueReminderSmsEnabled, admissionSmsEnabled: f.admissionSmsEnabled, checkoutSmsEnabled: f.checkoutSmsEnabled,
        smsTemplates: f.smsTemplates,
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
  const template = f.smsTemplates?.[smsEvent] ?? "";
  const setTemplate = (v: string) => setF({ ...f, smsTemplates: { ...f.smsTemplates, [smsEvent]: v } });
  const sendTest = async () => {
    if (!testPhone.trim()) { toast.error("মোবাইল নম্বর লিখুন"); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post<{ ok: boolean; status: string; errorMessage?: string; message?: string }>("/mess/sms/test", { phone: testPhone.trim(), event: smsEvent, template });
      setTestResult(r);
      if (r.ok) toast.success("প্রোভাইডার SMS গ্রহণ করেছে"); else toast.error(r.errorMessage || "SMS পাঠানো যায়নি");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setTesting(false);
    }
  };
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
            <div className="space-y-1.5"><Label>ডিফল্ট মাসিক সিট ভাড়া (৳)</Label><Input type="number" min={0} value={f.defaultRent} onChange={(e) => set("defaultRent", Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>ডিফল্ট ডাইনিং চার্জ — একবার (৳)</Label><Input type="number" min={0} value={f.defaultDiningCharge ?? 0} onChange={(e) => set("defaultDiningCharge", Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>ডিফল্ট এক মাসের অগ্রিম (৳)</Label><Input type="number" min={0} value={f.defaultDeposit} onChange={(e) => set("defaultDeposit", Number(e.target.value))} /><p className="text-[11px] text-muted-foreground">০ = সিটের এক মাসের ভাড়া</p></div>
            <div className="space-y-1.5"><Label>রসিদ প্রিফিক্স</Label><Input value={f.receiptPrefix} onChange={(e) => set("receiptPrefix", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>বিল প্রিফিক্স</Label><Input value={f.billPrefix} onChange={(e) => set("billPrefix", e.target.value)} /></div>
            <div className="col-span-2">
              <Toggle
                label="স্বয়ংক্রিয় মাসিক বিল"
                hint={`প্রতি মাসের ${f.billingDay} তারিখে (বাংলাদেশ সময়) সার্ভার নিজেই সব সক্রিয় সদস্যের বিল ও বকেয়া তৈরি করে — কেউ পেজ না খুললেও। একই মাসে দুইবার বিল হয় না। মেস সেটআপে প্রতিটি মেসের নিজস্ব দিন দেওয়া যায়।`}
                checked={f.autoBillingEnabled}
                onChange={(v) => set("autoBillingEnabled", v)}
              />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">পরিবর্তন শুধু ভবিষ্যতের ভর্তি, বিল ও SMS-এ প্রযোজ্য — আগে তৈরি বিল বদলায় না। প্রতিটি পরিবর্তন অডিট লগে থাকে।</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">আর্থিক নিয়ম</CardTitle><CardDescription>বিলম্ব ফি ডিফল্টভাবে বন্ধ</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Toggle label="বিলম্ব ফি চালু" hint="গ্রেস পিরিয়ড পেরোনো অপরিশোধিত বিল থাকলে পরবর্তী বিলে নির্দিষ্ট ফি যুক্ত হবে" checked={f.lateFeeEnabled} onChange={(v) => set("lateFeeEnabled", v)} />
            {f.lateFeeEnabled && <div className="space-y-1.5"><Label>বিলম্ব ফি (৳)</Label><Input type="number" min={0} value={f.lateFeeAmount} onChange={(e) => set("lateFeeAmount", Number(e.target.value))} /></div>}
            <div className="space-y-1.5">
              <Label>মাসের মাঝখানে যোগদান করলে যোগদানের মাসের ভাড়া</Label>
              <Select value={f.prorationMode ?? "full"} onValueChange={(v) => set("prorationMode", v as ProrationMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(PRORATION_MODE_LABELS) as ProrationMode[]).map((k) => <SelectItem key={k} value={k}>{PRORATION_MODE_LABELS[k]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="border-b pb-3 text-xs text-muted-foreground">মাসিক বিলে শুধু সিট ভাড়া থাকে। ডাইনিং চার্জ ভর্তির সময় একবার নেওয়া হয়; এক মাসের অগ্রিম জমা থাকে এবং চেক-আউটের চূড়ান্ত হিসাবে বকেয়া কেটে বাকিটা ফেরত দেওয়া হয়।</p>
            <Toggle label="ছাড়/সমন্বয়ে অনুমোদন প্রয়োজন" hint="চালু থাকলে শুধু আর্থিক অনুমোদনকারী ছাড় বা বিল সমন্বয় দিতে পারবেন" checked={f.discountApprovalRequired} onChange={(v) => set("discountApprovalRequired", v)} />
            <Toggle label="অগ্রিম ফেরতে অনুমোদন প্রয়োজন" checked={f.refundApprovalRequired} onChange={(v) => set("refundApprovalRequired", v)} />
            <Toggle label="খরচে অনুমোদন প্রয়োজন" checked={f.expenseApprovalRequired} onChange={(v) => set("expenseApprovalRequired", v)} />
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
          <CardHeader>
            <CardTitle className="text-base">মেস SMS</CardTitle>
            <CardDescription>শিক্ষার্থীর নিজের মোবাইলে যায়। প্রোভাইডার (BulkSMSBD / Alpha) ও API key কেন্দ্রীয় SMS সেটিংসে — এখানে দেখানো হয় না। SMS ব্যর্থ হলেও পেমেন্ট/বিল বহাল থাকে; একই ঘটনায় দুইবার SMS যায় না।</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              {(Object.keys(SMS_TOGGLE) as MessSmsEvent[]).map((e) => (
                <Toggle key={e} label={SMS_EVENT_LABELS[e]} hint={SMS_HINT[e]} checked={!!f[SMS_TOGGLE[e]]} onChange={(v) => set(SMS_TOGGLE[e], v)} />
              ))}
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>টেমপ্লেট</Label>
                <Select value={smsEvent} onValueChange={(v) => { setSmsEvent(v as MessSmsEvent); setTestResult(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(SMS_EVENT_LABELS) as MessSmsEvent[]).map((e) => <SelectItem key={e} value={e}>{SMS_EVENT_LABELS[e]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Textarea rows={4} value={template} onChange={(e) => setTemplate(e.target.value)} maxLength={640} />
              <div className="flex flex-wrap gap-1">
                {SMS_PLACEHOLDERS.map((p) => (
                  <button key={p.key} type="button" className="rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted" title={p.label} onClick={() => setTemplate(`${template}{{${p.key}}}`)}>{`{{${p.key}}}`}</button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{template.length}/640 অক্ষর। অজানা placeholder থাকলে সংরক্ষণ হবে না।</p>
              <div className="rounded-md border p-3 space-y-2">
                <Label>পরীক্ষামূলক SMS (নমুনা মান দিয়ে)</Label>
                <div className="flex gap-2">
                  <Input placeholder="01XXXXXXXXX" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
                  <Button variant="outline" disabled={testing} onClick={sendTest}>{testing ? "পাঠানো হচ্ছে..." : "পাঠান"}</Button>
                </div>
                {testResult && (
                  <p className={`text-xs ${testResult.ok ? "text-success" : "text-destructive"}`}>
                    অবস্থা: {SMS_STATUS_LABELS[testResult.status] ?? testResult.status}{testResult.errorMessage ? ` — ${testResult.errorMessage}` : ""}
                    {testResult.ok && <span className="block text-muted-foreground">"প্রোভাইডার গ্রহণ করেছে" মানে গেটওয়ে নিয়েছে; হ্যান্ডসেটে পৌঁছানো আলাদা (রিপোর্টে ডেলিভারি দেখুন)।</span>}
                  </p>
                )}
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
