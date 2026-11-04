import { useMemo, useState } from "react";
import { Bell, CalendarDays, Pin, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/dashboard/DashboardKit";
import { StudentPage } from "@/components/student/StudentPortalKit";
import { filterNoticesFor, useNotices } from "@/contexts/NoticeContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useStudentSelf } from "./useStudentSelf";
import { PRIORITY_LABELS, type NoticePriority } from "@/types/notice";
import { cn } from "@/lib/utils";

/** Notices visible to this student (all / their course / their batch, published and not expired) — same filter as before. */
const PRIORITY_TONE: Record<NoticePriority, string> = {
  Normal: "border-border bg-secondary text-secondary-foreground",
  Important: "border-warning/30 bg-warning/10 text-warning",
  Urgent: "border-destructive/25 bg-destructive/10 text-destructive",
};
const SCOPE_LABEL: Record<string, string> = { All: "সবার জন্য", Course: "আমার কোর্স", Batch: "আমার ব্যাচ" };

export default function StudentNotices() {
  const { student, batch } = useStudentSelf();
  const { notices } = useNotices();
  const { courses } = useAcademic();
  const [q, setQ] = useState("");
  const myCourse = courses.find((c) => c.name === student?.course);
  const visible = useMemo(
    () => filterNoticesFor(notices, { role: "Student", courseId: myCourse?.id, batchId: batch?.id })
      .slice()
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishDate.localeCompare(a.publishDate))
      .filter((n) => !q.trim() || `${n.title} ${n.description}`.toLowerCase().includes(q.trim().toLowerCase())),
    [notices, myCourse?.id, batch?.id, q],
  );

  return (
    <StudentPage
      icon={Bell}
      title="নোটিশ"
      description="প্রতিষ্ঠান, আপনার কোর্স ও ব্যাচের ঘোষণা"
      actions={<div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="নোটিশ খুঁজুন" className="pl-9" aria-label="নোটিশ খুঁজুন" /></div>}
    >
      {visible.length === 0 ? (
        <Card><EmptyState icon={Bell} title={q ? "এই শব্দে কোনো নোটিশ নেই" : "এখন কোনো নোটিশ নেই"} /></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((n) => (
            <Card key={n.id} className={cn("flex flex-col p-4 sm:p-5", n.pinned && "border-primary/40 bg-primary/[0.02]")}>
              <div className="flex flex-wrap items-center gap-2">
                {n.pinned && <Badge variant="outline" className="gap-1 border-primary/30 text-primary"><Pin className="h-3 w-3" aria-hidden />পিন করা</Badge>}
                <Badge variant="outline" className={PRIORITY_TONE[n.priority]}>{PRIORITY_LABELS[n.priority]}</Badge>
                <Badge variant="outline">{SCOPE_LABEL[n.type] ?? n.type}</Badge>
              </div>
              <h2 className="mt-2.5 text-base font-semibold leading-snug">{n.title}</h2>
              <p className="mt-1.5 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{n.description}</p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" aria-hidden />প্রকাশ {n.publishDate}{n.expiryDate ? ` · মেয়াদ ${n.expiryDate} পর্যন্ত` : ""}</p>
            </Card>
          ))}
        </div>
      )}
    </StudentPage>
  );
}
