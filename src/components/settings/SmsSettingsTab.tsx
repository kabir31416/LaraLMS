import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { useAttendance } from "@/contexts/AttendanceContext";
import { SmsTemplateEditor, type SmsTemplateVariable } from "@/components/settings/sms/SmsTemplateEditor";

/**
 * SMS Provider Upgrade §3/§19 — the Admin SMS Settings section, embedded in
 * the existing Settings page (no separate page). Every write here goes
 * through /sms/* (backend/src/modules/sms), never a hardcoded gateway URL,
 * and the Alpha SMS API key is never fetched or held in full — only
 * `apiKeyConfigured`/`apiKeyMasked` ever cross the network to this page
 * (Security §18).
 */
type SmsProvider = "bulksmsbd" | "alpha";
type SmsEvent = "admission" | "payment" | "birthday" | "result";

interface SmsSettingsApi {
  activeProvider: SmsProvider;
  bulksmsbd: { apiKeyConfigured: boolean; apiKeyMasked?: string; senderId?: string; usingEnvFallback: boolean };
  alpha: { apiKeyConfigured: boolean; apiKeyMasked?: string; senderId?: string; contentId?: string };
  events: Record<SmsEvent, boolean>;
  templates: { admission: string; payment: string; birthday: string };
}

const EVENT_LABELS: { key: SmsEvent; label: string }[] = [
  { key: "admission", label: "ভর্তি SMS" },
  { key: "payment", label: "Payment Receive SMS" },
  { key: "birthday", label: "Birthday SMS" },
  { key: "result", label: "Result SMS" },
];

// Mirrors backend/src/modules/sms/sms.constants.ts's variable lists exactly — never invent a placeholder the backend doesn't actually resolve.
const ADMISSION_VARIABLES: SmsTemplateVariable[] = [
  { key: "studentName", label: "শিক্ষার্থীর নাম" },
  { key: "registrationId", label: "আইডি" },
  { key: "roll", label: "রেজিস্ট্রেশন নম্বর" },
  { key: "courseName", label: "কোর্সের নাম" },
  { key: "batchName", label: "ব্যাচের নাম" },
  { key: "guardianName", label: "অভিভাবকের নাম" },
];
const PAYMENT_VARIABLES: SmsTemplateVariable[] = [
  { key: "studentName", label: "শিক্ষার্থীর নাম" },
  { key: "registrationId", label: "আইডি" },
  { key: "roll", label: "রেজিস্ট্রেশন নম্বর" },
  { key: "courseName", label: "কোর্সের নাম" },
  { key: "paymentAmount", label: "এই পেমেন্টের পরিমাণ" },
  { key: "totalPaid", label: "সর্বমোট পরিশোধিত" },
  { key: "due", label: "বর্তমান বকেয়া" },
  { key: "receiptNo", label: "রসিদ নম্বর" },
];
const BIRTHDAY_VARIABLES: SmsTemplateVariable[] = [
  { key: "studentName", label: "শিক্ষার্থীর নাম" },
  { key: "registrationId", label: "আইডি" },
  { key: "roll", label: "রেজিস্ট্রেশন নম্বর" },
  { key: "courseName", label: "কোর্সের নাম" },
  { key: "guardianName", label: "অভিভাবকের নাম" },
];

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function SmsSettingsTab() {
  const { getResultSmsTemplate, updateResultSmsTemplate } = useAttendance();
  const [settings, setSettings] = useState<SmsSettingsApi | null>(null);
  const [loading, setLoading] = useState(true);

  const [resultTemplate, setResultTemplate] = useState("");
  const [resultVariables, setResultVariables] = useState<SmsTemplateVariable[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [smsSettings, resultCfg] = await Promise.all([
        api.get<SmsSettingsApi>("/sms/settings"),
        getResultSmsTemplate(),
      ]);
      setSettings(smsSettings);
      setResultTemplate(resultCfg.effectiveTemplate);
      setResultVariables(resultCfg.variables);
    } catch (err) {
      toast.error(errMsg(err, "SMS সেটিংস লোড করা যায়নি"));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const [bulkApiKey, setBulkApiKey] = useState("");
  const [bulkSenderId, setBulkSenderId] = useState("");
  const [savingBulk, setSavingBulk] = useState(false);

  const [alphaApiKey, setAlphaApiKey] = useState("");
  const [alphaSenderId, setAlphaSenderId] = useState("");
  const [alphaContentId, setAlphaContentId] = useState("");
  const [savingAlpha, setSavingAlpha] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setBulkSenderId(settings.bulksmsbd.senderId || "");
    setAlphaSenderId(settings.alpha.senderId || "");
    setAlphaContentId(settings.alpha.contentId || "");
  }, [settings]);

  const [balance, setBalance] = useState<{ ok: boolean; balance?: string; errorMessage?: string; supported: boolean; provider: string } | null>(null);
  const [balanceCheckedAt, setBalanceCheckedAt] = useState<Date | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  const [testTo, setTestTo] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; errorMessage?: string; providerRequestId?: string } | null>(null);

  if (loading || !settings) {
    return <p className="text-sm text-muted-foreground py-6 text-center">লোড হচ্ছে...</p>;
  }

  const changeProvider = async (activeProvider: SmsProvider) => {
    try {
      const updated = await api.patch<SmsSettingsApi>("/sms/settings/provider", { activeProvider });
      setSettings(updated);
      toast.success("প্রোভাইডার পরিবর্তন হয়েছে");
    } catch (err) {
      toast.error(errMsg(err, "প্রোভাইডার পরিবর্তন করা যায়নি"));
    }
  };

  const saveBulkSmsBdSettings = async () => {
    setSavingBulk(true);
    try {
      const updated = await api.patch<SmsSettingsApi>("/sms/settings/bulksmsbd", {
        apiKey: bulkApiKey.trim() || undefined,
        senderId: bulkSenderId,
      });
      setSettings(updated);
      setBulkApiKey("");
      toast.success("BulkSMSBD সেটিংস সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error(errMsg(err, "সংরক্ষণ ব্যর্থ হয়েছে"));
    } finally {
      setSavingBulk(false);
    }
  };

  const saveAlphaSettings = async () => {
    setSavingAlpha(true);
    try {
      const updated = await api.patch<SmsSettingsApi>("/sms/settings/alpha", {
        apiKey: alphaApiKey.trim() || undefined,
        senderId: alphaSenderId,
        contentId: alphaContentId,
      });
      setSettings(updated);
      setAlphaApiKey("");
      toast.success("Alpha SMS সেটিংস সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error(errMsg(err, "সংরক্ষণ ব্যর্থ হয়েছে"));
    } finally {
      setSavingAlpha(false);
    }
  };

  const checkBalance = async () => {
    setCheckingBalance(true);
    try {
      const result = await api.get<{ ok: boolean; balance?: string; errorMessage?: string; supported: boolean; provider: string }>("/sms/settings/balance");
      setBalance(result);
      setBalanceCheckedAt(new Date());
    } catch (err) {
      toast.error(errMsg(err, "ব্যালেন্স চেক করা যায়নি"));
    } finally {
      setCheckingBalance(false);
    }
  };

  const toggleEvent = async (key: SmsEvent, value: boolean) => {
    setSettings((prev) => (prev ? { ...prev, events: { ...prev.events, [key]: value } } : prev));
    try {
      const events = await api.patch<Record<SmsEvent, boolean>>("/sms/settings/events", { [key]: value });
      setSettings((prev) => (prev ? { ...prev, events } : prev));
    } catch (err) {
      toast.error(errMsg(err, "পরিবর্তন সংরক্ষণ করা যায়নি"));
      setSettings((prev) => (prev ? { ...prev, events: { ...prev.events, [key]: !value } } : prev));
    }
  };

  const saveEventTemplate = async (event: "admission" | "payment" | "birthday", template: string) => {
    const { template: saved } = await api.patch<{ template: string }>(`/sms/settings/templates/${event}`, { template });
    setSettings((prev) => (prev ? { ...prev, templates: { ...prev.templates, [event]: saved } } : prev));
  };

  const saveResultTemplateInline = async (template: string) => {
    const cfg = await updateResultSmsTemplate(template);
    setResultTemplate(cfg.effectiveTemplate);
  };

  const sendTest = async () => {
    if (!testTo.trim() || !testMessage.trim()) {
      toast.error("মোবাইল নম্বর ও মেসেজ দিন");
      return;
    }
    setSendingTest(true);
    setTestResult(null);
    try {
      const result = await api.post<{ ok: boolean; errorMessage?: string; providerRequestId?: string }>("/sms/test", { to: testTo.trim(), message: testMessage.trim() });
      setTestResult(result);
      if (result.ok) toast.success("টেস্ট SMS পাঠানো হয়েছে");
      else toast.error(result.errorMessage || "টেস্ট SMS পাঠানো যায়নি");
    } catch (err) {
      toast.error(errMsg(err, "টেস্ট SMS পাঠানো যায়নি"));
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">প্রোভাইডার</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs space-y-1.5">
            <Label>সক্রিয় SMS প্রোভাইডার</Label>
            <Select value={settings.activeProvider} onValueChange={(v) => changeProvider(v as SmsProvider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bulksmsbd">BulkSMSBD</SelectItem>
                <SelectItem value="alpha">Alpha SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={checkBalance} disabled={checkingBalance}>
              {checkingBalance ? "চেক করা হচ্ছে..." : "Check Balance"}
            </Button>
            {balance && (
              <div className="text-sm">
                {balance.supported ? (
                  balance.ok ? (
                    <span>ব্যালেন্স ({balance.provider}): <span className="font-semibold">{balance.balance}</span></span>
                  ) : (
                    <span className="text-destructive">{balance.errorMessage}</span>
                  )
                ) : (
                  <span className="text-muted-foreground">{balance.errorMessage}</span>
                )}
                {balanceCheckedAt && <span className="text-xs text-muted-foreground ml-2">({balanceCheckedAt.toLocaleTimeString("bn-BD")})</span>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">BulkSMSBD কনফিগারেশন</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>
              API Key{" "}
              {settings.bulksmsbd.apiKeyConfigured && (
                <Badge variant="outline" className="ml-1 text-xs">
                  বর্তমান: {settings.bulksmsbd.apiKeyMasked}{settings.bulksmsbd.usingEnvFallback ? " (Environment থেকে)" : ""}
                </Badge>
              )}
            </Label>
            <Input
              type="password"
              value={bulkApiKey}
              onChange={(e) => setBulkApiKey(e.target.value)}
              placeholder={settings.bulksmsbd.apiKeyConfigured ? "পরিবর্তন না করতে খালি রাখুন" : "API Key দিন"}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sender ID</Label>
            <Input value={bulkSenderId} onChange={(e) => setBulkSenderId(e.target.value)} placeholder="যেমন: 8809648910510" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveBulkSmsBdSettings} disabled={savingBulk}>{savingBulk ? "সংরক্ষণ হচ্ছে..." : "Save BulkSMSBD Settings"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">Alpha SMS কনফিগারেশন</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>API Key {settings.alpha.apiKeyConfigured && <Badge variant="outline" className="ml-1 text-xs">বর্তমান: {settings.alpha.apiKeyMasked}</Badge>}</Label>
            <Input
              type="password"
              value={alphaApiKey}
              onChange={(e) => setAlphaApiKey(e.target.value)}
              placeholder={settings.alpha.apiKeyConfigured ? "পরিবর্তন না করতে খালি রাখুন" : "API Key দিন"}
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sender ID (ঐচ্ছিক)</Label>
              <Input value={alphaSenderId} onChange={(e) => setAlphaSenderId(e.target.value)} placeholder="ঐচ্ছিক" />
            </div>
            <div className="space-y-1.5">
              <Label>Content ID (ঐচ্ছিক)</Label>
              <Input value={alphaContentId} onChange={(e) => setAlphaContentId(e.target.value)} placeholder="ঐচ্ছিক" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveAlphaSettings} disabled={savingAlpha}>{savingAlpha ? "সংরক্ষণ হচ্ছে..." : "Save Alpha Settings"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">SMS Events</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {EVENT_LABELS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between border rounded-lg p-3">
              <p className="font-medium text-sm">{label}</p>
              <Switch checked={settings.events[key]} onCheckedChange={(v) => toggleEvent(key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground px-1">SMS টেমপ্লেট</h3>
        <SmsTemplateEditor title="ভর্তি SMS টেমপ্লেট" variables={ADMISSION_VARIABLES} value={settings.templates.admission} onSave={(t) => saveEventTemplate("admission", t)} />
        <SmsTemplateEditor title="Payment SMS টেমপ্লেট" variables={PAYMENT_VARIABLES} value={settings.templates.payment} onSave={(t) => saveEventTemplate("payment", t)} />
        <SmsTemplateEditor title="Birthday SMS টেমপ্লেট" variables={BIRTHDAY_VARIABLES} value={settings.templates.birthday} onSave={(t) => saveEventTemplate("birthday", t)} />
        <SmsTemplateEditor
          title="Result SMS টেমপ্লেট"
          description="এটি Result Entry পেজের একই টেমপ্লেট — যেকোনো জায়গা থেকে পরিবর্তন করলে অন্যত্রও প্রতিফলিত হবে।"
          variables={resultVariables}
          value={resultTemplate}
          onSave={saveResultTemplateInline}
        />
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-base">Test SMS</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Mobile Number</Label>
            <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="01XXXXXXXXX" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} rows={3} placeholder="টেস্ট মেসেজ লিখুন" />
          </div>
          <div className="flex items-center justify-between">
            <Button size="sm" onClick={sendTest} disabled={sendingTest}>{sendingTest ? "পাঠানো হচ্ছে..." : "Send Test SMS"}</Button>
            {testResult && (
              <span className={`text-sm ${testResult.ok ? "text-success" : "text-destructive"}`}>
                {testResult.ok ? `পাঠানো হয়েছে (${settings.activeProvider})` : testResult.errorMessage}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
