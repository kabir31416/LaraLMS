import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudentSelf } from "./useStudentSelf";
import { Navigate } from "react-router-dom";

function Field({ label, value }: { label: string; value?: string | number }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value || "—"}</p></div>;
}

export default function StudentProfile() {
  const { user, student, batch, director } = useStudentSelf();
  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">আমার প্রোফাইল</h1>
        <Card><CardHeader><CardTitle className="text-base">ব্যক্তিগত তথ্য</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="নাম" value={student.name} />
            <Field label="Student ID" value={student.studentId} />
            <Field label="মোবাইল" value={student.mobile} />
            <Field label="ইমেইল" value={student.email} />
            <Field label="জন্ম তারিখ" value={student.dob} />
            <Field label="লিঙ্গ" value={student.gender} />
            <Field label="প্রতিষ্ঠান" value={student.institution} />
            <Field label="শ্রেণি" value={student.class} />
            <Field label="ঠিকানা" value={student.address} />
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">অভিভাবক তথ্য</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="অভিভাবক" value={student.guardianName} />
            <Field label="সম্পর্ক" value={student.guardianRelation} />
            <Field label="মোবাইল" value={student.guardianMobile} />
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">কোর্স তথ্য</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="কোর্স" value={student.course} />
            <Field label="সেকশন" value={student.section} />
            <Field label="গ্রুপ" value={student.group} />
            <Field label="ভর্তির তারিখ" value={student.admissionDate} />
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">ব্যাচ তথ্য</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="ব্যাচ" value={batch?.name} />
            <Field label="সময়" value={batch?.batchTime} />
            <Field label="রুম" value={batch?.roomNumber} />
            <Field label="দিন" value={batch?.days.join(", ")} />
            <Field label="ব্যাচ ডিরেক্টর" value={director?.name} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}