import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAcademic } from "@/contexts/AcademicContext";
import { useStudentSelf } from "./useStudentSelf";
import { Navigate } from "react-router-dom";

export default function StudentVideos() {
  const { user, student } = useStudentSelf();
  const { videos, subjects, lectures, courses, getSubjectsByCourse, getCourseSubjectsForCourse, getCourseSubject } = useAcademic();
  const [subject, setSubject] = useState("all");

  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;

  const myCourse = courses.find((c) => c.name === student.course);
  const mySubjects = myCourse ? getSubjectsByCourse(myCourse.id) : subjects;
  const myCourseSubjectIds = new Set((myCourse ? getCourseSubjectsForCourse(myCourse.id) : []).map((cs) => cs.id));
  const lectureIds = new Set(lectures.filter((l) => !myCourse || myCourseSubjectIds.has(l.courseSubjectId)).map((l) => l.id));

  const filtered = useMemo(() => videos.filter((v) => {
    if (!lectureIds.has(v.lectureId)) return false;
    if (subject !== "all") {
      const lec = lectures.find((l) => l.id === v.lectureId);
      const lecSubjectId = lec ? getCourseSubject(lec.courseSubjectId)?.subjectId : undefined;
      if (lecSubjectId !== subject) return false;
    }
    return true;
  }), [videos, lectureIds, subject, lectures, getCourseSubject]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">ভিডিও ক্লাস</h1>
        <div className="max-w-xs"><Label className="text-xs">সাবজেক্ট ফিল্টার</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">সব</SelectItem>{mySubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {filtered.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">কোনো ভিডিও নেই</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((v) => {
              const lec = lectures.find((l) => l.id === v.lectureId);
              const subjectId = lec ? getCourseSubject(lec.courseSubjectId)?.subjectId : undefined;
              const sub = subjects.find((s) => s.id === subjectId);
              return <Card key={v.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{v.title}</CardTitle>
                  <div className="flex gap-2 text-xs">
                    {sub && <Badge variant="secondary">{sub.name}</Badge>}
                    {lec && <Badge variant="outline">{lec.title}</Badge>}
                    {v.duration && <Badge variant="outline">{v.duration}</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <a href={v.youtubeLink} target="_blank" rel="noreferrer" className="text-primary text-sm underline">YouTube এ দেখুন</a>
                  {v.description && <p className="text-sm text-muted-foreground mt-2">{v.description}</p>}
                </CardContent>
              </Card>;
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}