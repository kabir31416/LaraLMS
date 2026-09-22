import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { Users, GraduationCap } from "lucide-react";
import { useStaff } from "@/contexts/StaffContext";
import { useAttendance } from "@/contexts/AttendanceContext";
import { STAFF_TYPE_LABELS } from "@/types/staff";
import { ReportToolbar } from "./ReportToolbar";
import { useBatches } from "@/contexts/BatchContext";
import { format, subDays } from "date-fns";

export default function StaffReport() {
  const { staff } = useStaff();
  const { batches } = useBatches();
  const { getStats } = useAttendance();
  const from = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const [pctByStaffId, setPctByStaffId] = useState<Record<string, string>>({});

  useEffect(() => {
    const directors = staff.filter((s) => s.staffType === "Batch Director");
    let cancelled = false;
    Promise.all(
      directors.map(async (s) => {
        const batchIds = batches.filter((b) => b.directorIds?.includes(s.id)).map((b) => b.id);
        if (batchIds.length === 0) return [s.id, "—"] as const;
        const data = await getStats({ batchIds, from, to: format(new Date(), "yyyy-MM-dd") });
        return [s.id, data.present + data.absent ? `${data.pct}%` : "—"] as const;
      }),
    ).then((entries) => { if (!cancelled) setPctByStaffId(Object.fromEntries(entries)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [staff, batches, from, getStats]);

  const headers = ["নাম", "ধরন", "মোবাইল", "বেতন", "ব্যাচ উপস্থিতি (৩০দিন)"];
  const rows = staff.map((s) => [s.name, STAFF_TYPE_LABELS[s.staffType], s.mobile, s.salary, pctByStaffId[s.id] ?? "—"]);
  const directorCount = staff.filter((s) => s.staffType === "Batch Director").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard title="মোট স্টাফ" value={staff.length.toLocaleString("bn-BD")} icon={Users} variant="primary" />
        <StatCard title="ব্যাচ ডিরেক্টর" value={directorCount.toLocaleString("bn-BD")} icon={GraduationCap} variant="info" />
      </div>
      <div className="flex justify-end"><ReportToolbar data={{ filename: "staff-report", title: "স্টাফ রিপোর্ট", headers, rows }} /></div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{j === 3 ? `৳ ${Number(c).toLocaleString()}` : c}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
