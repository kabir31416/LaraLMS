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
import {
  COURSES,
  SECTIONS,
  GROUPS,
  CLASSES,
  SUBJECTS,
  GENDERS,
  RELATIONS,
  FEE_TYPES,
} from "@/types/student";
import type { Student, FeeType } from "@/types/student";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiClientError } from "@/contexts/AuthContext";

interface AdmissionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editStudent?: Student | null;
}

export function AdmissionForm({ open, onOpenChange, editStudent }: AdmissionFormProps) {
  const { addStudent, updateStudent } = useStudents();
  const isEdit = !!editStudent;

  const [form, setForm] = useState(() => getInitialForm(editStudent));
  const [dob, setDob] = useState<Date | undefined>(editStudent?.dob ? new Date(editStudent.dob) : undefined);
  const [admissionDate, setAdmissionDate] = useState<Date | undefined>(
    editStudent?.admissionDate ? new Date(editStudent.admissionDate) : new Date()
  );
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(editStudent?.subjects || []);

  function getInitialForm(student?: Student | null) {
    if (student) {
      return {
        rollNumber: student.rollNumber || "",
        name: student.name,
        mobile: student.mobile,
        altMobile: student.altMobile || "",
        email: student.email || "",
        gender: student.gender,
        institution: student.institution,
        class: student.class,
        guardianName: student.guardianName,
        guardianRelation: student.guardianRelation,
        guardianMobile: student.guardianMobile,
        address: student.address,
        course: student.course,
        section: student.section,
        group: student.group,
        admissionType: student.admissionType,
        feeType: student.feeType as string,
        courseDuration: student.courseDuration,
        totalCourseFee: student.totalCourseFee,
        admissionFee: student.admissionFee,
        monthlyFee: student.monthlyFee,
        discount: student.discount,
        paid: student.paid,
      };
    }
    return {
      rollNumber: "",
      name: "",
      mobile: "",
      altMobile: "",
      email: "",
      gender: "" as string,
      institution: "",
      class: "" as string,
      guardianName: "",
      guardianRelation: "",
      guardianMobile: "",
      address: "",
      course: "" as string,
      section: "" as string,
      group: "" as string,
      admissionType: "নতুন" as string,
      feeType: "এককালীন" as string,
      courseDuration: 12,
      totalCourseFee: 0,
      admissionFee: 0,
      monthlyFee: 0,
      discount: 0,
      paid: 0,
    };
  }

  const isOneTime = form.feeType === "এককালীন";
  const totalFee = isOneTime
    ? Number(form.totalCourseFee) + Number(form.admissionFee) - Number(form.discount)
    : Number(form.admissionFee) + Number(form.monthlyFee) * Number(form.courseDuration) - Number(form.discount);
  const due = totalFee - Number(form.paid);

  const updateField = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Only these five fields are required — everything else can be
    // completed later, by an admin editing this same form or by the
    // student themself once self-service profile completion (Module 27)
    // ships. Roll Number + phone are also what the Student Portal login is
    // built from (identifier = phone, password = phone's last 6 digits),
    // so a saved student is always immediately able to log in.
    if (!form.name || !form.mobile || !form.rollNumber || !dob || !form.guardianMobile) {
      toast.error("নাম, মোবাইল নম্বর, রোল নম্বর, জন্ম তারিখ ও অভিভাবকের মোবাইল নম্বর আবশ্যক");
      return;
    }

    const studentData = {
      rollNumber: form.rollNumber || undefined,
      name: form.name,
      mobile: form.mobile,
      altMobile: form.altMobile || undefined,
      email: form.email || undefined,
      dob: dob ? format(dob, "yyyy-MM-dd") : "",
      gender: form.gender as Student["gender"],
      institution: form.institution,
      class: form.class,
      guardianName: form.guardianName,
      guardianRelation: form.guardianRelation,
      guardianMobile: form.guardianMobile,
      address: form.address,
      course: form.course,
      section: form.section,
      group: form.group,
      subjects: selectedSubjects,
      admissionDate: admissionDate ? format(admissionDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      admissionType: form.admissionType as Student["admissionType"],
      feeType: form.feeType as FeeType,
      courseDuration: Number(form.courseDuration),
      totalCourseFee: Number(form.totalCourseFee),
      admissionFee: Number(form.admissionFee),
      monthlyFee: isOneTime ? 0 : Number(form.monthlyFee),
      discount: Number(form.discount),
      totalFee,
      paid: Number(form.paid),
      due,
    };

    setSubmitting(true);
    try {
      if (isEdit && editStudent) {
        await updateStudent(editStudent.id, studentData);
        toast.success("শিক্ষার্থীর তথ্য হালনাগাদ করা হয়েছে");
      } else {
        await addStudent(studentData);
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
                  <Label>মোবাইল নম্বর *</Label>
                  <Input value={form.mobile} onChange={(e) => updateField("mobile", e.target.value)} placeholder="01XXXXXXXXX" />
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
                  <Label>লিঙ্গ</Label>
                  <Select value={form.gender} onValueChange={(v) => updateField("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>প্রতিষ্ঠান/স্কুল নাম</Label>
                  <Input value={form.institution} onChange={(e) => updateField("institution", e.target.value)} placeholder="প্রতিষ্ঠানের নাম" />
                </div>
                <div className="space-y-1.5">
                  <Label>শ্রেণি</Label>
                  <Select value={form.class} onValueChange={(v) => updateField("class", v)}>
                    <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>
                      {CLASSES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
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
            </section>

            {/* Academic Info */}
            <section>
              <h3 className="text-sm font-semibold text-primary mb-3 border-b border-border pb-2">
                একাডেমিক তথ্য
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>কোর্স</Label>
                  <Select value={form.course} onValueChange={(v) => updateField("course", v)}>
                    <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>
                      {COURSES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>রোল নম্বর *</Label>
                  <Input value={form.rollNumber} onChange={(e) => updateField("rollNumber", e.target.value)} placeholder="যেমন: ০৭" />
                  <p className="text-xs text-muted-foreground">অ্যাডমিন কর্তৃক নির্ধারিত — ব্যাচ পরিবর্তনের সময় প্রয়োজনে পরিবর্তনযোগ্য</p>
                </div>
                <div className="space-y-1.5">
                  <Label>ব্যাচ</Label>
                  <div className="h-10 px-3 flex items-center text-sm text-muted-foreground border rounded-md bg-muted/30">
                    ব্যাচ মডিউল থেকে assign করুন
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>সেকশন</Label>
                  <Select value={form.section} onValueChange={(v) => updateField("section", v)}>
                    <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>
                      {SECTIONS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>গ্রুপ</Label>
                  <Select value={form.group} onValueChange={(v) => updateField("group", v)}>
                    <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>
                      {GROUPS.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}
                    </SelectContent>
                  </Select>
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
                <div className="space-y-1.5">
                  <Label>ভর্তি ধরন</Label>
                  <Select value={form.admissionType} onValueChange={(v) => updateField("admissionType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="নতুন">নতুন</SelectItem>
                      <SelectItem value="পুরাতন">পুরাতন</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>বিষয়সমূহ</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border rounded-lg p-3 bg-muted/30">
                    {SUBJECTS.map((subject) => (
                      <label key={subject} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={selectedSubjects.includes(subject)} onCheckedChange={() => toggleSubject(subject)} />
                        {subject}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Fees Info */}
            <section>
              <h3 className="text-sm font-semibold text-primary mb-3 border-b border-border pb-2">
                ফি তথ্য
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>ফি ধরন</Label>
                  <Select value={form.feeType} onValueChange={(v) => updateField("feeType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FEE_TYPES.map((ft) => (<SelectItem key={ft} value={ft}>{ft}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>কোর্স সময়কাল (মাস)</Label>
                  <Input type="number" value={form.courseDuration} onChange={(e) => updateField("courseDuration", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>ভর্তি ফি (৳)</Label>
                  <Input type="number" value={form.admissionFee} onChange={(e) => updateField("admissionFee", Number(e.target.value))} />
                </div>

                {isOneTime ? (
                  <div className="space-y-1.5">
                    <Label>মোট কোর্স ফি (৳)</Label>
                    <Input type="number" value={form.totalCourseFee} onChange={(e) => updateField("totalCourseFee", Number(e.target.value))} />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>মাসিক ফি (৳)</Label>
                    <Input type="number" value={form.monthlyFee} onChange={(e) => updateField("monthlyFee", Number(e.target.value))} />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>ডিসকাউন্ট (৳)</Label>
                  <Input type="number" value={form.discount} onChange={(e) => updateField("discount", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>পরিশোধিত (৳)</Label>
                  <Input type="number" value={form.paid} onChange={(e) => updateField("paid", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>মোট ফি (৳)</Label>
                  <Input value={totalFee} readOnly className="bg-muted/50" />
                </div>
                <div className="space-y-1.5">
                  <Label>বাকি (৳)</Label>
                  <Input value={due} readOnly className={cn("bg-muted/50", due > 0 && "text-destructive font-semibold")} />
                </div>
              </div>
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
