import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle, BookOpen, Camera, CheckCircle2, GraduationCap, Hash, Home, IdCard, Loader2, LogOut, Phone, ShieldCheck, User, UserPen, Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PublicCard, PublicShell } from "@/components/public/PublicShell";
import { ApiClientError } from "@/lib/apiClient";
import { RELATIONS, HSC_SSC_GROUPS } from "@/types/student";
import { studentEntryApi, setStudentEntryToken } from "@/lib/studentEntryClient";
import { StudentPhotoUploader } from "@/components/students/photo/StudentPhotoUploader";
import { HscInstitutionCombobox } from "@/components/common/HscInstitutionCombobox";
import { cn } from "@/lib/utils";

/** HSC Institution Autocomplete — same master-data list, reached through this page's own short-lived entryToken via the dedicated public endpoint. */
async function fetchHscInstitutionsForEntry(search: string): Promise<{ _id: string; name: string }[]> {
  const qs = new URLSearchParams({ limit: "8" });
  if (search) qs.set("search", search);
  return studentEntryApi.get<{ _id: string; name: string }[]>(`/hsc-institutions?${qs.toString()}`);
}

/**
 * Public, no-login Student Entry. A student verifies with Registration
 * Number/Roll + phone; every later call carries a short-lived token that
 * identifies them server-side (never a client-supplied id). The fields,
 * required fields, the "pending application needs a photo" rule and the
 * save payload are unchanged — only the presentation is new.
 */
interface EntryProfile {
  name: string;
  registrationId: string;
  rollNumber: string | null;
  phone: string;
  dob: string | null;
  photo: string | null;
  course: string | null;
  batchName: string | null;
  guardianMobile: string | null;
  presentAddress: string;
  permanentAddress: string;
  division: string;
  district: string;
  upazila: string;
  postOffice: string;
  postcode: string;
  village: string;
  hscInstitution: string;
  hscBoard: string;
  hscPassingYear: string;
  hscGroup: string;
  hscGpa: string;
  hscRoll: string;
  hscRegistrationNumber: string;
  sscInstitution: string;
  sscBoard: string;
  sscPassingYear: string;
  sscGroup: string;
  sscGpa: string;
  sscRoll: string;
  sscRegistrationNumber: string;
  guardianName: string;
  guardianRelation: string;
  admissionStatus: "pending" | "approved" | "rejected";
}

/** The editable subset sent on save (address sub-fields are carried through unchanged even though they are not shown). */
type EditableFields = Pick<
  EntryProfile,
  | "presentAddress" | "permanentAddress" | "division" | "district" | "upazila" | "postOffice" | "postcode" | "village"
  | "hscInstitution" | "hscBoard" | "hscPassingYear" | "hscGroup" | "hscGpa" | "hscRoll" | "hscRegistrationNumber"
  | "sscInstitution" | "sscBoard" | "sscPassingYear" | "sscGroup" | "sscGpa" | "sscRoll" | "sscRegistrationNumber"
  | "guardianName" | "guardianRelation"
> & { dob: string };

/** Every HSC/SSC field except GPA/registration is required, and dob — unchanged. */
const REQUIRED_FIELDS: { key: keyof EditableFields; label: string }[] = [
  { key: "dob", label: "জন্ম তারিখ" },
  { key: "hscInstitution", label: "HSC প্রতিষ্ঠান" },
  { key: "hscBoard", label: "HSC বোর্ড" },
  { key: "hscPassingYear", label: "HSC পাসের সাল" },
  { key: "hscGroup", label: "HSC বিভাগ" },
  { key: "hscRoll", label: "HSC রোল নম্বর" },
  { key: "sscInstitution", label: "SSC প্রতিষ্ঠান" },
  { key: "sscBoard", label: "SSC বোর্ড" },
  { key: "sscPassingYear", label: "SSC পাসের সাল" },
  { key: "sscGroup", label: "SSC বিভাগ" },
  { key: "sscRoll", label: "SSC রোল নম্বর" },
];
const REQUIRED_KEYS = new Set(REQUIRED_FIELDS.map((f) => f.key));

function editableFieldsFrom(p: EntryProfile): EditableFields {
  return {
    dob: p.dob || "",
    presentAddress: p.presentAddress, permanentAddress: p.permanentAddress,
    division: p.division, district: p.district, upazila: p.upazila, postOffice: p.postOffice, postcode: p.postcode, village: p.village,
    hscInstitution: p.hscInstitution, hscBoard: p.hscBoard, hscPassingYear: p.hscPassingYear, hscGroup: p.hscGroup, hscGpa: p.hscGpa,
    hscRoll: p.hscRoll, hscRegistrationNumber: p.hscRegistrationNumber,
    sscInstitution: p.sscInstitution, sscBoard: p.sscBoard, sscPassingYear: p.sscPassingYear, sscGroup: p.sscGroup, sscGpa: p.sscGpa,
    sscRoll: p.sscRoll, sscRegistrationNumber: p.sscRegistrationNumber,
    guardianName: p.guardianName, guardianRelation: p.guardianRelation,
  };
}

function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "sec-basic", label: "মূল তথ্য", icon: IdCard },
  { id: "sec-guardian", label: "অভিভাবক", icon: Users },
  { id: "sec-address", label: "ঠিকানা", icon: Home },
  { id: "sec-hsc", label: "HSC", icon: GraduationCap },
  { id: "sec-ssc", label: "SSC", icon: BookOpen },
];

function Section({ id, icon: Icon, title, hint, children, missing }: { id: string; icon: LucideIcon; title: string; hint?: string; children: ReactNode; missing?: number }) {
  return (
    <section id={id} className="scroll-mt-32 rounded-xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-primary" aria-hidden />{title}</h2>
        {missing ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">{missing}টি বাকি</span> : hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function ReadField({ label, value }: { label: string; value?: string | null }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-medium">{value || "—"}</p></div>;
}

export default function StudentEntry() {
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [verifyErrors, setVerifyErrors] = useState<{ identifier?: string; phone?: string; form?: string }>({});
  const [verifying, setVerifying] = useState(false);
  const [profile, setProfile] = useState<EntryProfile | null>(null);
  const [form, setForm] = useState<EditableFields | null>(null);
  const [saved, setSaved] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const formTop = useRef<HTMLDivElement>(null);

  const dirty = !!form && !!saved && JSON.stringify(form) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const missing = useMemo(() => (form ? REQUIRED_FIELDS.filter(({ key }) => !String(form[key] ?? "").trim()) : []), [form]);
  const missingKeys = new Set(missing.map((m) => m.key));
  const needsPhoto = profile?.admissionStatus === "pending" && !profile.photo;
  const doneCount = REQUIRED_FIELDS.length - missing.length + (profile?.photo ? 1 : 0);
  const totalCount = REQUIRED_FIELDS.length + 1;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof verifyErrors = {};
    if (!identifier.trim()) errs.identifier = "রেজিস্ট্রেশন নম্বর/রোল দিন";
    if (!phone.trim()) errs.phone = "মোবাইল নম্বর দিন";
    setVerifyErrors(errs);
    if (errs.identifier || errs.phone) return;
    setVerifying(true);
    try {
      const { token } = await studentEntryApi.post<{ token: string }>("/verify", { identifier: identifier.trim(), phone: phone.trim() });
      setStudentEntryToken(token);
      const data = await studentEntryApi.get<EntryProfile>("/profile");
      setProfile(data);
      const f = editableFieldsFrom(data);
      setForm(f);
      setSaved(f);
      setShowErrors(false);
      setSavedAt(null);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setStudentEntryToken(null);
      setVerifyErrors({ form: friendlyError(err, "শিক্ষার্থীর তথ্য যাচাই করা যায়নি। রেজিস্ট্রেশন নম্বর/রোল ও মোবাইল নম্বর আবার পরীক্ষা করুন।") });
    } finally {
      setVerifying(false);
    }
  };

  const update = (k: keyof EditableFields, v: string) => setForm((p) => (p ? { ...p, [k]: v } : p));

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const sectionOf = (k: keyof EditableFields) => (k === "dob" ? "sec-basic" : String(k).startsWith("hsc") ? "sec-hsc" : String(k).startsWith("ssc") ? "sec-ssc" : "sec-basic");

  const handleSave = async () => {
    if (!form) return;
    // A still-pending application must have a photo before it can be saved; the backend enforces the same rule.
    if (needsPhoto) {
      toast.error("প্রোফাইল সংরক্ষণের আগে একটি ছবি আপলোড করুন");
      scrollTo("sec-photo");
      return;
    }
    if (missing.length) {
      setShowErrors(true);
      toast.error(`${missing[0].label} আবশ্যক`);
      scrollTo(sectionOf(missing[0].key));
      return;
    }
    setSaving(true);
    try {
      const updated = await studentEntryApi.patch<EntryProfile>("/profile", form);
      setProfile(updated);
      const f = editableFieldsFrom(updated);
      setForm(f);
      setSaved(f);
      setShowErrors(false);
      setSavedAt(new Date());
      toast.success("প্রোফাইল হালনাগাদ করা হয়েছে");
    } catch (err) {
      toast.error(friendlyError(err, "সংরক্ষণ ব্যর্থ হয়েছে। আবার চেষ্টা করুন — আপনার ভেরিফিকেশন সেশনের মেয়াদ শেষ হয়ে থাকতে পারে।"));
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (blob: Blob) => {
    const formData = new FormData();
    formData.append("photo", blob, "photo.jpg");
    const updated = await studentEntryApi.postForm<EntryProfile>("/photo", formData);
    setProfile(updated);
  };

  const handleStartOver = () => {
    if (dirty && !window.confirm("সংরক্ষণ না করা পরিবর্তন আছে। তবুও বের হবেন?")) return;
    setStudentEntryToken(null);
    setProfile(null);
    setForm(null);
    setSaved(null);
    setIdentifier("");
    setPhone("");
    setVerifyErrors({});
  };

  // ------------------------------------------------------------ verify step
  if (!profile || !form) {
    return (
      <PublicShell width="sm" icon={UserPen} title="শিক্ষার্থী তথ্য পূরণ" description="প্রোফাইল ছবি ও তথ্য হালনাগাদ করতে আগে যাচাই করুন — লগইন প্রয়োজন নেই" back={{ to: "/info", label: "তথ্য কেন্দ্র" }}>
        <PublicCard>
          <form onSubmit={handleVerify} className="space-y-4" noValidate>
            {verifyErrors.form && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{verifyErrors.form}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="se-id">রেজিস্ট্রেশন নম্বর / রোল</Label>
              <div className="relative"><Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="se-id" value={identifier} onChange={(e) => { setIdentifier(e.target.value); setVerifyErrors((p) => ({ ...p, identifier: undefined, form: undefined })); }} placeholder="যেমন: REG-1023 অথবা ১২" autoComplete="off" className="h-11 pl-9" aria-invalid={!!verifyErrors.identifier} autoFocus />
              </div>
              {verifyErrors.identifier && <p className="text-xs text-destructive">{verifyErrors.identifier}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="se-phone">মোবাইল নম্বর</Label>
              <div className="relative"><Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="se-phone" value={phone} onChange={(e) => { setPhone(e.target.value); setVerifyErrors((p) => ({ ...p, phone: undefined, form: undefined })); }} placeholder="01XXXXXXXXX" inputMode="tel" autoComplete="off" className="h-11 pl-9" aria-invalid={!!verifyErrors.phone} />
              </div>
              {verifyErrors.phone ? <p className="text-xs text-destructive">{verifyErrors.phone}</p> : <p className="text-xs text-muted-foreground">ভর্তির সময় যে নম্বর দিয়েছিলেন</p>}
            </div>
            <Button type="submit" className="h-11 w-full text-base" disabled={verifying}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
              {verifying ? "যাচাই করা হচ্ছে..." : "যাচাই করুন"}
            </Button>
          </form>
        </PublicCard>
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">যাচাইয়ের পর যা করতে পারবেন</p>
          <ul className="mt-2 space-y-1.5">
            {["প্রোফাইল ছবি আপলোড বা পরিবর্তন", "জন্ম তারিখ, অভিভাবক ও ঠিকানা হালনাগাদ", "HSC ও SSC তথ্য পূরণ"].map((t) => <li key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{t}</li>)}
          </ul>
        </div>
      </PublicShell>
    );
  }

  // ------------------------------------------------------------ edit step
  const fieldClass = (k: keyof EditableFields) => cn("h-11", showErrors && missingKeys.has(k) && "border-destructive focus-visible:ring-destructive");
  const err = (k: keyof EditableFields) => (showErrors && missingKeys.has(k) ? <p className="text-xs text-destructive">{REQUIRED_FIELDS.find((f) => f.key === k)?.label} আবশ্যক</p> : null);
  const lab = (k: keyof EditableFields, text: string) => <Label htmlFor={`se-${k}`}>{text}{REQUIRED_KEYS.has(k) && <span className="text-destructive"> *</span>}</Label>;
  const text = (k: keyof EditableFields, label: string, placeholder?: string, inputMode?: "numeric" | "decimal") => (
    <div className="space-y-1.5">{lab(k, label)}<Input id={`se-${k}`} value={form[k] ?? ""} onChange={(e) => update(k, e.target.value)} placeholder={placeholder} inputMode={inputMode} className={fieldClass(k)} aria-invalid={showErrors && missingKeys.has(k)} />{err(k)}</div>
  );
  const select = (k: keyof EditableFields, label: string, options: readonly string[]) => (
    <div className="space-y-1.5">{lab(k, label)}
      <Select value={form[k] ?? ""} onValueChange={(v) => update(k, v)}>
        <SelectTrigger id={`se-${k}`} className={fieldClass(k)}><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>{err(k)}
    </div>
  );
  const missIn = (prefix: string) => (showErrors ? missing.filter((m) => (prefix === "basic" ? m.key === "dob" : String(m.key).startsWith(prefix))).length : 0);

  return (
    <PublicShell width="md" icon={UserPen} title="শিক্ষার্থী তথ্য পূরণ" description="চিহ্নিত (*) তথ্যগুলো আবশ্যক — শেষে নিচের বাটন থেকে সংরক্ষণ করুন" back={{ to: "/info", label: "তথ্য কেন্দ্র" }}>
      <div ref={formTop} />
      {profile.admissionStatus === "pending" && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
          <p>আপনার আবেদনটি এখনো অ্যাডমিন অনুমোদনের অপেক্ষায় আছে। নিচের তথ্য ও একটি ছবি দিয়ে প্রোফাইল সম্পূর্ণ করুন — অনুমোদনের পর আপনি ব্যাচে সক্রিয় হবেন।</p>
        </div>
      )}
      {savedAt && !dirty && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 p-3 text-sm text-success animate-in fade-in-0">
          <CheckCircle2 className="h-4 w-4" aria-hidden />তথ্য সংরক্ষিত হয়েছে ({savedAt.toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" })})
        </div>
      )}

      {/* Identity + photo */}
      <section id="sec-photo" className="scroll-mt-32 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button type="button" onClick={() => setPhotoOpen(true)} className="group relative mx-auto w-fit shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mx-0" aria-label={profile.photo ? "ছবি পরিবর্তন করুন" : "ছবি আপলোড করুন"}>
            <Avatar className={cn("h-24 w-24 border-4", needsPhoto ? "border-destructive/40" : "border-muted")}>
              {profile.photo && <AvatarImage src={profile.photo} alt="" className="object-cover" />}
              <AvatarFallback className="bg-primary/10 text-primary"><User className="h-10 w-10" aria-hidden /></AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground transition-transform group-hover:scale-105"><Camera className="h-4 w-4" aria-hidden /></span>
          </button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="truncate text-lg font-bold">{profile.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
              <ReadField label="রেজিস্ট্রেশন / রোল" value={profile.rollNumber} />
              <ReadField label="সিস্টেম আইডি" value={profile.registrationId} />
              <ReadField label="মোবাইল" value={profile.phone} />
              <ReadField label="কোর্স" value={profile.course} />
              <ReadField label="ব্যাচ" value={profile.batchName} />
              <ReadField label="অভিভাবকের মোবাইল" value={profile.guardianMobile} />
            </div>
            {needsPhoto && <p className="mt-2 text-xs font-medium text-destructive">সংরক্ষণের আগে একটি ছবি আপলোড করতে হবে</p>}
          </div>
        </div>
        <div className="mt-4 border-t pt-3">
          <div className="flex items-center justify-between text-xs"><span className="font-medium">প্রোফাইল সম্পূর্ণতা</span><b className={cn("tabular-nums", doneCount === totalCount ? "text-success" : "text-primary")}>{doneCount}/{totalCount}</b></div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-[width] duration-500", doneCount === totalCount ? "bg-success" : "bg-primary")} style={{ width: `${(doneCount / totalCount) * 100}%` }} /></div>
          <p className="mt-1 text-[11px] text-muted-foreground">ছবি ও আবশ্যক (*) তথ্যের হিসাব</p>
        </div>
      </section>

      {/* Section nav (sticky on scroll) */}
      <nav aria-label="ফর্মের অংশ" className="sticky top-[6.5rem] z-20 -mx-1 flex gap-1.5 overflow-x-auto rounded-xl border bg-card/95 p-1.5 backdrop-blur md:top-[4.5rem]">
        {SECTIONS.map((s) => {
          const n = s.id === "sec-basic" ? missIn("basic") : s.id === "sec-hsc" ? missIn("hsc") : s.id === "sec-ssc" ? missIn("ssc") : 0;
          return (
            <button key={s.id} type="button" onClick={() => scrollTo(s.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-sm">
              <s.icon className="h-3.5 w-3.5" aria-hidden />{s.label}{n ? <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-label={`${n}টি বাকি`} /> : null}
            </button>
          );
        })}
      </nav>

      <Section id="sec-basic" icon={IdCard} title="মূল তথ্য" missing={missIn("basic")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">{lab("dob", "জন্ম তারিখ")}<Input id="se-dob" type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} className={fieldClass("dob")} aria-invalid={showErrors && missingKeys.has("dob")} />{err("dob")}</div>
          <p className="self-end text-xs text-muted-foreground sm:pb-3">নাম, রেজিস্ট্রেশন, কোর্স ও ব্যাচ অফিস থেকে নির্ধারিত — পরিবর্তনের জন্য অফিসে যোগাযোগ করুন।</p>
        </div>
      </Section>

      <Section id="sec-guardian" icon={Users} title="অভিভাবকের তথ্য" hint="ঐচ্ছিক">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text("guardianName", "অভিভাবকের নাম", "যেমন: মোঃ আব্দুল করিম")}
          {select("guardianRelation", "সম্পর্ক", RELATIONS)}
        </div>
      </Section>

      <Section id="sec-address" icon={Home} title="ঠিকানা" hint="ঐচ্ছিক">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text("presentAddress", "বর্তমান ঠিকানা", "গ্রাম/মহল্লা, উপজেলা, জেলা")}
          <div className="space-y-1.5">
            {text("permanentAddress", "স্থায়ী ঠিকানা", "গ্রাম/মহল্লা, উপজেলা, জেলা")}
            {form.presentAddress && form.presentAddress !== form.permanentAddress && (
              <button type="button" onClick={() => update("permanentAddress", form.presentAddress)} className="text-xs text-primary hover:underline">বর্তমান ঠিকানার মতোই</button>
            )}
          </div>
        </div>
      </Section>

      <Section id="sec-hsc" icon={GraduationCap} title="HSC তথ্য" missing={missIn("hsc")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">{lab("hscInstitution", "প্রতিষ্ঠান")}
            <div className={cn(showErrors && missingKeys.has("hscInstitution") && "rounded-md ring-1 ring-destructive")}><HscInstitutionCombobox value={form.hscInstitution} onChange={(v) => update("hscInstitution", v)} fetchOptions={fetchHscInstitutionsForEntry} /></div>{err("hscInstitution")}
          </div>
          {text("hscBoard", "বোর্ড", "যেমন: দিনাজপুর")}
          {text("hscPassingYear", "পাসের সাল", "২০২৪", "numeric")}
          {select("hscGroup", "বিভাগ", HSC_SSC_GROUPS)}
          {text("hscRoll", "রোল নম্বর", undefined, "numeric")}
          {text("hscRegistrationNumber", "রেজিস্ট্রেশন নম্বর (ঐচ্ছিক)", undefined, "numeric")}
          {text("hscGpa", "জিপিএ (ঐচ্ছিক)", "৫.০০", "decimal")}
        </div>
      </Section>

      <Section id="sec-ssc" icon={BookOpen} title="SSC তথ্য" missing={missIn("ssc")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{text("sscInstitution", "প্রতিষ্ঠান", "বিদ্যালয়ের নাম")}</div>
          {text("sscBoard", "বোর্ড", "যেমন: দিনাজপুর")}
          {text("sscPassingYear", "পাসের সাল", "২০২২", "numeric")}
          {select("sscGroup", "বিভাগ", HSC_SSC_GROUPS)}
          {text("sscRoll", "রোল নম্বর", undefined, "numeric")}
          {text("sscRegistrationNumber", "রেজিস্ট্রেশন নম্বর (ঐচ্ছিক)", undefined, "numeric")}
          {text("sscGpa", "জিপিএ (ঐচ্ছিক)", "৫.০০", "decimal")}
        </div>
      </Section>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("mr-auto text-sm", missing.length || needsPhoto ? "text-muted-foreground" : "text-success")}>
            {needsPhoto ? "ছবি আপলোড বাকি" : missing.length ? `${missing.length}টি আবশ্যক তথ্য বাকি` : dirty ? "সব আবশ্যক তথ্য দেওয়া হয়েছে — সংরক্ষণ করুন" : "সব আবশ্যক তথ্য দেওয়া আছে"}
          </span>
          <Button variant="ghost" onClick={handleStartOver}><LogOut className="h-4 w-4" />অন্য শিক্ষার্থী</Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[160px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
            {saving ? "সংরক্ষণ হচ্ছে..." : "প্রোফাইল সংরক্ষণ করুন"}
          </Button>
        </div>
      </div>

      <StudentPhotoUploader open={photoOpen} onOpenChange={setPhotoOpen} studentName={profile.name} currentPhotoUrl={profile.photo} onUpload={handlePhotoUpload} />
    </PublicShell>
  );
}
