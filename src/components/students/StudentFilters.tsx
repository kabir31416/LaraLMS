import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, Cake, Check, ChevronDown, ChevronsUpDown, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { api } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { FEE_TYPES, GENDERS } from "@/types/student";

export type DueStatus = "all" | "has" | "none";

/**
 * Every Student List filter, as stored in the URL (empty string = not set).
 * Each one maps 1:1 to a query parameter GET /students (and /students/export)
 * already supports, so filtering, paging, print and export all run on the
 * server with exactly the same filter.
 */
export interface StudentFilterValues {
  search: string;
  courseId: string;
  batchId: string; // id | "unassigned"
  status: string; // সক্রিয় | নিষ্ক্রিয়
  dueStatus: string; // has | none
  admissionDateFrom: string;
  admissionDateTo: string;
  birthday: string; // "today" | "1".."12"
  hscInstitution: string;
  gender: string;
  feeType: string;
  profileStatus: string; // complete | incomplete
  admissionStatus: string; // pending
  division: string;
  district: string;
  guardianMobile: string;
  sort: string; // "" (roll) | name | admission_desc | admission_asc | due_desc
}

export const FILTER_KEYS: (keyof StudentFilterValues)[] = [
  "search", "courseId", "batchId", "status", "dueStatus", "admissionDateFrom", "admissionDateTo", "birthday", "hscInstitution",
  "gender", "feeType", "profileStatus", "admissionStatus", "division", "district", "guardianMobile", "sort",
];

export const EMPTY_FILTERS: StudentFilterValues = Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])) as unknown as StudentFilterValues;

const SORTS: Record<string, { label: string; sortBy?: string; sortOrder?: "asc" | "desc" }> = {
  "": { label: "রোল অনুযায়ী" },
  name: { label: "নাম (অ → হ)", sortBy: "name", sortOrder: "asc" },
  admission_desc: { label: "নতুন ভর্তি আগে", sortBy: "admissionDate", sortOrder: "desc" },
  admission_asc: { label: "পুরনো ভর্তি আগে", sortBy: "admissionDate", sortOrder: "asc" },
  due_desc: { label: "বকেয়া (বেশি → কম)", sortBy: "due", sortOrder: "desc" },
};

/** Builds the server query for these filters (no page/limit). */
export function studentFilterQuery(f: StudentFilterValues, courseName?: string): URLSearchParams {
  const qs = new URLSearchParams();
  if (f.search.trim()) qs.set("search", f.search.trim());
  if (courseName) qs.set("course", courseName);
  if (f.batchId) qs.set("batchId", f.batchId);
  if (f.status) qs.set("status", f.status);
  if (f.dueStatus) qs.set("dueStatus", f.dueStatus);
  if (f.admissionDateFrom) qs.set("admissionDateFrom", f.admissionDateFrom);
  if (f.admissionDateTo) qs.set("admissionDateTo", f.admissionDateTo);
  if (f.birthday === "today") qs.set("birthdayToday", "true");
  else if (f.birthday) qs.set("birthMonth", f.birthday);
  if (f.hscInstitution) qs.set("hscInstitution", f.hscInstitution);
  if (f.gender) qs.set("gender", f.gender);
  if (f.feeType) qs.set("feeType", f.feeType);
  if (f.profileStatus) qs.set("profileStatus", f.profileStatus);
  if (f.admissionStatus) qs.set("admissionStatus", f.admissionStatus);
  if (f.division.trim()) qs.set("division", f.division.trim());
  if (f.district.trim()) qs.set("district", f.district.trim());
  if (f.guardianMobile.trim()) qs.set("guardianMobile", f.guardianMobile.trim());
  const s = SORTS[f.sort];
  if (s?.sortBy) { qs.set("sortBy", s.sortBy); qs.set("sortOrder", s.sortOrder!); }
  return qs;
}

const ALL = "__all";
const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function Pick({ value, onChange, placeholder, options, label }: { value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[]; label: string }) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger aria-label={label} className={cn(value && "border-primary/40 bg-primary/[0.03]")}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent><SelectItem value={ALL}>{placeholder}</SelectItem>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

/** Searchable dropdown (Popover + Command) for long option lists. */
function SearchPick({ value, onChange, placeholder, options, label }: { value: string; onChange: (v: string) => void; placeholder: string; options: string[]; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} aria-label={label} className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", value && "border-primary/40 bg-primary/[0.03]")}>
          <span className="truncate">{value || placeholder}</span><ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="খুঁজুন..." />
          <CommandList>
            <CommandEmpty>কিছু পাওয়া যায়নি</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => { onChange(""); setOpen(false); }}><Check className={cn("mr-2 h-4 w-4", value ? "opacity-0" : "opacity-100")} />{placeholder}</CommandItem>
              {options.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => { onChange(o); setOpen(false); }}><Check className={cn("mr-2 h-4 w-4", value === o ? "opacity-100" : "opacity-0")} />{o}</CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function StudentFilters({ value: f, onChange, onReset, total, loading }: {
  value: StudentFilterValues;
  onChange: (patch: Partial<StudentFilterValues>) => void;
  onReset: () => void;
  total: number | null;
  loading?: boolean;
}) {
  const { activeCourses } = useAcademic();
  const { batches } = useBatches();
  const [institutions, setInstitutions] = useState<string[]>([]);
  useEffect(() => {
    api.getWithMeta<{ _id: string; name: string }[]>("/hsc-institutions?limit=100").then((res) => setInstitutions(res.data.map((i) => i.name))).catch(() => {});
  }, []);

  const advancedKeys: (keyof StudentFilterValues)[] = ["admissionDateFrom", "admissionDateTo", "birthday", "hscInstitution", "gender", "feeType", "profileStatus", "admissionStatus", "division", "district", "guardianMobile"];
  const advancedActive = advancedKeys.filter((k) => f[k]).length;
  const [open, setOpen] = useState(advancedActive > 0);

  // Course → Batch: once a course is picked, only its batches are offered.
  const batchesForCourse = useMemo(() => (f.courseId ? batches.filter((b) => b.courseId === f.courseId) : batches), [batches, f.courseId]);
  const setCourse = (courseId: string) => {
    const keepBatch = !f.batchId || f.batchId === "unassigned" || !courseId || batches.some((b) => b.id === f.batchId && b.courseId === courseId);
    onChange({ courseId, ...(keepBatch ? {} : { batchId: "" }) });
  };

  const courseLabel = activeCourses.find((c) => c.id === f.courseId)?.name;
  const batchLabel = f.batchId === "unassigned" ? "ব্যাচ নির্ধারিত হয়নি" : batches.find((b) => b.id === f.batchId)?.name;
  const chips: { key: (keyof StudentFilterValues)[]; label: string }[] = [
    f.search && { key: ["search"], label: `খোঁজ: ${f.search}` },
    f.courseId && { key: ["courseId"], label: `কোর্স: ${courseLabel ?? "—"}` },
    f.batchId && { key: ["batchId"], label: `ব্যাচ: ${batchLabel ?? "—"}` },
    f.status && { key: ["status"], label: `অবস্থা: ${f.status}` },
    f.dueStatus && { key: ["dueStatus"], label: f.dueStatus === "has" ? "বকেয়া আছে" : "বকেয়া নেই" },
    (f.admissionDateFrom || f.admissionDateTo) && { key: ["admissionDateFrom", "admissionDateTo"], label: `ভর্তি: ${f.admissionDateFrom || "শুরু"} — ${f.admissionDateTo || "আজ"}` },
    f.birthday && { key: ["birthday"], label: f.birthday === "today" ? "আজ জন্মদিন" : `জন্মমাস: ${MONTHS[Number(f.birthday) - 1]}` },
    f.hscInstitution && { key: ["hscInstitution"], label: `HSC: ${f.hscInstitution}` },
    f.gender && { key: ["gender"], label: f.gender },
    f.feeType && { key: ["feeType"], label: `ফি: ${f.feeType}` },
    f.profileStatus && { key: ["profileStatus"], label: f.profileStatus === "complete" ? "প্রোফাইল সম্পূর্ণ" : "প্রোফাইল অসম্পূর্ণ" },
    f.admissionStatus && { key: ["admissionStatus"], label: "অনুমোদনের অপেক্ষায়" },
    f.division && { key: ["division"], label: `বিভাগ: ${f.division}` },
    f.district && { key: ["district"], label: `জেলা: ${f.district}` },
    f.guardianMobile && { key: ["guardianMobile"], label: `অভিভাবক: ${f.guardianMobile}` },
  ].filter(Boolean) as { key: (keyof StudentFilterValues)[]; label: string }[];

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={f.search} onChange={(e) => onChange({ search: e.target.value })} placeholder="নাম, রেজিস্ট্রেশন নম্বর, রোল, আইডি বা মোবাইল (শিক্ষার্থী/অভিভাবক)" className="pl-9 pr-9" aria-label="শিক্ষার্থী খুঁজুন" />
          {f.search && <button type="button" onClick={() => onChange({ search: "" })} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="খোঁজ মুছুন"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex gap-2">
          <Select value={f.sort || "roll"} onValueChange={(v) => onChange({ sort: v === "roll" ? "" : v })}>
            <SelectTrigger className="w-full lg:w-48" aria-label="সাজান"><ArrowUpDown className="mr-1 h-3.5 w-3.5 opacity-60" /><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(SORTS).map(([k, s]) => <SelectItem key={k || "roll"} value={k || "roll"}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant={open ? "secondary" : "outline"} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="student-adv-filters" className="shrink-0">
            <SlidersHorizontal className="h-4 w-4" />আরও ফিল্টার{advancedActive ? <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{advancedActive}</span> : null}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
          </Button>
        </div>
      </div>

      {/* Quick filters */}
      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Pick label="কোর্স" value={f.courseId} onChange={setCourse} placeholder="সকল কোর্স" options={activeCourses.map((c) => ({ value: c.id, label: c.name }))} />
        <Pick label="ব্যাচ" value={f.batchId} onChange={(v) => onChange({ batchId: v })} placeholder="সকল ব্যাচ" options={[{ value: "unassigned", label: "ব্যাচ নির্ধারিত হয়নি" }, ...batchesForCourse.map((b) => ({ value: b.id, label: b.name }))]} />
        <Pick label="অবস্থা" value={f.status} onChange={(v) => onChange({ status: v })} placeholder="সকল অবস্থা" options={[{ value: "সক্রিয়", label: "সক্রিয়" }, { value: "নিষ্ক্রিয়", label: "নিষ্ক্রিয়" }]} />
        <Pick label="বকেয়া" value={f.dueStatus} onChange={(v) => onChange({ dueStatus: v })} placeholder="বকেয়া (সব)" options={[{ value: "has", label: "বকেয়া আছে" }, { value: "none", label: "বকেয়া নেই" }]} />
      </div>

      {/* Advanced filters */}
      {open && (
        <div id="student-adv-filters" className="mt-3 grid grid-cols-1 gap-3 border-t pt-3 animate-in fade-in-0 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="ভর্তির তারিখ (থেকে – পর্যন্ত)" className="sm:col-span-2">
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={f.admissionDateFrom} max={f.admissionDateTo || undefined} onChange={(e) => onChange({ admissionDateFrom: e.target.value })} aria-label="ভর্তির তারিখ থেকে" />
              <Input type="date" value={f.admissionDateTo} min={f.admissionDateFrom || undefined} onChange={(e) => onChange({ admissionDateTo: e.target.value })} aria-label="ভর্তির তারিখ পর্যন্ত" />
            </div>
          </Field>
          <Field label="জন্মদিন">
            <Select value={f.birthday || ALL} onValueChange={(v) => onChange({ birthday: v === ALL ? "" : v })}>
              <SelectTrigger aria-label="জন্মদিন" className={cn(f.birthday && "border-primary/40 bg-primary/[0.03]")}><Cake className="mr-1 h-3.5 w-3.5 opacity-60" /><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>যেকোনো</SelectItem><SelectItem value="today">আজ জন্মদিন</SelectItem>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m} মাসে</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="HSC প্রতিষ্ঠান"><SearchPick label="HSC প্রতিষ্ঠান" value={f.hscInstitution} onChange={(v) => onChange({ hscInstitution: v })} placeholder="সকল প্রতিষ্ঠান" options={institutions} /></Field>
          <Field label="লিঙ্গ"><Pick label="লিঙ্গ" value={f.gender} onChange={(v) => onChange({ gender: v })} placeholder="সকল" options={GENDERS.map((g) => ({ value: g, label: g }))} /></Field>
          <Field label="ফি-এর ধরন"><Pick label="ফি-এর ধরন" value={f.feeType} onChange={(v) => onChange({ feeType: v })} placeholder="সকল" options={FEE_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
          <Field label="প্রোফাইল"><Pick label="প্রোফাইল" value={f.profileStatus} onChange={(v) => onChange({ profileStatus: v })} placeholder="সকল" options={[{ value: "complete", label: "সম্পূর্ণ" }, { value: "incomplete", label: "অসম্পূর্ণ" }]} /></Field>
          <Field label="আবেদন"><Pick label="আবেদন" value={f.admissionStatus} onChange={(v) => onChange({ admissionStatus: v })} placeholder="সকল" options={[{ value: "pending", label: "অনুমোদনের অপেক্ষায়" }]} /></Field>
          <Field label="বিভাগ"><Input value={f.division} onChange={(e) => onChange({ division: e.target.value })} placeholder="যেমন: রংপুর" /></Field>
          <Field label="জেলা"><Input value={f.district} onChange={(e) => onChange({ district: e.target.value })} placeholder="যেমন: দিনাজপুর" /></Field>
          <Field label="অভিভাবকের মোবাইল" className="sm:col-span-2"><Input value={f.guardianMobile} onChange={(e) => onChange({ guardianMobile: e.target.value })} placeholder="01XXXXXXXXX" inputMode="tel" /></Field>
        </div>
      )}

      {/* Active filter chips + count */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-live="polite">
        <span className="mr-1 inline-flex items-center gap-1.5 text-sm">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
          <b className="tabular-nums">{total === null ? "—" : total.toLocaleString("bn-BD")}</b> জন শিক্ষার্থী{chips.length ? " মিলেছে" : ""}
        </span>
        {chips.map((c) => (
          <span key={c.key.join()} className="inline-flex max-w-[240px] items-center gap-1 rounded-full border border-primary/25 bg-primary/5 py-0.5 pl-2.5 pr-1 text-xs text-primary">
            <span className="truncate">{c.label}</span>
            <button type="button" onClick={() => onChange(Object.fromEntries(c.key.map((k) => [k, ""])) as Partial<StudentFilterValues>)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/15" aria-label={`${c.label} মুছুন`}><X className="h-3 w-3" /></button>
          </span>
        ))}
        {chips.length > 0 && <button type="button" onClick={onReset} className="ml-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">সব ফিল্টার মুছুন</button>}
      </div>
    </Card>
  );
}
