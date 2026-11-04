import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Gift, Package, Search, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/dashboard/DashboardKit";
import { MiniStat, StudentPage } from "@/components/student/StudentPortalKit";
import { api } from "@/lib/apiClient";
import { taka } from "@/lib/dashboardFormat";
import type { StudentMaterialHistoryRow } from "@/types/material";
import { useStudentSelf } from "./useStudentSelf";

/** Materials received — the student's own distribution history (existing endpoint; the server allows only their own id). */
export default function StudentBooks() {
  const { student } = useStudentSelf();
  const [q, setQ] = useState("");
  const query = useQuery({
    queryKey: ["student", "materials", student?.id],
    queryFn: () => api.get<StudentMaterialHistoryRow[]>(`/materials/students/${student!.id}/history`),
    enabled: !!student,
    staleTime: 120_000,
  });
  const rows = useMemo(() => (query.data ?? []).slice().sort((a, b) => b.date.localeCompare(a.date)), [query.data]);
  const received = rows.filter((r) => r.status !== "REVERSED");
  const shown = rows.filter((r) => !q.trim() || `${r.materialName} ${r.materialType}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <StudentPage
      icon={BookOpen}
      title="আমার ম্যাটেরিয়াল"
      description="আপনাকে দেওয়া বই, শিট ও অন্যান্য ম্যাটেরিয়াল"
      actions={rows.length ? <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ম্যাটেরিয়াল খুঁজুন" className="pl-9" aria-label="ম্যাটেরিয়াল খুঁজুন" /></div> : undefined}
    >
      {query.isLoading ? <Card className="p-4"><ListSkeleton rows={5} /></Card> : query.isError ? (
        <Card><ErrorState message="ম্যাটেরিয়াল লোড করা যায়নি" onRetry={() => query.refetch()} /></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Package} title="এখনো কোনো ম্যাটেরিয়াল দেওয়া হয়নি" /></Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="মোট পেয়েছেন" value={received.reduce((s, r) => s + r.quantity, 0)} sub={`${received.length}টি বিতরণ`} tone="primary" />
            <MiniStat label="ফ্রি" value={received.filter((r) => !r.isPaid).length} sub="বিতরণ" />
            <MiniStat label="পেইড" value={taka(received.filter((r) => r.isPaid).reduce((s, r) => s + r.lineTotal, 0))} sub={`${received.filter((r) => r.isPaid).length}টি বিতরণ`} />
          </div>
          {shown.length === 0 ? <Card><EmptyState compact icon={Search} title="এই নামে কোনো ম্যাটেরিয়াল নেই" /></Card> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((r) => (
                <Card key={r.distributionId} className={r.status === "REVERSED" ? "p-4 opacity-60" : "p-4"}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{r.isPaid ? <Wallet className="h-5 w-5" aria-hidden /> : <Gift className="h-5 w-5" aria-hidden />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">{r.materialName}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline">{r.materialType}</Badge>
                        <Badge variant="outline" className={r.isPaid ? "border-primary/25 text-primary" : "border-success/25 text-success"}>{r.isPaid ? `পেইড · ${taka(r.lineTotal)}` : "ফ্রি"}</Badge>
                        {r.status === "REVERSED" && <Badge variant="outline" className="border-destructive/25 text-destructive">ফেরত নেওয়া হয়েছে</Badge>}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">পরিমাণ {r.quantity} · {r.date} · {r.distributedBy}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </StudentPage>
  );
}
