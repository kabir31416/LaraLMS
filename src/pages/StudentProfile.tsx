import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useStudents } from "@/contexts/StudentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Calendar, BookOpen } from "lucide-react";
import { AdmissionForm } from "@/components/students/AdmissionForm";
import { useState } from "react";

const StudentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getStudent, getPayments, getAttendance, getResults } = useStudents();
  const [editOpen, setEditOpen] = useState(false);

  const student = getStudent(id || "");
  if (!student) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">শিক্ষার্থী পাওয়া যায়নি</div>
      </DashboardLayout>
    );
  }

  const payments = getPayments(student.id);
  const attendance = getAttendance(student.id);
  const results = getResults(student.id);

  const present = attendance.filter((a) => a.status === "উপস্থিত").length;
  const absent = attendance.filter((a) => a.status === "অনুপস্থিত").length;
  const late = attendance.filter((a) => a.status === "দেরি").length;
  const attendanceRate = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">শিক্ষার্থীর প্রোফাইল</h1>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> সম্পাদনা
          </Button>
        </div>

        {/* Header Card */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {student.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold">{student.name}</h2>
                  <Badge
                    className={
                      student.status === "সক্রিয়"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {student.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono">{student.studentId}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {student.mobile}</span>
                  {student.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {student.email}</span>}
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {student.address}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline">{student.class}</Badge>
                  <Badge variant="outline">{student.course}</Badge>
                  <Badge variant="outline">{student.batch}</Badge>
                  <Badge variant="outline">{student.section}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList className="bg-card border">
            <TabsTrigger value="basic">মূল তথ্য</TabsTrigger>
            <TabsTrigger value="fees">ফি তথ্য</TabsTrigger>
            <TabsTrigger value="attendance">উপস্থিতি</TabsTrigger>
            <TabsTrigger value="results">ফলাফল</TabsTrigger>
            <TabsTrigger value="payments">পেমেন্ট</TabsTrigger>
          </TabsList>

          {/* Basic Info */}
          <TabsContent value="basic">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">ব্যক্তিগত তথ্য</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="নাম" value={student.name} />
                  <InfoRow label="জন্ম তারিখ" value={student.dob} />
                  <InfoRow label="লিঙ্গ" value={student.gender} />
                  <InfoRow label="প্রতিষ্ঠান" value={student.institution} />
                  <InfoRow label="মোবাইল" value={student.mobile} />
                  {student.altMobile && <InfoRow label="বিকল্প মোবাইল" value={student.altMobile} />}
                  {student.email && <InfoRow label="ইমেইল" value={student.email} />}
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">অভিভাবক ও একাডেমিক</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="অভিভাবক" value={`${student.guardianName} (${student.guardianRelation})`} />
                  <InfoRow label="অভিভাবকের মোবাইল" value={student.guardianMobile} />
                  <InfoRow label="ঠিকানা" value={student.address} />
                  <InfoRow label="গ্রুপ" value={student.group} />
                  <InfoRow label="ভর্তি তারিখ" value={student.admissionDate} />
                  <InfoRow label="ভর্তি ধরন" value={student.admissionType} />
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    <span className="text-muted-foreground min-w-[100px]">বিষয়সমূহ:</span>
                    {student.subjects.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Fees Info */}
          <TabsContent value="fees">
            <Card className="border-none shadow-sm">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <FeeBox label="ভর্তি ফি" value={`৳ ${student.admissionFee.toLocaleString()}`} />
                  <FeeBox label="মাসিক ফি" value={`৳ ${student.monthlyFee.toLocaleString()}`} />
                  <FeeBox label="ডিসকাউন্ট" value={`৳ ${student.discount.toLocaleString()}`} />
                  <FeeBox label="মোট ফি" value={`৳ ${student.totalFee.toLocaleString()}`} variant="primary" />
                  <FeeBox label="পরিশোধিত" value={`৳ ${student.paid.toLocaleString()}`} variant="success" />
                  <FeeBox label="বকেয়া" value={`৳ ${student.due.toLocaleString()}`} variant={student.due > 0 ? "destructive" : "success"} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance */}
          <TabsContent value="attendance">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Card className="border-none shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-primary">{attendanceRate}%</p>
                <p className="text-xs text-muted-foreground">উপস্থিতির হার</p>
              </Card>
              <Card className="border-none shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-success">{present}</p>
                <p className="text-xs text-muted-foreground">উপস্থিত</p>
              </Card>
              <Card className="border-none shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{absent}</p>
                <p className="text-xs text-muted-foreground">অনুপস্থিত</p>
              </Card>
              <Card className="border-none shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-warning">{late}</p>
                <p className="text-xs text-muted-foreground">দেরি</p>
              </Card>
            </div>
            <Card className="border-none shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>তারিখ</TableHead>
                    <TableHead>অবস্থা</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.length === 0 ? (
                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">কোনো তথ্য নেই</TableCell></TableRow>
                  ) : (
                    attendance.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell>{a.date}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              a.status === "উপস্থিত"
                                ? "bg-success/10 text-success border-success/20"
                                : a.status === "অনুপস্থিত"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : "bg-warning/10 text-warning border-warning/20"
                            }
                          >
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Results */}
          <TabsContent value="results">
            <Card className="border-none shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>পরীক্ষা</TableHead>
                    <TableHead>বিষয়</TableHead>
                    <TableHead className="text-center">পূর্ণমান</TableHead>
                    <TableHead className="text-center">প্রাপ্ত নম্বর</TableHead>
                    <TableHead className="text-center">গ্রেড</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">কোনো ফলাফল নেই</TableCell></TableRow>
                  ) : (
                    results.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.exam}</TableCell>
                        <TableCell>{r.subject}</TableCell>
                        <TableCell className="text-center">{r.totalMarks}</TableCell>
                        <TableCell className="text-center font-semibold">{r.obtained}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{r.grade}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Payment History */}
          <TabsContent value="payments">
            <Card className="border-none shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>তারিখ</TableHead>
                    <TableHead>পরিমাণ</TableHead>
                    <TableHead>পদ্ধতি</TableHead>
                    <TableHead>নোট</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">কোনো পেমেন্ট নেই</TableCell></TableRow>
                  ) : (
                    payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.date}</TableCell>
                        <TableCell className="font-semibold">৳ {p.amount.toLocaleString()}</TableCell>
                        <TableCell>{p.method}</TableCell>
                        <TableCell className="text-muted-foreground">{p.note || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        <AdmissionForm open={editOpen} onOpenChange={setEditOpen} editStudent={student} />
      </div>
    </DashboardLayout>
  );
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="text-muted-foreground min-w-[120px]">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function FeeBox({ label, value, variant }: { label: string; value: string; variant?: string }) {
  const colorClass = variant === "primary" ? "text-primary" : variant === "success" ? "text-success" : variant === "destructive" ? "text-destructive" : "";
  return (
    <div className="text-center p-4 rounded-xl bg-muted/30">
      <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export default StudentProfile;
