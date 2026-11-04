import { useMemo, useState } from "react";
import { ExternalLink, PlayCircle, Search, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/dashboard/DashboardKit";
import { StudentPage } from "@/components/student/StudentPortalKit";
import { useAcademic } from "@/contexts/AcademicContext";
import { useStudentSelf } from "./useStudentSelf";

/** Class videos for the student's course (existing data and filtering; hooks now run unconditionally). */
export default function StudentVideos() {
  const { student } = useStudentSelf();
  const { videos, subjects, lectures, courses, getSubjectsByCourse, getCourseSubjectsForCourse, getCourseSubject } = useAcademic();
  const [subject, setSubject] = useState("all");
  const [q, setQ] = useState("");

  const myCourse = courses.find((c) => c.name === student?.course);
  const mySubjects = myCourse ? getSubjectsByCourse(myCourse.id) : subjects;
  const list = useMemo(() => {
    const csIds = new Set((myCourse ? getCourseSubjectsForCourse(myCourse.id) : []).map((cs) => cs.id));
    const lectureById = new Map(lectures.map((l) => [l.id, l]));
    return videos
      .map((v) => {
        const lec = lectureById.get(v.lectureId);
        const subjectId = lec ? getCourseSubject(lec.courseSubjectId)?.subjectId : undefined;
        return { v, lec, subjectId, subjectName: subjects.find((s) => s.id === subjectId)?.name };
      })
      .filter(({ lec, subjectId, v }) =>
        !!lec && (!myCourse || csIds.has(lec.courseSubjectId)) &&
        (subject === "all" || subjectId === subject) &&
        (!q.trim() || `${v.title} ${lec.title}`.toLowerCase().includes(q.trim().toLowerCase())));
  }, [videos, lectures, subjects, myCourse, subject, q, getCourseSubjectsForCourse, getCourseSubject]);

  return (
    <StudentPage icon={Video} title="ভিডিও ক্লাস" description="আপনার কোর্সের লেকচার ভিডিও">
      <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ভিডিও বা লেকচার খুঁজুন" className="pl-9" aria-label="ভিডিও খুঁজুন" /></div>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="sm:w-56" aria-label="বিষয়"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">সব বিষয়</SelectItem>{mySubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </Card>
      {list.length === 0 ? (
        <Card><EmptyState icon={PlayCircle} title="কোনো ভিডিও নেই" description={q || subject !== "all" ? "ফিল্টার বদলে দেখুন।" : "নতুন ভিডিও যোগ হলে এখানে দেখা যাবে।"} /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(({ v, lec, subjectName }) => (
            <Card key={v.id} className="flex flex-col p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><PlayCircle className="h-5 w-5" aria-hidden /></span>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{v.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {subjectName && <Badge variant="secondary">{subjectName}</Badge>}
                    {lec && <Badge variant="outline">{lec.title}</Badge>}
                    {v.duration && <Badge variant="outline">{v.duration}</Badge>}
                  </div>
                </div>
              </div>
              {v.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{v.description}</p>}
              <Button asChild variant="outline" size="sm" className="mt-3 self-start"><a href={v.youtubeLink} target="_blank" rel="noreferrer noopener"><ExternalLink className="h-4 w-4" />YouTube এ দেখুন</a></Button>
            </Card>
          ))}
        </div>
      )}
    </StudentPage>
  );
}
