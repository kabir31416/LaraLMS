import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import { useStudents } from "@/contexts/StudentContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { AcademicSelect } from "@/components/common/AcademicSelect";
import { HscInstitutionCombobox } from "@/components/common/HscInstitutionCombobox";
import { GENDERS, RELATIONS } from "@/types/student";
import type { Student } from "@/types/student";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApiClientError } from "@/contexts/AuthContext";

interface AdmissionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editStudent?: Student | null;
}

/**
 * Minimum-fields Admission Form (Phase 4). Only these six are required to
 * save an admission: name, mobile, DOB, Registration Number (Roll), Guardian
 * Mobile, Course — everything else the student completes later via the
 * Portal. Course Fee is never typed here: it's read straight from the
 * selected Course's own settings (Settings → Courses), and the fixed
 * Admission Fee (৳200) is never editable from this form either — both are
 * enforced again server-side regardless of what this form sends.
 */
export function AdmissionForm({ open, onOpenChange, editStudent }: AdmissionFormProps) {
  const { addStudent, updateStudent } = useStudents();
  const { getCourse, settings, activePaymentMethods } = useAcademic();
  const isEdit = !!editStudent;
  const admissionFeeBdt = settings.admissionFeeBdt;

  const [form, setForm] = useState(() => getInitialForm(editStudent));
  const [dob, setDob] = useState<Date | undefined>(editStudent?.dob ? new Date(editStudent.dob) : undefined);
  const [admissionDate, setAdmissionDate] = useState<Date | undefined>(
    editStudent?.admissionDate ? new Date(editStudent.admissionDate) : new Date()
  );
  // The displayed/stored Course Fee — follows the live Course setting only
  // when the admin actively picks a course here, so re-opening this form to
  // edit an already-admitted student shows their *original* fee, never a
  // Course Fee that was changed in Settings afterward (Phase 4 §19).
  const [courseFee, setCourseFee] = useState<number>(editStudent?.totalCourseFee ?? 0);

  function getInitialForm(student?: Student | null) {
    if (student) {
      return {
        rollNumber: student.rollNumber || "",
        name: student.name,
        mobile: student.mobile,
        altMobile: student.altMobile || "",
        email: student.email || "",
        gender: student.gender,
        bloodGroup: student.bloodGroup || "",
        guardianName: student.guardianName,
        guardianRelation: student.guardianRelation,
        guardianMobile: student.guardianMobile,
        address: student.address,
        courseId: student.courseId || "",
        hscInstitution: student.hscInstitution || "",
        // The admin's "what the student actually agreed to pay for the
        // course" figure (Fees/Payment audit §1) — Discount is DERIVED from
        // Course Fee minus this, never entered directly. Re-deriving it here
        // from the student's already-stored totalCourseFee/discount shows
        // exactly today's agreed price when re-opening this form to edit.
        totalFee: Math.max(0, student.totalCourseFee - student.discount),
        paid: 0,
        paymentMethod: "নগদ" as string,
      };
    }
    return {
      rollNumber: "",
      name: "",
      mobile: "",
      altMobile: "",
      email: "",
      gender: "" as string,
      bloodGroup: "",
      guardianName: "",
      guardianRelation: "",
      guardianMobile: "",
      address: "",
      courseId: "" as string,
      hscInstitution: "",
      totalFee: 0,
      paid: 0,
      paymentMethod: "নগদ" as string,
    };
  }

  const totalFeeNum = Number(form.totalFee) || 0;
  // Preview only — the server always derives and persists the authoritative
  // discount itself from Course Fee - Total Fee (student.service.ts's
  // computeFees); this is just so the admin sees it before saving.
  const discountPreview = Math.max(0, courseFee - totalFeeNum);
  const totalPayable = totalFeeNum + admissionFeeBdt;
  const due = totalPayable - Number(form.paid);

  const updateField = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onCourseChange = (courseId: string) => {
    updateField("courseId", courseId);
    const fee = getCourse(courseId)?.fee ?? 0;
    setCourseFee(fee);
    // A course change resets the agreed price back to the new course's full
    // fee (no discount) — any discount negotiated for the previous course
    // no longer means anything against a different Course Fee.
    updateField("totalFee", fee);
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Only these six fields are required for a brand-new admission —
    // everything else (guardian details, HSC/SSC, address, photo, ...) the
    // student completes themself later via the Student Portal (Phase 4
    // §1/§3). Editing an existing student never re-demands Course: a
    // record admitted before this field existed must stay editable without
    // being forced to pick one now (Phase 4 §11 backward compatibility).
    if (!form.name || !form.mobile || !form.rollNumber || !dob || !form.guardianMobile || (!isEdit && !form.courseId)) {
      toast.error("নাম, মোবাইল নম্বর, রোল নম্বর, জন্ম তারিখ, অভিভাবকের মোবাইল ও কোর্স আবশ্যক");
      return;
    }

    const studentData: Record<string, unknown> = {
      rollNumber: form.rollNumber || undefined,
      name: form.name,
      mobile: form.mobile,
      altMobile: form.altMobile || undefined,
      email: form.email || undefined,
      dob: dob ? format(dob, "yyyy-MM-dd") : "",
      gender: form.gender as Student["gender"],
      bloodGroup: form.bloodGroup || undefined,
      guardianName: form.guardianName,
      guardianRelation: form.guardianRelation,
      guardianMobile: form.guardianMobile,
      address: form.address,
      hscInstitution: form.hscInstitution || undefined,
      admissionDate: admissionDate ? format(admissionDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      totalFee: totalFeeNum,
    };
    // Only send courseId when it actually has a value — for a legacy
    // student with none yet, omitting it (rather than sending "") means
    // the backend leaves their course/fee snapshot untouched entirely.
    if (form.courseId) studentData.courseId = form.courseId;

    if (!isEdit) {
      // A brand-new admission is always the one-time Course Fee + Admission
      // Fee flow (Phase 4 §17) — but an *existing* student may predate this
      // and be on a monthly plan (feeType "মাসিক"), so feeType is only ever
      // forced here on create, never silently rewritten on edit.
      studentData.feeType = "এককালীন";
      studentData.paid = Number(form.paid) || 0;
      if (Number(form.paid) > 0) studentData.paymentMethod = form.paymentMethod;
    }

    setSubmitting(true);
    try {
      if (isEdit && editStudent) {
        await updateStudent(editStudent.id, studentData);
        toast.success("শিক্ষার্থীর তথ্য হালনাগাদ করা হয়েছে");
      } else {
        await addStudent(studentData as never);
        toast.success("নতুন শিক্ষার্থী ভর্তি সম্পন্ন হয়েছে");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-lg font-bold">
            {isEdit ? "শিক্ষার্থীর তথ্য সম্পাদনা" : "নতুন ভর্তি ফর্ম"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh] px-6 pb-6">
          <div className="space-y-6 pt-4">
            {/* Student Info */}
            <section>
              <h3 className="text-sm font-semibold text-primary mb-3 border-b border-border pb-2">
                শিক্ষার্থীর তথ্য
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>শিক্ষার্থীর নাম *</Label>
                  <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="পূর্ণ নাম লিখুন" />
                </div>
                <div className="space-y-1.5">
                  <Label>রোল নম্বর *</Label>
                  <Input value={form.rollNumber} onChange={(e) => updateField("rollNumber", e.target.value)} placeholder="যেমন: ০৭" />
                </div>
                <div className="space-y-1.5">
                  <Label>মোবাইল নম্বর *</Label>
                  <Input value={form.mobile} onChange={(e) => updateField("mobile", e.target.value)} placeholder="01XXXXXXXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>জন্ম তারিখ *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dob && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dob ? format(dob, "dd MMMM yyyy", { locale: bn }) : "তারিখ নির্বাচন করুন"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dob} onSelect={setDob} disabled={(date) => date > new Date()} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label>কোর্স *</Label>
                  <AcademicSelect kind="course" value={form.courseId} onValueChange={onCourseChange} placeholder="কোর্স নির্বাচন করুন" />
                </div>
                <div className="space-y-1.5">
                  <Label>বিকল্প মোবাইল</Label>
                  <Input value={form.altMobile} onChange={(e) => updateField("altMobile", e.target.value)} placeholder="01XXXXXXXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>ইমেইল</Label>
                  <Input value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="example@email.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>লিঙ্গ</Label>
                  <Select value={form.gender} onValueChange={(v) => updateField("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>রক্তের গ্রুপ</Label>
                  <Input value={form.bloodGroup} onChange={(e) => updateField("bloodGroup", e.target.value)} placeholder="যেমন: B+" />
                </div>
                <div className="space-y-1.5">
                  <Label>HSC কলেজ/প্রতিষ্ঠান</Label>
                  <HscInstitutionCombobox value={form.hscInstitution} onChange={(v) => updateField("hscInstitution", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label>ভর্তি তারিখ</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !admissionDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {admissionDate ? format(admissionDate, "dd MMMM yyyy", { locale: bn }) : "তারিখ নির্বাচন করুন"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={admissionDate} onSelect={setAdmissionDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </section>

            {/* Guardian Info */}
            <section>
              <h3 className="text-sm font-semibold text-primary mb-3 border-b border-border pb-2">
                অভিভাবকের তথ্য
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>অভিভাবকের নাম</Label>
                  <Input value={form.guardianName} onChange={(e) => updateField("guardianName", e.target.value)} placeholder="অভিভাবকের নাম" />
                </div>
                <div className="space-y-1.5">
                  <Label>সম্পর্ক</Label>
                  <Select value={form.guardianRelation} onValueChange={(v) => updateField("guardianRelation", v)}>
                    <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>
                      {RELATIONS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>অভিভাবকের মোবাইল *</Label>
                  <Input value={form.guardianMobile} onChange={(e) => updateField("guardianMobile", e.target.value)} placeholder="01XXXXXXXXX" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>ঠিকানা</Label>
                  <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="সম্পূর্ণ ঠিকানা" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                অভিভাবকের পেশা, ঠিকানার বিস্তারিত, HSC-এর বাকি তথ্য (বোর্ড/সাল/গ্রুপ/জিপিএ), SSC তথ্য ও ছবি — ভর্তির পর শিক্ষার্থী নিজে স্টুডেন্ট পোর্টাল থেকে যোগ করতে পারবে।
              </p>
            </section>

            {/* Fee Info */}
            <section>
              <h3 className="text-sm font-semibold text-primary mb-3 border-b border-border pb-2">
                ফি তথ্য
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>কোর্স ফি (৳)</Label>
                  <Input value={courseFee} readOnly className="bg-muted/50" />
                  <p className="text-xs text-muted-foreground">কোর্স সেটিংস থেকে স্বয়ংক্রিয়ভাবে আসে</p>
                </div>
                <div className="space-y-1.5">
                  <Label>ভর্তি ফি (৳)</Label>
                  <Input value={`${admissionFeeBdt} টাকা`} readOnly className="bg-muted/50" />
                  <p className="text-xs text-muted-foreground">নির্দিষ্ট, পরিবর্তনযোগ্য নয়</p>
                </div>
                <div className="space-y-1.5">
                  <Label>মোট ফি (৳)</Label>
                  <Input type="number" value={form.totalFee} onChange={(e) => updateField("totalFee", Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground">শিক্ষার্থী কোর্সের জন্য প্রকৃতপক্ষে যত টাকা দেবে (ছাড়ের পর)</p>
                </div>
                <div className="space-y-1.5">
                  <Label>ছাড় (৳)</Label>
                  <Input value={discountPreview} readOnly className="bg-muted/50" />
                  <p className="text-xs text-muted-foreground">কোর্স ফি ও মোট ফি থেকে স্বয়ংক্রিয়ভাবে হিসাব হয়</p>
                </div>
                <div className="space-y-1.5">
                  <Label>মোট প্রদেয় (৳)</Label>
                  <Input value={totalPayable} readOnly className="bg-muted/50" />
                </div>
                {!isEdit && (
                  <>
                    <div className="space-y-1.5">
                      <Label>ভর্তির সময় প্রদান (৳)</Label>
                      <Input type="number" value={form.paid} onChange={(e) => updateField("paid", Number(e.target.value))} />
                    </div>
                    {Number(form.paid) > 0 && (
                      <div className="space-y-1.5">
                        <Label>পেমেন্ট মাধ্যম</Label>
                        <Select value={form.paymentMethod} onValueChange={(v) => updateField("paymentMethod", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {activePaymentMethods.map((m) => (<SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
                <div className="space-y-1.5">
                  <Label>অবশিষ্ট বকেয়া (৳)</Label>
                  <Input value={isEdit ? editStudent?.due ?? 0 : due} readOnly className={cn("bg-muted/50", (isEdit ? editStudent?.due ?? 0 : due) > 0 && "text-destructive font-semibold")} />
                </div>
              </div>
              {isEdit && (
                <p className="text-xs text-muted-foreground mt-2">
                  ভর্তির পরের পেমেন্ট ফি ম্যানেজমেন্ট পেজ থেকে যোগ করুন — এখান থেকে শুধু কোর্স ও মোট ফি পরিবর্তন করা যাবে।
                </p>
              )}
            </section>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>বাতিল</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "সংরক্ষণ হচ্ছে..." : isEdit ? "হালনাগাদ করুন" : "ভর্তি সম্পন্ন করুন"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
