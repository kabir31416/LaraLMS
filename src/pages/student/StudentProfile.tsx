import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Camera, GraduationCap, Home, Layers, Pencil, Phone, ShieldCheck, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HscInstitutionCombobox } from "@/components/common/HscInstitutionCombobox";
import { StudentPhotoUploader } from "@/components/students/photo/StudentPhotoUploader";
import { COMPLETION_LABELS, StudentPage } from "@/components/student/StudentPortalKit";
import { RELATIONS, HSC_SSC_GROUPS } from "@/types/student";
import type { SelfEditableFields } from "@/contexts/StudentSelfContext";
import { ApiClientError } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useStudentSelf } from "./useStudentSelf";

/**
 * My Profile. Read-only (admin-set) details and the student-editable form
 * are the same fields and the same backend allow-list as before
 * (PATCH /students/:id/self); this adds grouping, an unsaved-changes guard
 * and cancel. Profile completion is the server's own figure.
 */
const EDITABLE_KEYS: (keyof SelfEditableFields)[] = [
  "presentAddress", "permanentAddress", "guardianName", "guardianRelation",
  "hscInstitution", "hscBoard", "hscPassingYear", "hscGroup", "hscGpa", "hscRoll", "hscRegistrationNumber",
  "sscInstitution", "sscBoard", "sscPassingYear", "sscGroup", "sscGpa", "sscRoll", "sscRegistrationNumber",
];

/** Every HSC/SSC field except GPA/registration is required (HSC/SSC required-fields audit §6/§7) — unchanged. */
const REQUIRED_FIELDS: { key: keyof SelfEditableFields; label: string }[] = [
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

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="truncate text-sm font-medium">{value || "—"}</dd></div>;
}

function Section({ icon: Icon, title, note, children }: { icon: typeof User; title: string; note?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" aria-hidden />{title}{note && <span className="text-xs font-normal text-muted-foreground">{note}</span>}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}{required && <span className="text-destructive"> *</span>}</Label>{children}</div>;
}

export default function StudentProfile() {
  return (
    <StudentPage icon={User} title="আমার প্রোফাইল" description="ব্যক্তিগত, ব্যাচ ও শিক্ষাগত তথ্য — চিহ্নিত অংশগুলো আপনি নিজে হালনাগাদ করতে পারবেন">
      <ProfileBody />
    </StudentPage>
  );
}

function ProfileBody() {
  const { student, batch, directors, updateProfile, uploadPhoto, removePhoto } = useStudentSelf();
  const initial = useMemo<SelfEditableFields>(
    () => Object.fromEntries(EDITABLE_KEYS.map((k) => [k, (student?.[k as keyof typeof student] as string | undefined) || ""])) as unknown as SelfEditableFields,
    [student],
  );
  const [form, setForm] = useState<SelfEditableFields>(initial);
  const [saving, setSaving] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [tab, setTab] = useState("info");
  // student loads asynchronously (GET /students/me) and is replaced after each save — re-seed then.
  useEffect(() => setForm(initial), [initial]);
  const dirty = EDITABLE_KEYS.some((k) => (form[k] ?? "") !== (initial[k] ?? ""));
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!student) return null;
  const update = (k: keyof SelfEditableFields, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const missingRequired = REQUIRED_FIELDS.filter(({ key }) => !String(form[key] ?? "").trim());

  const handleSave = async () => {
    if (missingRequired.length) { toast.error(`${missingRequired[0].label} আবশ্যক`); return; }
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success("প্রোফাইল হালনাগাদ করা হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const completion = student.profileCompletion;
  const percent = completion?.percent ?? 0;
  const missing = (completion?.missingFields ?? []).map((f) => COMPLETION_LABELS[f] ?? f);
  const text = (k: keyof SelfEditableFields, label: string, opts: { required?: boolean; placeholder?: string } = {}) => (
    <Field id={`f-${k}`} label={label} required={opts.required}>
      <Input id={`f-${k}`} value={form[k] ?? ""} onChange={(e) => update(k, e.target.value)} placeholder={opts.placeholder} aria-invalid={opts.required && !String(form[k] ?? "").trim() ? true : undefined} />
    </Field>
  );
  const groupSelect = (k: keyof SelfEditableFields) => (
    <Field id={`f-${k}`} label="বিভাগ" required>
      <Select value={form[k] ?? ""} onValueChange={(v) => update(k, v)}>
        <SelectTrigger id={`f-${k}`}><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
        <SelectContent>{HSC_SSC_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  );

  return (
    <>
      {/* Identity */}
      <Card className="overflow-hidden">
        <div className="h-16 bg-[hsl(224_64%_22%)]" aria-hidden />
        <CardContent className="relative -mt-10 flex flex-col gap-4 pb-5 sm:flex-row sm:items-end">
          <button type="button" onClick={() => setPhotoOpen(true)} className="group relative w-fit shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={student.photo ? "ছবি পরিবর্তন করুন" : "ছবি আপলোড করুন"}>
            <Avatar className="h-20 w-20 border-4 border-card shadow-sm">
              {student.photo && <AvatarImage src={student.photo} alt="" className="object-cover" />}
              <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">{student.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground"><Camera className="h-3.5 w-3.5" aria-hidden /></span>
          </button>
          <div className="min-w-0 flex-1 sm:pb-1 sm:pt-12">
            <h2 className="truncate text-xl font-bold">{student.name}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
              <Badge variant="outline">রেজি. {student.rollNumber || "—"}</Badge>
              <Badge variant="outline">আইডি {student.studentId}</Badge>
              {student.course && <Badge variant="secondary">{student.course}</Badge>}
              {batch && <Badge variant="secondary">{batch.name}</Badge>}
            </div>
          </div>
          <div className="w-full rounded-lg border bg-card p-3 sm:w-64 sm:shrink-0">
            <div className="flex items-center justify-between text-xs"><span className="font-medium">প্রোফাইল সম্পূর্ণতা</span><b className={cn("tabular-nums", percent < 100 ? "text-warning" : "text-success")}>{percent}%</b></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", percent < 100 ? "bg-warning" : "bg-success")} style={{ width: `${percent}%` }} /></div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{missing.length ? `বাকি: ${missing.join(", ")}` : "সব তথ্য দেওয়া আছে"}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="info">তথ্য</TabsTrigger>
          <TabsTrigger value="edit" className="gap-1.5"><Pencil className="h-3.5 w-3.5" aria-hidden />সম্পাদনা{dirty && <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-label="অসংরক্ষিত পরিবর্তন" />}</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Section icon={ShieldCheck} title="অ্যাডমিন কর্তৃক নির্ধারিত" note="(পরিবর্তনের জন্য অফিসে যোগাযোগ করুন)">
            <dl className="grid grid-cols-2 gap-4">
              <Info label="নাম" value={student.name} />
              <Info label="সিস্টেম আইডি" value={student.studentId} />
              <Info label="রেজিস্ট্রেশন / রোল" value={student.rollNumber} />
              <Info label="ভর্তির তারিখ" value={student.admissionDate} />
              <Info label="জন্ম তারিখ" value={student.dob} />
              <Info label="রক্তের গ্রুপ" value={student.bloodGroup} />
            </dl>
          </Section>
          <Section icon={Phone} title="যোগাযোগ">
            <dl className="grid grid-cols-2 gap-4">
              <Info label="মোবাইল" value={student.mobile} />
              <Info label="অভিভাবকের মোবাইল" value={student.guardianMobile} />
              <Info label="অভিভাবক" value={[student.guardianName, student.guardianRelation].filter(Boolean).join(" · ")} />
              <Info label="বর্তমান ঠিকানা" value={student.presentAddress} />
            </dl>
          </Section>
          <Section icon={Layers} title="কোর্স ও ব্যাচ">
            <dl className="grid grid-cols-2 gap-4">
              <Info label="কোর্স" value={student.course} />
              <Info label="ব্যাচ" value={batch?.name} />
              <Info label="সময়" value={batch?.batchTime} />
              <Info label="রুম" value={batch?.roomNumber} />
              <Info label="দিন" value={batch?.days.join(", ")} />
              <Info label="ব্যাচ ডিরেক্টর" value={directors.map((d) => d.name).join(", ")} />
            </dl>
          </Section>
          <Section icon={GraduationCap} title="শিক্ষাগত তথ্য">
            <dl className="grid grid-cols-2 gap-4">
              <Info label="HSC প্রতিষ্ঠান" value={student.hscInstitution} />
              <Info label="HSC সাল · বিভাগ" value={[student.hscPassingYear, student.hscGroup].filter(Boolean).join(" · ")} />
              <Info label="SSC প্রতিষ্ঠান" value={student.sscInstitution} />
              <Info label="SSC সাল · বিভাগ" value={[student.sscPassingYear, student.sscGroup].filter(Boolean).join(" · ")} />
            </dl>
            <Button variant="link" className="mt-2 h-auto p-0" onClick={() => setTab("edit")}>তথ্য হালনাগাদ করুন →</Button>
          </Section>
        </TabsContent>

        <TabsContent value="edit" className="mt-4 space-y-4">
          <Section icon={Users} title="অভিভাবক">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {text("guardianName", "অভিভাবকের নাম", { placeholder: "অভিভাবকের নাম" })}
              <Field id="f-guardianRelation" label="সম্পর্ক">
                <Select value={form.guardianRelation ?? ""} onValueChange={(v) => update("guardianRelation", v)}>
                  <SelectTrigger id="f-guardianRelation"><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>{RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field id="f-guardianMobile" label="অভিভাবকের মোবাইল (অ্যাডমিন কর্তৃক)"><Input id="f-guardianMobile" value={student.guardianMobile ?? ""} readOnly disabled className="bg-muted/50" /></Field>
            </div>
          </Section>
          <Section icon={Home} title="ঠিকানা">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {text("presentAddress", "বর্তমান ঠিকানা", { placeholder: "বর্তমান ঠিকানা" })}
              {text("permanentAddress", "স্থায়ী ঠিকানা", { placeholder: "স্থায়ী ঠিকানা" })}
            </div>
          </Section>
          <Section icon={GraduationCap} title="HSC তথ্য">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field id="f-hscInstitution" label="প্রতিষ্ঠান" required><HscInstitutionCombobox value={form.hscInstitution || ""} onChange={(v) => update("hscInstitution", v)} /></Field>
              {text("hscBoard", "বোর্ড", { required: true })}
              {text("hscPassingYear", "পাসের সাল", { required: true, placeholder: "২০২৪" })}
              {groupSelect("hscGroup")}
              {text("hscRoll", "রোল নম্বর", { required: true })}
              {text("hscRegistrationNumber", "রেজিস্ট্রেশন নম্বর (ঐচ্ছিক)")}
              {text("hscGpa", "জিপিএ", { placeholder: "৫.০০" })}
            </div>
          </Section>
          <Section icon={GraduationCap} title="SSC তথ্য">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {text("sscInstitution", "প্রতিষ্ঠান", { required: true })}
              {text("sscBoard", "বোর্ড", { required: true })}
              {text("sscPassingYear", "পাসের সাল", { required: true, placeholder: "২০২২" })}
              {groupSelect("sscGroup")}
              {text("sscRoll", "রোল নম্বর", { required: true })}
              {text("sscRegistrationNumber", "রেজিস্ট্রেশন নম্বর (ঐচ্ছিক)")}
              {text("sscGpa", "জিপিএ", { placeholder: "৫.০০" })}
            </div>
          </Section>
          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
            {dirty && <span className="mr-auto text-sm text-warning">অসংরক্ষিত পরিবর্তন আছে</span>}
            {!dirty && missingRequired.length > 0 && <span className="mr-auto text-sm text-muted-foreground">{missingRequired.length}টি আবশ্যক তথ্য বাকি</span>}
            <Button variant="outline" disabled={!dirty || saving} onClick={() => setForm(initial)}>বাতিল</Button>
            <Button onClick={handleSave} disabled={saving || !dirty}>{saving ? "সংরক্ষণ হচ্ছে..." : "প্রোফাইল সংরক্ষণ করুন"}</Button>
          </div>
        </TabsContent>
      </Tabs>

      <StudentPhotoUploader open={photoOpen} onOpenChange={setPhotoOpen} studentName={student.name} currentPhotoUrl={student.photo} onUpload={uploadPhoto} onRemove={removePhoto} />
    </>
  );
}
