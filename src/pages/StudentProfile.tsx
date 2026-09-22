import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useStudents, fromApi, type ApiStudent } from "@/contexts/StudentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Trophy, Camera } from "lucide-react";
import { AdmissionForm } from "@/components/students/AdmissionForm";
import { StudentPhotoUploader } from "@/components/students/photo/StudentPhotoUploader";
import { useCallback, useEffect, useState } from "react";
import { useBatches } from "@/contexts/BatchContext";
import { useStaff } from "@/contexts/StaffContext";
import { usePayments } from "@/contexts/PaymentContext";
import { useAttendance } from "@/contexts/AttendanceContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { gradeFor } from "@/lib/grading";
import type { Student } from "@/types/student";
import type { AttendanceEntry, OfflineExam, OfflineResult } from "@/types/attendance";
import { api } from "@/lib/apiClient";
import type { ChanceResult } from "@/types/chanceResult";
import type { StudentMaterialHistoryRow } from "@/types/material";

const StudentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { uploadStudentPhoto, deleteStudentPhoto } = useStudents();
  const { getPayments } = usePayments();
  const { batches } = useBatches();
  const { getStaff } = useStaff();
  const { getByStudent, getResultsByStudent, listExams } = useAttendance();
  const { getSubject, getLecture, settings } = useAcademic();
  const [editOpen, setEditOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [exams, setExams] = useState<OfflineExam[]>([]);
  const [results, setResults] = useState<OfflineResult[]>([]);
  const [admissionHistory, setAdmissionHistory] = useState<ChanceResult[]>([]);
  const [materialHistory, setMaterialHistory] = useState<StudentMaterialHistoryRow[]>([]);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [admissionLoaded, setAdmissionLoaded] = useState(false);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);

  // Core profile info is loaded on its own, directly by ID — never by
  // pulling it out of StudentContext's ≤100-row global list (that list
  // exists for dropdown/typeahead use, see StudentContext.tsx, and a
  // student outside that cap would incorrectly show as "not found" here).
  const [student, setStudent] = useState<Student | undefined>(undefined);
  const [studentLoading, setStudentLoading] = useState(true);

  const loadStudent = useCallback(async () => {
    if (!id) { setStudentLoading(false); return; }
    try {
      const doc = await api.get<ApiStudent>(`/students/${id}`);
      setStudent(fromApi(doc));
    } catch {
      setStudent(undefined);
    } finally {
      setStudentLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setStudentLoading(true);
    loadStudent();
  }, [loadStudent]);

  // Secondary tab data is lazy — fetched only once its own tab is actually
  // opened, not eagerly on mount, so opening a profile never pays for
  // attendance+results+admission-history+material-history data nobody asked
  // to see. Each flag latches "fetch started" so switching back and forth
  // between tabs doesn't refetch every time.

  // Real Attendance/Offline-Result data (Modules 18-20) — the same
  // per-student API the Student Portal itself reads, so a mark/attendance
  // entry a Batch Director saves on Result Entry shows up here too, not
  // just on the student's own dashboard. Backs both the "উপস্থিতি" and
  // "ফলাফল" tabs, so either one opening triggers it.
  useEffect(() => {
    if (!student || attendanceLoaded) return;
    if (activeTab !== "attendance" && activeTab !== "results") return;
    setAttendanceLoaded(true);
    let cancelled = false;
    Promise.all([
      getByStudent(student.id),
      getResultsByStudent(student.id),
      listExams(student.batchId ? { batchId: student.batchId } : undefined),
    ]).then(([a, r, e]) => {
      if (cancelled) return;
      setAttendance(a);
      setResults(r);
      setExams(e);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [student, activeTab, attendanceLoaded, getByStudent, getResultsByStudent, listExams]);

  // Chance Result (Admission Result Management) history — a small,
  // single-student endpoint with no other list-wide consumer, so a direct
  // call here is proportionate rather than growing a global Context for it
  // (same reasoning as the attendance/results fetch above, just simpler).
  useEffect(() => {
    if (!student || admissionLoaded || activeTab !== "admission") return;
    setAdmissionLoaded(true);
    let cancelled = false;
    api.get<{ history: ChanceResult[] }>(`/admission-results/student/${student.id}`)
      .then((res) => { if (!cancelled) setAdmissionHistory(res.history); })
      .catch(() => { if (!cancelled) setAdmissionHistory([]); });
    return () => { cancelled = true; };
  }, [student, activeTab, admissionLoaded]);

  // Coaching Material Inventory distribution history — same direct-call
  // reasoning as the Chance Result fetch above.
  useEffect(() => {
    if (!student || materialsLoaded || activeTab !== "materials") return;
    setMaterialsLoaded(true);
    let cancelled = false;
    api.get<StudentMaterialHistoryRow[]>(`/materials/students/${student.id}/history`)
      .then((rows) => { if (!cancelled) setMaterialHistory(rows); })
      .catch(() => { if (!cancelled) setMaterialHistory([]); });
    return () => { cancelled = true; };
  }, [student, activeTab, materialsLoaded]);

  if (studentLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">শিক্ষার্থী পাওয়া যায়নি</div>
      </DashboardLayout>
    );
  }

  const payments = getPayments(student.id);

  const present = attendance.filter((a) => a.status === "Present").length;
  const absent = attendance.filter((a) => a.status === "Absent").length;
  const attendanceRate = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0;

  type ResultRow = { result: OfflineResult; exam: OfflineExam; subject?: string; lecture?: string };
  const resultRows = results
    .map((r): ResultRow | null => {
      const exam = exams.find((e) => e.id === r.examId);
      if (!exam) return null;
      return { result: r, exam, subject: getSubject(exam.subjectId)?.name, lecture: getLecture(exam.lectureId)?.title };
    })
    .filter((r): r is ResultRow => r !== null);

  const installmentCount = payments.length;

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
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                className="relative group shrink-0"
                title="ছবি পরিবর্তন করুন"
              >
                <Avatar className="h-20 w-20">
                  {student.photo && <AvatarImage src={student.photo} alt={student.name} className="object-cover" />}
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                    {student.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-5 w-5 text-white" />
                </span>
              </button>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold">{student.name}</h2>
                  <Badge className={student.status === "সক্রিয়" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                    {student.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono">{student.studentId}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {student.mobile}</span>
                  {student.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {student.email}</span>}
                  {(student.presentAddress || student.address) && (
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {student.presentAddress || student.address}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {student.rollNumber && <Badge variant="outline">রোল: {student.rollNumber}</Badge>}
                  <Badge variant="outline">{student.class}</Badge>
                  <Badge variant="outline">{student.course}</Badge>
                  {(() => {
                    const b = batches.find((x) => x.id === student.batchId);
                    return b ? (
                      <>
                        <Badge variant="outline">{b.name}</Badge>
                        <Badge variant="outline" className="text-xs">{b.batchTime}</Badge>
                        {b.roomNumber && <Badge variant="outline" className="text-xs">রুম {b.roomNumber}</Badge>}
                        {b.directorIds?.map((id) => (
                          <Badge key={id} variant="outline" className="text-xs">ডিরেক্টর: {getStaff(id)?.name}</Badge>
                        ))}
                      </>
                    ) : (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 italic">Batch assigned হয়নি</Badge>
                    );
                  })()}
                  {student.section && <Badge variant="outline">{student.section}</Badge>}
                  <Badge variant="outline" className={student.feeType === "এককালীন" ? "bg-info/10 text-info border-info/20" : "bg-primary/10 text-primary border-primary/20"}>
                    {student.feeType}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-card border">
            <TabsTrigger value="basic">মূল তথ্য</TabsTrigger>
            <TabsTrigger value="fees">ফি তথ্য</TabsTrigger>
            <TabsTrigger value="attendance">উপস্থিতি</TabsTrigger>
            <TabsTrigger value="results">ফলাফল</TabsTrigger>
            <TabsTrigger value="admission">চান্স রেজাল্ট</TabsTrigger>
            <TabsTrigger value="materials">ম্যাটেরিয়াল</TabsTrigger>
            <TabsTrigger value="payments">পেমেন্ট</TabsTrigger>
          </TabsList>

          {/* Basic Info — restructured into Excel Student Information Import §18's sections
              (Basic/Guardian/Address/SSC/HSC), each rendering safely with "—" when a field
              is absent (imported or legacy students never crash this page). */}
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
                  <InfoRow label="ধর্ম" value={student.religion} />
                  <InfoRow label="রক্তের গ্রুপ" value={student.bloodGroup} />
                  <InfoRow label="প্রতিষ্ঠান" value={student.institution} />
                  <InfoRow label="মোবাইল" value={student.mobile} />
                  {student.altMobile && <InfoRow label="বিকল্প মোবাইল" value={student.altMobile} />}
                  {student.email && <InfoRow label="ইমেইল" value={student.email} />}
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">অভিভাবকের তথ্য</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="পিতার নাম" value={student.fatherName} />
                  <InfoRow label="মাতার নাম" value={student.motherName} />
                  <InfoRow label="অভিভাবকের নাম" value={student.guardianName} />
                  <InfoRow label="সম্পর্ক" value={student.guardianRelation} />
                  <InfoRow label="অভিভাবকের মোবাইল" value={student.guardianMobile} />
                  <InfoRow label="অভিভাবকের পেশা" value={student.guardianOccupation} />
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">ঠিকানা</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="বিভাগ" value={student.division} />
                  <InfoRow label="জেলা" value={student.district} />
                  <InfoRow label="উপজেলা" value={student.upazila} />
                  <InfoRow label="পোস্ট অফিস" value={student.postOffice} />
                  <InfoRow label="পোস্টকোড" value={student.postcode} />
                  <InfoRow label="গ্রাম" value={student.village} />
                  <InfoRow label="বর্তমান ঠিকানা" value={student.presentAddress || student.address} />
                  <InfoRow label="স্থায়ী ঠিকানা" value={student.permanentAddress} />
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">একাডেমিক</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
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

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">SSC তথ্য</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="প্রতিষ্ঠান" value={student.sscInstitution} />
                  <InfoRow label="বোর্ড" value={student.sscBoard} />
                  <InfoRow label="রোল" value={student.sscRoll} />
                  <InfoRow label="রেজিস্ট্রেশন" value={student.sscRegistrationNumber} />
                  <InfoRow label="জিপিএ" value={student.sscGpa} />
                  <InfoRow label="পাসের বছর" value={student.sscPassingYear} />
                  <InfoRow label="বিভাগ" value={student.sscGroup} />
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">HSC তথ্য</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="প্রতিষ্ঠান" value={student.hscInstitution} />
                  <InfoRow label="বোর্ড" value={student.hscBoard} />
                  <InfoRow label="রোল" value={student.hscRoll} />
                  <InfoRow label="রেজিস্ট্রেশন" value={student.hscRegistrationNumber} />
                  <InfoRow label="জিপিএ" value={student.hscGpa} />
                  <InfoRow label="পাসের বছর" value={student.hscPassingYear} />
                  <InfoRow label="বিভাগ" value={student.hscGroup} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Fees Info */}
          <TabsContent value="fees">
            <Card className="border-none shadow-sm">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <FeeBox label="ফি ধরন" value={student.feeType} />
                  <FeeBox label="কোর্স সময়কাল" value={`${student.courseDuration} মাস`} />
                  {student.feeType === "এককালীন" ? (
                    <FeeBox label="কোর্স ফি" value={`৳ ${student.totalCourseFee.toLocaleString()}`} />
                  ) : (
                    <FeeBox label="মাসিক ফি" value={`৳ ${student.monthlyFee.toLocaleString()}`} />
                  )}
                  <FeeBox label="ভর্তি ফি" value={`৳ ${student.admissionFee.toLocaleString()}`} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FeeBox label="ডিসকাউন্ট" value={`৳ ${student.discount.toLocaleString()}`} />
                  <FeeBox label="মোট ফি" value={`৳ ${student.totalFee.toLocaleString()}`} variant="primary" />
                  <FeeBox label="পরিশোধিত" value={`৳ ${student.paid.toLocaleString()}`} variant="success" />
                  <FeeBox label="বকেয়া" value={`৳ ${student.due.toLocaleString()}`} variant={student.due > 0 ? "destructive" : "success"} />
                </div>
                {student.feeType === "এককালীন" && installmentCount > 0 && (
                  <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm text-center">
                    মোট কিস্তি পরিশোধ: <span className="font-bold text-primary">{installmentCount} বার</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance */}
          <TabsContent value="attendance">
            <div className="grid grid-cols-3 gap-4 mb-4">
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
            </div>
            <Card className="border-none shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>তারিখ</TableHead>
                    <TableHead>অবস্থা</TableHead>
                    <TableHead>উৎস</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">কোনো তথ্য নেই</TableCell></TableRow>
                  ) : (
                    attendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            a.status === "Present" ? "bg-success/10 text-success border-success/20" :
                            "bg-destructive/10 text-destructive border-destructive/20"
                          }>{a.status === "Present" ? "উপস্থিত" : "অনুপস্থিত"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.source === "Exam" ? "এক্সাম" : "ম্যানুয়াল"}</TableCell>
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
                    <TableHead>লেকচার</TableHead>
                    <TableHead>তারিখ</TableHead>
                    <TableHead className="text-center">নম্বর</TableHead>
                    <TableHead className="text-center">গ্রেড</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultRows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">কোনো ফলাফল নেই</TableCell></TableRow>
                  ) : (
                    resultRows.map((r) => (
                      <TableRow key={r.result.id}>
                        <TableCell className="font-medium">{r.exam.title}</TableCell>
                        <TableCell>{r.subject || "—"}</TableCell>
                        <TableCell>{r.lecture || "—"}</TableCell>
                        <TableCell>{r.exam.date}</TableCell>
                        <TableCell className="text-center font-semibold">
                          {r.result.marks ?? "অনুপস্থিত"} / {r.exam.fullMarks}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.result.marks != null ? gradeFor((r.result.marks / r.exam.fullMarks) * 100, settings.gradeScale) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Chance Result (Admission Result Management) */}
          <TabsContent value="admission">
            <div className="space-y-4">
              {admissionHistory.length > 0 && (
                <Card className="border-none shadow-sm bg-success/5">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-xl bg-success/10 text-success"><Trophy className="h-5 w-5" /></div>
                      <div>
                        <p className="font-bold text-success">🎉 চান্সপ্রাপ্ত</p>
                        <p className="text-xs text-muted-foreground">সর্বশেষ রাউন্ড অনুযায়ী</p>
                      </div>
                    </div>
                    {(() => {
                      const latest = admissionHistory.find((r) => r.resultRound === "Final") || admissionHistory[0];
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <InfoRow label="ইনস্টিটিউট" value={latest.instituteName} />
                          <InfoRow label="ভর্তি রোল" value={latest.admissionRoll} />
                          <InfoRow label="নির্বাচন" value={latest.selectionType === "Merit" ? "মেধা (Merit)" : "উপজাতি (Tribal)"} />
                          <InfoRow label="রাউন্ড" value={latest.resultRound} />
                          <InfoRow label="প্রোগ্রাম" value={latest.programName} />
                          <InfoRow label="সেশন" value={latest.session} />
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">সম্পূর্ণ ইতিহাস</CardTitle>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ইনস্টিটিউট</TableHead>
                      <TableHead>ভর্তি রোল</TableHead>
                      <TableHead>প্রোগ্রাম</TableHead>
                      <TableHead>সেশন</TableHead>
                      <TableHead>নির্বাচন</TableHead>
                      <TableHead>রাউন্ড</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admissionHistory.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">কোনো চান্স রেজাল্ট পাওয়া যায়নি</TableCell></TableRow>
                    ) : (
                      admissionHistory.map((r) => (
                        <TableRow key={r._id}>
                          <TableCell className="font-medium">{r.instituteName}</TableCell>
                          <TableCell className="font-mono text-sm">{r.admissionRoll}</TableCell>
                          <TableCell>{r.programName}</TableCell>
                          <TableCell>{r.session}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={r.selectionType === "Merit" ? "bg-primary/10 text-primary border-primary/20" : "bg-info/10 text-info border-info/20"}>
                              {r.selectionType === "Merit" ? "মেধা" : "উপজাতি"}
                            </Badge>
                          </TableCell>
                          <TableCell><Badge variant="outline">{r.resultRound}</Badge></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </TabsContent>

          {/* Coaching Material Inventory — distribution history */}
          <TabsContent value="materials">
            <Card className="border-none shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>তারিখ</TableHead>
                    <TableHead>ম্যাটেরিয়াল</TableHead>
                    <TableHead>টাইপ</TableHead>
                    <TableHead className="text-center">পরিমাণ</TableHead>
                    <TableHead>Free/Paid</TableHead>
                    <TableHead className="text-right">মূল্য</TableHead>
                    <TableHead>বিতরণকারী</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialHistory.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">কোনো ম্যাটেরিয়াল বিতরণ করা হয়নি</TableCell></TableRow>
                  ) : (
                    materialHistory.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.date}</TableCell>
                        <TableCell className="font-medium">{r.materialName}</TableCell>
                        <TableCell><Badge variant="outline">{r.materialType}</Badge></TableCell>
                        <TableCell className="text-center">{r.quantity}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={r.isPaid ? "" : "bg-info/10 text-info border-info/20"}>{r.isPaid ? "Paid" : "Free"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{r.isPaid ? `৳ ${r.lineTotal.toLocaleString()}` : "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.distributedBy}</TableCell>
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
                    <TableHead>ফি ধরন</TableHead>
                    <TableHead>মাস</TableHead>
                    <TableHead className="text-right">পরিমাণ</TableHead>
                    <TableHead className="text-right">জরিমানা</TableHead>
                    <TableHead className="text-right">পরিশোধিত</TableHead>
                    <TableHead>পদ্ধতি</TableHead>
                    <TableHead>নোট</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">কোনো পেমেন্ট নেই</TableCell></TableRow>
                  ) : (
                    payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.date}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{p.feeType}</Badge></TableCell>
                        <TableCell>{p.month || "—"}</TableCell>
                        <TableCell className="text-right">৳ {p.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{p.fine > 0 ? `৳ ${p.fine}` : "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-success">৳ {p.paidAmount.toLocaleString()}</TableCell>
                        <TableCell>{p.method}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{p.note || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        <AdmissionForm
          open={editOpen}
          onOpenChange={(open) => { setEditOpen(open); if (!open) loadStudent(); }}
          editStudent={student}
        />
        <StudentPhotoUploader
          open={photoOpen}
          onOpenChange={setPhotoOpen}
          studentName={student.name}
          currentPhotoUrl={student.photo}
          onUpload={async (blob) => { await uploadStudentPhoto(student.id, blob); await loadStudent(); }}
          onRemove={async () => { await deleteStudentPhoto(student.id); await loadStudent(); }}
        />
      </div>
    </DashboardLayout>
  );
};

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex">
      <span className="text-muted-foreground min-w-[120px]">{label}:</span>
      <span className="font-medium">{value || "—"}</span>
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
