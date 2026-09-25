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
 * Public, no-login quick student entry (/newstudententry) — Admin/Staff
 * entry point (Student Entry Workflow). Collects name, roll, student phone,
 * guardian phone, Course, Batch (Batch is scoped to the selected Course —
 * never a free choice), and an OPTIONAL photo. Everything else this student
 * will ever have (dob, address, HSC/SSC info, fees, ...) is filled in later
 * through the existing Student Profile / the student's own /studententry —
 * this page's only job is to create a `"pending"` application via the same
 * production Student-creation path Admission/Bulk Import already use
 * (backend/src/modules/publicNewStudentEntry, a thin wrapper around
 * student.service.ts's create()), never a parallel data structure. The
 * created student is NOT enrolled in any batch and does not appear in any
 * Student List until an Admin approves it (see PendingStudents.tsx).
 */
interface CourseOption {
  _id: string;
  name: string;
}

interface BatchOption {
  _id: string;
  name: string;
  batchTime: string;
}

interface RegisterResult {
  name: string;
  rollNumber?: string;
  registrationId: string;
  course?: string;
  admissionStatus: "pending" | "approved" | "rejected";
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);

  useEffect(() => {
    newStudentEntryApi.get<CourseOption[]>("/courses")
      .then(setCourses)
      .catch(() => toast.error("কোর্সের তালিকা লোড করা যায়নি। পাতাটি রিলোড করুন।"))
      .finally(() => setCoursesLoading(false));
  }, []);

  // Batch dropdown is scoped to the selected Course — resets whenever the
  // Course changes so a stale Batch from a different Course can never be
  // submitted (Student Entry Workflow §4). Backend independently re-verifies
  // the pair regardless.
  useEffect(() => {
    setBatchId("");
    if (!courseId) { setBatches([]); return; }
    setBatchesLoading(true);
    newStudentEntryApi.get<BatchOption[]>(`/batches?courseId=${courseId}`)
      .then(setBatches)
      .catch(() => toast.error("ব্যাচের তালিকা লোড করা যায়নি।"))
      .finally(() => setBatchesLoading(false));
  }, [courseId]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      toast.error("শুধু JPG, PNG অথবা WEBP ছবি দেওয়া যাবে");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("ছবির আকার ৮ MB-এর বেশি হতে পারবে না");
      return;
    }
    setPhoto(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !rollNumber.trim() || !phone.trim() || !guardianMobile.trim() || !courseId || !batchId) {
      toast.error("সবগুলো আবশ্যক ঘর পূরণ করুন");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("rollNumber", rollNumber.trim());
      formData.append("phone", phone.trim());
      formData.append("guardianMobile", guardianMobile.trim());
      formData.append("courseId", courseId);
      formData.append("batchId", batchId);
      // Photo is OPTIONAL — simply omitted from the form when not chosen; the
      // backend never treats a missing photo as an error on this route.
      if (photo) formData.append("photo", photo);
      const data = await newStudentEntryApi.postForm<RegisterResult>("/", formData);
      setResult(data);
    } catch (err) {
      toast.error(friendlyError(err, "আবেদন জমা করা যায়নি। আবার চেষ্টা করুন।"));
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
    setBatchId("");
    setPhoto(null);
  };

  if (result) {
    return (
      <main className="min-h-screen bg-muted/30 p-4">
        <div className="max-w-md mx-auto space-y-4 py-10">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-xl bg-success flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold">আবেদন সফলভাবে জমা হয়েছে</h1>
            {result.admissionStatus === "pending" && (
              <p className="text-sm text-muted-foreground">অ্যাডমিন অনুমোদনের অপেক্ষায় আছে — অনুমোদনের পর শিক্ষার্থী ব্যাচে সক্রিয় হবে।</p>
            )}
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
              <div>
                <p className="text-xs text-muted-foreground">অবস্থা</p>
                <p className="text-sm font-medium">{result.admissionStatus === "pending" ? "পেন্ডিং (অনুমোদনের অপেক্ষায়)" : "সক্রিয়"}</p>
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
              <div className="space-y-1.5">
                <Label>ব্যাচ *</Label>
                <Select value={batchId} onValueChange={setBatchId} disabled={!courseId || batchesLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={!courseId ? "প্রথমে কোর্স নির্বাচন করুন" : batchesLoading ? "লোড হচ্ছে..." : "ব্যাচ নির্বাচন করুন"} />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b._id} value={b._id}>{b.name} — {b.batchTime}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {courseId && !batchesLoading && batches.length === 0 && (
                  <p className="text-xs text-muted-foreground">এই কোর্সে কোনো ব্যাচ নেই — প্রথমে ব্যাচ পেজ থেকে একটি ব্যাচ তৈরি করুন</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>শিক্ষার্থীর ছবি (ঐচ্ছিক)</Label>
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
                {photo && <p className="text-xs text-muted-foreground">নির্বাচিত: {photo.name}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "জমা হচ্ছে..." : "আবেদন জমা করুন"}
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
