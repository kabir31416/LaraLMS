import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HscInstitutionCombobox } from "@/components/common/HscInstitutionCombobox";
import { RELATIONS, HSC_SSC_GROUPS } from "@/types/student";
import { useStudentSelf } from "./useStudentSelf";
import type { SelfEditableFields } from "@/contexts/StudentSelfContext";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";
import { StudentPhotoUploader } from "@/components/students/photo/StudentPhotoUploader";
import { Camera } from "lucide-react";

function Field({ label, value }: { label: string; value?: string | number }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value || "—"}</p></div>;
}

/** Admin-set — always shown read-only, never as an editable input, so a student never mistakes these for something they can change (Phase 4 §9). */
function ReadOnlyField({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <Input value={value ?? ""} readOnly disabled className="bg-muted/50" />
    </div>
  );
}

export default function StudentProfile() {
  const { user, student, batch, directors, updateProfile, uploadPhoto, removePhoto } = useStudentSelf();
  const [form, setForm] = useState<SelfEditableFields>(() => initForm());
  const [saving, setSaving] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  function initForm(): SelfEditableFields {
    return {
      presentAddress: student?.presentAddress || "",
      permanentAddress: student?.permanentAddress || "",
      guardianName: student?.guardianName || "",
      guardianRelation: student?.guardianRelation || "",
      hscInstitution: student?.hscInstitution || "",
      hscBoard: student?.hscBoard || "",
      hscPassingYear: student?.hscPassingYear || "",
      hscGroup: student?.hscGroup || "",
      hscGpa: student?.hscGpa || "",
      hscRoll: student?.hscRoll || "",
      hscRegistrationNumber: student?.hscRegistrationNumber || "",
      sscInstitution: student?.sscInstitution || "",
      sscBoard: student?.sscBoard || "",
      sscPassingYear: student?.sscPassingYear || "",
      sscGroup: student?.sscGroup || "",
      sscGpa: student?.sscGpa || "",
      sscRoll: student?.sscRoll || "",
      sscRegistrationNumber: student?.sscRegistrationNumber || "",
    };
  }

  /** Every HSC/SSC field except GPA is required (HSC/SSC required-fields audit §6/§7). */
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

  // student loads asynchronously (GET /students/me) — the lazy useState
  // initializer above only runs once, on mount, before that data can
  // possibly have arrived, so the form is re-seeded here the moment it does.
  useEffect(() => {
    if (student) setForm(initForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;

  const update = (k: keyof SelfEditableFields, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    for (const { key, label } of REQUIRED_FIELDS) {
      if (!String(form[key] ?? "").trim()) {
        toast.error(`${label} আবশ্যক`);
        return;
      }
    }
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

  const percent = student.profileCompletion?.percent ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">আমার প্রোফাইল</h1>

        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-3">
            <button type="button" onClick={() => setPhotoOpen(true)} className="relative group" title="ছবি পরিবর্তন করুন">
              <Avatar className="h-24 w-24 border-4 border-muted">
                {student.photo && <AvatarImage src={student.photo} alt={student.name} className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{student.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-6 w-6 text-white" />
              </span>
            </button>
            <Button variant="outline" size="sm" onClick={() => setPhotoOpen(true)}>
              <Camera className="h-4 w-4 mr-2" /> {student.photo ? "ছবি পরিবর্তন করুন" : "ছবি আপলোড করুন"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">প্রোফাইল সম্পূর্ণতা</p>
              <p className="text-sm font-semibold text-primary">{percent}%</p>
            </div>
            <Progress value={percent} />
            {percent < 100 && (
              <p className="text-xs text-muted-foreground mt-2">নিচের ফর্ম পূরণ করে আপনার প্রোফাইল সম্পূর্ণ করুন — অভিভাবক, ঠিকানা ও শিক্ষাগত তথ্য যোগ করুন।</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">অ্যাডমিন কর্তৃক নির্ধারিত তথ্য</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="নাম" value={student.name} />
            <Field label="Registration ID" value={student.studentId} />
            <Field label="রোল নম্বর" value={student.rollNumber} />
            <Field label="মোবাইল" value={student.mobile} />
            <Field label="জন্ম তারিখ" value={student.dob} />
            <Field label="রক্তের গ্রুপ" value={student.bloodGroup} />
            <Field label="অভিভাবকের মোবাইল" value={student.guardianMobile} />
            <Field label="কোর্স" value={student.course} />
            <Field label="ভর্তির তারিখ" value={student.admissionDate} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">ব্যাচ তথ্য</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="ব্যাচ" value={batch?.name} />
            <Field label="সময়" value={batch?.batchTime} />
            <Field label="রুম" value={batch?.roomNumber} />
            <Field label="দিন" value={batch?.days.join(", ")} />
            <Field label="ব্যাচ ডিরেক্টর" value={directors.length ? directors.map((d) => d.name).join(", ") : undefined} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">অভিভাবকের তথ্য (সম্পাদনাযোগ্য)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>অভিভাবকের নাম</Label>
              <Input value={form.guardianName} onChange={(e) => update("guardianName", e.target.value)} placeholder="অভিভাবকের নাম" />
            </div>
            <div className="space-y-1.5">
              <Label>সম্পর্ক</Label>
              <Select value={form.guardianRelation} onValueChange={(v) => update("guardianRelation", v)}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>{RELATIONS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <ReadOnlyField label="অভিভাবকের মোবাইল (অ্যাডমিন কর্তৃক নির্ধারিত)" value={student.guardianMobile} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">ঠিকানা (সম্পাদনাযোগ্য)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>বর্তমান ঠিকানা</Label>
              <Input value={form.presentAddress} onChange={(e) => update("presentAddress", e.target.value)} placeholder="বর্তমান ঠিকানা" />
            </div>
            <div className="space-y-1.5">
              <Label>স্থায়ী ঠিকানা</Label>
              <Input value={form.permanentAddress} onChange={(e) => update("permanentAddress", e.target.value)} placeholder="স্থায়ী ঠিকানা" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">HSC তথ্য (সম্পাদনাযোগ্য)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label>প্রতিষ্ঠান *</Label><HscInstitutionCombobox value={form.hscInstitution || ""} onChange={(v) => update("hscInstitution", v)} /></div>
            <div className="space-y-1.5"><Label>বোর্ড *</Label><Input value={form.hscBoard} onChange={(e) => update("hscBoard", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>পাসের সাল *</Label><Input value={form.hscPassingYear} onChange={(e) => update("hscPassingYear", e.target.value)} placeholder="২০২৪" /></div>
            <div className="space-y-1.5">
              <Label>বিভাগ *</Label>
              <Select value={form.hscGroup} onValueChange={(v) => update("hscGroup", v)}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>{HSC_SSC_GROUPS.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>রোল নম্বর *</Label><Input value={form.hscRoll} onChange={(e) => update("hscRoll", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>রেজিস্ট্রেশন নম্বর (ঐচ্ছিক)</Label><Input value={form.hscRegistrationNumber} onChange={(e) => update("hscRegistrationNumber", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>জিপিএ</Label><Input value={form.hscGpa} onChange={(e) => update("hscGpa", e.target.value)} placeholder="৫.০০" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">SSC তথ্য (সম্পাদনাযোগ্য)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label>প্রতিষ্ঠান *</Label><Input value={form.sscInstitution} onChange={(e) => update("sscInstitution", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>বোর্ড *</Label><Input value={form.sscBoard} onChange={(e) => update("sscBoard", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>পাসের সাল *</Label><Input value={form.sscPassingYear} onChange={(e) => update("sscPassingYear", e.target.value)} placeholder="২০২২" /></div>
            <div className="space-y-1.5">
              <Label>বিভাগ *</Label>
              <Select value={form.sscGroup} onValueChange={(v) => update("sscGroup", v)}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>{HSC_SSC_GROUPS.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>রোল নম্বর *</Label><Input value={form.sscRoll} onChange={(e) => update("sscRoll", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>রেজিস্ট্রেশন নম্বর (ঐচ্ছিক)</Label><Input value={form.sscRegistrationNumber} onChange={(e) => update("sscRegistrationNumber", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>জিপিএ</Label><Input value={form.sscGpa} onChange={(e) => update("sscGpa", e.target.value)} placeholder="৫.০০" /></div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>{saving ? "সংরক্ষণ হচ্ছে..." : "প্রোফাইল সংরক্ষণ করুন"}</Button>
        </div>
      </div>

      <StudentPhotoUploader
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        studentName={student.name}
        currentPhotoUrl={student.photo}
        onUpload={uploadPhoto}
        onRemove={removePhoto}
      />
    </DashboardLayout>
  );
}
