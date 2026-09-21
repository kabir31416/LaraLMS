import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { api } from "@/lib/apiClient";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

interface HscInstitutionOption {
  _id: string;
  name: string;
}

/** Default fetcher — the authenticated Admin/Portal GET /hsc-institutions endpoint. */
async function fetchViaAuthedApi(search: string): Promise<HscInstitutionOption[]> {
  const qs = new URLSearchParams({ limit: "8" });
  if (search) qs.set("search", search);
  const res = await api.getWithMeta<HscInstitutionOption[]>(`/hsc-institutions?${qs.toString()}`);
  return res.data;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * HSC Institution Autocomplete audit §4 — overridable so the public
   * `/studententry` page (its own short-lived entryToken, never the
   * Admin/Portal session apiClient.ts manages) can point this at
   * GET /public/student-entry/hsc-institutions instead, without a second,
   * parallel combobox component. Defaults to the authenticated endpoint
   * every other caller (AdmissionForm, Student self-profile) already uses.
   */
  fetchOptions?: (search: string) => Promise<HscInstitutionOption[]>;
}

/**
 * Searchable + creatable HSC College/Institution field (Bulk Student Upload
 * spec §5-§7) — backed by GET /hsc-institutions, the shared master data used
 * everywhere a student's HSC institution is entered (Admission form,
 * Student self-profile, and — via student.service.ts's syncHscInstitution,
 * not this component — the bulk Excel import).
 *
 * The value is always plain free text: typing something that doesn't match
 * any suggestion is a perfectly valid "new institution" (a "নতুন প্রতিষ্ঠান
 * যোগ করুন" row just confirms the selection); the actual master-data
 * record is only ever created server-side, at the moment the student is
 * actually saved (§6/§8 — "do not create duplicate records unnecessarily",
 * "create only when the row is approved").
 */
export function HscInstitutionCombobox({ value, onChange, placeholder, className, fetchOptions = fetchViaAuthedApi }: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<HscInstitutionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebouncedValue(value, 300);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchOptions(debounced.trim())
      .then((items) => { if (!cancelled) setOptions(items); })
      .catch(() => { if (!cancelled) setOptions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, open]);

  useEffect(() => () => clearTimeout(blurTimer.current), []);

  const trimmed = value.trim();
  const exactMatch = options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase());

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        // A slight delay lets a suggestion button's onClick register before
        // the dropdown unmounts — otherwise blur fires first and the click
        // never lands.
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        placeholder={placeholder || "প্রতিষ্ঠানের নাম লিখুন বা খুঁজুন..."}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md p-1">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-3">খোঁজা হচ্ছে...</p>
          ) : (
            <>
              {options.map((o) => (
                <button
                  key={o._id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(o.name)}
                  className="w-full text-left px-2.5 py-1.5 text-sm rounded hover:bg-muted/60 transition-colors"
                >
                  {o.name}
                </button>
              ))}
              {trimmed && !exactMatch && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(trimmed)}
                  className="w-full text-left px-2.5 py-1.5 text-sm rounded hover:bg-muted/60 transition-colors text-primary flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">নতুন প্রতিষ্ঠান হিসেবে যোগ করুন: "{trimmed}"</span>
                </button>
              )}
              {options.length === 0 && !trimmed && (
                <p className="text-xs text-muted-foreground text-center py-3">প্রতিষ্ঠানের নাম লিখুন</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
