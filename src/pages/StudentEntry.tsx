import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GraduationCap, Camera, User } from "lucide-react";
import { toast } from "sonner";
import { ApiClientError } from "@/lib/apiClient";
import { RELATIONS, HSC_SSC_GROUPS } from "@/types/student";
import { studentEntryApi, setStudentEntryToken } from "@/lib/studentEntryClient";
import { StudentPhotoUploader } from "@/components/students/photo/StudentPhotoUploader";
import { HscInstitutionCombobox } from "@/components/common/HscInstitutionCombobox";

/** HSC Institution Autocomplete audit §4 — same master-data list, reached through this page's own short-lived entryToken (never the Admin/Portal session apiClient.ts manages) via the dedicated public endpoint (task #203). */
async function fetchHscInstitutionsForEntry(search: string): Promise<{ _id: string; name: string }[]> {
  const qs = new URLSearchParams({ limit: "8" });
  if (search) qs.set("search", search);
  return studentEntryApi.get<{ _id: string; name: string }[]>(`/hsc-institutions?${qs.toString()}`);
}

/**
 * Public, no-login Student Entry (Student Photo Management §10-§15) — lets a
 * student verify with Registration Number/Roll + phone and then upload/
 * update their own photo and the same basic profile fields the Student
 * Portal already lets them self-edit. Every call after /verify carries a
 * short-lived token (studentEntryClient.ts) that identifies the student
 * server-side — never a client-supplied ID, and never enough to touch
 * anything an Admin/Staff session could (registrationId, course, batch,
 * fees, results, attendance, etc. are never even sent to this page).
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

/**
 * Guardian পেশা/ঠিকানা audit §9 — removed from this form's editable fields
 * (and no longer sent in the save payload); any value a student had
 * previously saved stays in the database untouched, it just isn't shown or
 * editable here anymore. `dob` is now student-editable here too (DOB
 * self-edit audit §3) instead of the admin-only read-only Field it used to
 * be.
 */
type EditableFields = Pick<
  EntryProfile,
  | "presentAddress" | "permanentAddress" | "division" | "district" | "upazila" | "postOffice" | "postcode" | "village"
  | "hscInstitution" | "hscBoard" | "hscPassingYear" | "hscGroup" | "hscGpa" | "hscRoll" | "hscRegistrationNumber"
  | "sscInstitution" | "sscBoard" | "sscPassingYear" | "sscGroup" | "sscGpa" | "sscRoll" | "sscRegistrationNumber"
  | "guardianName" | "guardianRelation"
> & { dob: string };

/** Every HSC/SSC field except GPA is required (HSC/SSC required-fields audit §6/§7) — dob is required too (§3). */
const REQUIRED_FIELDS: { key: keyof EditableFields; label: string }[] = [
  { key: "dob", label: "জন্ম তারিখ" },
  { key: "hscInstitution", label: "HSC প্রতিষ্ঠান" },
  { key: "hscBoard", label: "HSC বোর্ড" },
  { key: "hscPassingYear", label: "HSC পাসের সাল" },
  { key: "hscGroup", label: "HSC বিভাগ" },
  { key: "hscRoll", label: "HSC রোল নম্বর" },
  { key: "hscRegistrationNumber", label: "HSC রেজিস্ট্রেশন নম্বর" },
  { key: "sscInstitution", label: "SSC প্রতিষ্ঠান" },
  { key: "sscBoard", label: "SSC বোর্ড" },
  { key: "sscPassingYear", label: "SSC পাসের সাল" },
  { key: "sscGroup", label: "SSC বিভাগ" },
  { key: "sscRoll", label: "SSC রোল নম্বর" },
  { key: "sscRegistrationNumber", label: "SSC রেজিস্ট্রেশন নম্বর" },
];

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

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export default function StudentEntry() {
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [profile, setProfile] = useState<EntryProfile | null>(null);
  const [form, setForm] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !phone.trim()) {
      toast.error("রেজিস্ট্রেশন নম্বর/রোল ও মোবাইল নম্বর দিন");
      return;
    }
    setVerifying(true);
    try {
      const { token } = await studentEntryApi.post<{ token: string }>("/verify", { identifier: identifier.trim(), phone: phone.trim() });
      setStudentEntryToken(token);
      const data = await studentEntryApi.get<EntryProfile>("/profile");
      setProfile(data);
      setForm(editableFieldsFrom(data));
    } catch (err) {
      setStudentEntryToken(null);
      toast.error(friendlyError(err, "শিক্ষার্থীর তথ্য যাচাই করা যায়নি। রেজিস্ট্রেশন নম্বর/রোল ও মোবাইল নম্বর আবার পরীক্ষা করুন।"));
    } finally {
      setVerifying(false);
    }
  };

  const update = (k: keyof EditableFields, v: string) => setForm((p) => (p ? { ...p, [k]: v } : p));

  const handleSave = async () => {
    if (!form) return;
    // Student Entry Workflow §10 — a still-pending application must have a
    // photo before it can be saved/completed; the backend independently
    // enforces this same rule (publicStudentEntry.service.ts's updateProfile).
    if (profile?.admissionStatus === "pending" && !profile.photo) {
      toast.error("প্রোফাইল সংরক্ষণের আগে একটি ছবি আপলোড করুন");
      return;
    }
    for (const { key, label } of REQUIRED_FIELDS) {
      if (!String(form[key] ?? "").trim()) {
        toast.error(`${label} আবশ্যক`);
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await studentEntryApi.patch<EntryProfile>("/profile", form);
      setProfile(updated);
      setForm(editableFieldsFrom(updated));
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
    setStudentEntryToken(null);
    setProfile(null);
    setForm(null);
    setIdentifier("");
    setPhone("");
  };

  if (!profile || !form) {
    return (
      <main className="min-h-screen bg-muted/30 p-4">
        <div className="max-w-md mx-auto space-y-4 py-10">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">শিক্ষার্থী এন্ট্রি</h1>
            <p className="text-sm text-muted-foreground">আপনার প্রোফাইল ছবি ও তথ্য আপডেট করতে যাচাই করুন — লগইন প্রয়োজন নেই</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>রেজিস্ট্রেশন নম্বর / রোল</Label>
                  <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="যেমন: REG-1023 অথবা ১২" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label>মোবাইল নম্বর</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" autoComplete="off" />
                </div>
                <Button type="submit" className="w-full" disabled={verifying}>
                  {verifying ? "যাচাই করা হচ্ছে..." : "যাচাই করুন"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center">
            <Link to="/login" className="text-sm text-primary hover:underline">লগইন পেইজে ফিরে যান</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-2xl mx-auto space-y-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">শিক্ষার্থী প্রোফাইল</h1>
          <Button variant="ghost" size="sm" onClick={handleStartOver}>অন্য শিক্ষার্থী</Button>
        </div>

        {profile.admissionStatus === "pending" && (
          <Card className="border-warning/40 bg-warning/10">
            <CardContent className="py-3 text-sm text-warning-foreground">
              আপনার আবেদনটি এখনো অ্যাডমিন অনুমোদনের অপেক্ষায় আছে। নিচের তথ্য ও একটি ছবি দিয়ে প্রোফাইল সম্পূর্ণ করুন — অনুমোদনের পর আপনি ব্যাচে সক্রিয় হবেন।
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-3">
            <button type="button" onClick={() => setPhotoOpen(true)} className="relative group" title="ছবি পরিবর্তন করুন">
              <Avatar className="h-28 w-28 border-4 border-muted">
                {profile.photo && <AvatarImage src={profile.photo} alt={profile.name} className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-6 w-6 text-white" />
              </span>
            </button>
            <Button variant="outline" size="sm" onClick={() => setPhotoOpen(true)}>
              <Camera className="h-4 w-4 mr-2" /> {profile.photo ? "ছবি পরিবর্তন করুন" : "ছবি আপলোড করুন"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">মূল তথ্য</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="নাম" value={profile.name} />
            <Field label="Registration ID" value={profile.registrationId} />
            <Field label="রোল নম্বর" value={profile.rollNumber} />
            <Field label="মোবাইল" value={profile.phone} />
            <div className="space-y-1.5">
              <Label>জন্ম তারিখ *</Label>
              <Input type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} />
            </div>
            <Field label="অভিভাবকের মোবাইল" value={profile.guardianMobile} />
            <Field label="কোর্স" value={profile.course} />
            <Field label="ব্যাচ" value={profile.batchName} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">অভিভাবকের তথ্য (সম্পাদনাযোগ্য)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>অভিভাবকের নাম</Label>
              <Input value={form.guardianName} onChange={(e) => update("guardianName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>সম্পর্ক</Label>
              <Select value={form.guardianRelation} onValueChange={(v) => update("guardianRelation", v)}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>{RELATIONS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">ঠিকানা (সম্পাদনাযোগ্য)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>বর্তমান ঠিকানা</Label><Input value={form.presentAddress} onChange={(e) => update("presentAddress", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>স্থায়ী ঠিকানা</Label><Input value={form.permanentAddress} onChange={(e) => update("permanentAddress", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">HSC তথ্য (সম্পাদনাযোগ্য)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>প্রতিষ্ঠান *</Label>
              <HscInstitutionCombobox value={form.hscInstitution} onChange={(v) => update("hscInstitution", v)} fetchOptions={fetchHscInstitutionsForEntry} />
            </div>
            <div className="space-y-1.5"><Label>বোর্ড *</Label><Input value={form.hscBoard} onChange={(e) => update("hscBoard", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>পাসের সাল *</Label><Input value={form.hscPassingYear} onChange={(e) => update("hscPassingYear", e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>বিভাগ *</Label>
              <Select value={form.hscGroup} onValueChange={(v) => update("hscGroup", v)}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>{HSC_SSC_GROUPS.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>রোল নম্বর *</Label><Input value={form.hscRoll} onChange={(e) => update("hscRoll", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>রেজিস্ট্রেশন নম্বর *</Label><Input value={form.hscRegistrationNumber} onChange={(e) => update("hscRegistrationNumber", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>জিপিএ</Label><Input value={form.hscGpa} onChange={(e) => update("hscGpa", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">SSC তথ্য (সম্পাদনাযোগ্য)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label>প্রতিষ্ঠান *</Label><Input value={form.sscInstitution} onChange={(e) => update("sscInstitution", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>বোর্ড *</Label><Input value={form.sscBoard} onChange={(e) => update("sscBoard", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>পাসের সাল *</Label><Input value={form.sscPassingYear} onChange={(e) => update("sscPassingYear", e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>বিভাগ *</Label>
              <Select value={form.sscGroup} onValueChange={(v) => update("sscGroup", v)}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>{HSC_SSC_GROUPS.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>রোল নম্বর *</Label><Input value={form.sscRoll} onChange={(e) => update("sscRoll", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>রেজিস্ট্রেশন নম্বর *</Label><Input value={form.sscRegistrationNumber} onChange={(e) => update("sscRegistrationNumber", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>জিপিএ</Label><Input value={form.sscGpa} onChange={(e) => update("sscGpa", e.target.value)} /></div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>{saving ? "সংরক্ষণ হচ্ছে..." : "প্রোফাইল সংরক্ষণ করুন"}</Button>
        </div>
      </div>

      <StudentPhotoUploader
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        studentName={profile.name}
        currentPhotoUrl={profile.photo}
        onUpload={handlePhotoUpload}
      />
    </main>
  );
}
