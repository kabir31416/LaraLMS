import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pin } from "lucide-react";
import { filterNoticesFor, useNotices } from "@/contexts/NoticeContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useStudentSelf } from "./useStudentSelf";
import { Navigate } from "react-router-dom";
import { PRIORITY_LABELS } from "@/types/notice";

export default function StudentNotices() {
  const { user, student, batch } = useStudentSelf();
  const { notices } = useNotices();
  const { courses } = useAcademic();
  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;

  const myCourse = courses.find((c) => c.name === student.course);
  const visible = filterNoticesFor(notices, { role: "Student", courseId: myCourse?.id, batchId: batch?.id });

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">নোটিশ</h1>
        {visible.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">কোনো নোটিশ নেই</CardContent></Card>
        ) : visible.map((n) => (
          <Card key={n.id} className={n.pinned ? "border-primary/40" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {n.pinned && <Pin className="h-4 w-4 text-primary" />}{n.title}
                </CardTitle>
                <Badge variant="outline">{PRIORITY_LABELS[n.priority]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{n.publishDate}</p>
            </CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{n.description}</p></CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}