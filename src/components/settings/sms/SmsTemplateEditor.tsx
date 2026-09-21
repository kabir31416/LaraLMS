import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

/**
 * Generalized from DirectorResults.tsx's ResultSmsTemplateDialog (SMS
 * Provider Upgrade §5) — same variable-chips + textarea + live-preview
 * pattern, as a plain inline card instead of a dialog so Admission/Payment/
 * Birthday/Result can all sit together under one "SMS টেমপ্লেট" section.
 * Placeholders are always validated against exactly the variable list the
 * backend says exists for that event — never an invented field, and a
 * missing value in the preview always falls back to an empty string, never
 * "undefined"/"null".
 */
export interface SmsTemplateVariable {
  key: string;
  label: string;
}

/** Sample values across every variable this module's 4 events actually use — extend here, never invent a new key that isn't in some event's real variable list. */
const SAMPLE_VALUES: Record<string, string> = {
  studentName: "রহিম উদ্দিন",
  registrationId: "REG-1023",
  roll: "12",
  courseName: "HSC কোচিং",
  batchName: "সকাল ব্যাচ",
  guardianName: "আব্দুল করিম",
  paymentAmount: "৫০০",
  totalPaid: "৫,০০০",
  due: "১,৫০০",
  receiptNo: "RCT-0042",
};

interface Props {
  title: string;
  description?: string;
  variables: SmsTemplateVariable[];
  value: string;
  onSave: (template: string) => Promise<void>;
}

export function SmsTemplateEditor({ title, description, variables, value, onSave }: Props) {
  const [template, setTemplate] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setTemplate(value), [value]);

  const knownKeys = useMemo(() => new Set(variables.map((v) => v.key)), [variables]);

  const unknownPlaceholders = useMemo(() => {
    const found = new Set<string>();
    for (const m of template.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)) {
      if (!knownKeys.has(m[1])) found.add(m[1]);
    }
    return Array.from(found);
  }, [template, knownKeys]);

  const previewText = useMemo(
    () => template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_m, key: string) => SAMPLE_VALUES[key] ?? ""),
    [template],
  );

  const insertVariable = (key: string) => {
    const el = textareaRef.current;
    const placeholder = `{{${key}}}`;
    if (!el) {
      setTemplate((t) => t + placeholder);
      return;
    }
    const start = el.selectionStart ?? template.length;
    const end = el.selectionEnd ?? template.length;
    const next = template.slice(0, start) + placeholder + template.slice(end);
    setTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + placeholder.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSave = async () => {
    if (!template.trim()) {
      toast.error("টেমপ্লেট খালি রাখা যাবে না");
      return;
    }
    if (unknownPlaceholders.length > 0) {
      toast.error(`এই ভ্যারিয়েবলগুলো সমর্থিত নয়: ${unknownPlaceholders.map((k) => `{{${k}}}`).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      await onSave(template.trim());
      toast.success("টেমপ্লেট সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "টেমপ্লেট সংরক্ষণ করা যায়নি");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="mb-1.5 block text-xs">উপলব্ধ ভ্যারিয়েবল (ক্লিক করলে যোগ হবে)</Label>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <Button key={v.key} type="button" variant="secondary" size="sm" className="h-7 text-xs font-mono" onClick={() => insertVariable(v.key)} title={v.label}>
                {`{{${v.key}}}`}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Textarea ref={textareaRef} value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} className="font-mono text-sm resize-y" />
          {unknownPlaceholders.length > 0 && (
            <p className="mt-1.5 text-xs text-destructive">অসমর্থিত ভ্যারিয়েবল: {unknownPlaceholders.map((k) => `{{${k}}}`).join(", ")}</p>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block text-xs">প্রিভিউ (নমুনা তথ্য দিয়ে)</Label>
          <div className="rounded-lg border bg-muted/30 p-2.5 text-sm whitespace-pre-wrap break-words">{previewText || "—"}</div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
