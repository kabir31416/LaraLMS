import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ApiClientError } from "@/lib/apiClient";
import { newStudentEntryApi } from "@/lib/newStudentEntryClient";

/**
 * Public, no-login quick student entry (/newstudententry) — EXACTLY 5
 * fields (name, roll, student phone, guardian phone, course). Everything
 * else this student will ever have (dob, address, HSC/SSC info, photo,
 * fees, batch, ...) is filled in later through the existing Student
 * Profile — this page's only job is to create a normal Student record via
 * the same production creation path Admission/Bulk Import already use
 * (backend/src/modules/publicNewStudentEntry, a thin wrapper around
 * student.service.ts's create()), never a parallel data structure.
 */
interface CourseOption {
  _id: string;
  name: string;
}

interface RegisterResult {
  name: string;
  rollNumber?: string;
  registrationId: string;
  course?: string;
}

function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export default function NewStudentEntry() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [guardianMobile, setGuardianMobile] = useState("");
  const [courseId, setCourseId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);

  useEffect(() => {
    newStudentEntryApi.get<CourseOption[]>("/courses")
      .then(setCourses)
      .catch(() => toast.error("কোর্সের তালিকা লোড করা যায়নি। পাতাটি রিলোড করুন।"))
      .finally(() => setCoursesLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !rollNumber.trim() || !phone.trim() || !guardianMobile.trim() || !courseId) {
      toast.error("সবগুলো ঘর পূরণ করুন");
      return;
    }
    setSubmitting(true);
    try {
      const data = await newStudentEntryApi.post<RegisterResult>("/", {
        name: name.trim(),
        rollNumber: rollNumber.trim(),
        phone: phone.trim(),
        guardianMobile: guardianMobile.trim(),
        courseId,
      });
      setResult(data);
    } catch (err) {
      toast.error(friendlyError(err, "শিক্ষার্থী যোগ করা যায়নি। আবার চেষ্টা করুন।"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnother = () => {
    setResult(null);
    setName("");
    setRollNumber("");
    setPhone("");
    setGuardianMobile("");
    setCourseId("");
  };

  if (result) {
    return (
      <main className="min-h-screen bg-muted/30 p-4">
        <div className="max-w-md mx-auto space-y-4 py-10">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-xl bg-success flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold">শিক্ষার্থী সফলভাবে যোগ হয়েছে</h1>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">নাম</p>
                <p className="text-sm font-medium">{result.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">রোল নম্বর</p>
                <p className="text-sm font-medium">{result.rollNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registration ID</p>
                <p className="text-sm font-medium font-mono">{result.registrationId}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">কোর্স</p>
                <p className="text-sm font-medium">{result.course || "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Button className="w-full" onClick={handleAnother}>আরেকজন শিক্ষার্থী যোগ করুন</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-md mx-auto space-y-4 py-10">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <GraduationCap className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">নতুন শিক্ষার্থী ভর্তি</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">শিক্ষার্থীর তথ্য</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>শিক্ষার্থীর নাম *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>রোল নম্বর *</Label>
                <Input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>শিক্ষার্থীর মোবাইল নম্বর *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>অভিভাবকের মোবাইল নম্বর *</Label>
                <Input value={guardianMobile} onChange={(e) => setGuardianMobile(e.target.value)} placeholder="01XXXXXXXXX" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>কোর্স *</Label>
                <Select value={courseId} onValueChange={setCourseId} disabled={coursesLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={coursesLoading ? "লোড হচ্ছে..." : "কোর্স নির্বাচন করুন"} />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "যোগ করা হচ্ছে..." : "শিক্ষার্থী যোগ করুন"}
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
