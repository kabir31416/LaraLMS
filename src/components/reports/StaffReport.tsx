import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStaff } from "@/contexts/StaffContext";
import { useAttendance } from "@/contexts/AttendanceContext";
import { STAFF_TYPE_LABELS } from "@/types/staff";
import { ReportToolbar } from "./ReportToolbar";
import { useBatches } from "@/contexts/BatchContext";
import { format, subDays } from "date-fns";

export default function StaffReport() {
  const { staff } = useStaff();
  const { batches } = useBatches();
  const { entries } = useAttendance();
  const from = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const headers = ["নাম", "ধরন", "মোবাইল", "বেতন", "ব্যাচ উপস্থিতি (৩০দিন)"];
  const rows = staff.map((s) => {
    let pct: string | number = "—";
    if (s.staffType === "Batch Director") {
      const myBatchIds = new Set(batches.filter((b) => b.directorId === s.id).map((b) => b.id));
      const list = entries.filter((e) => myBatchIds.has(e.batchId) && e.date >= from);
      pct = list.length ? `${Math.round((list.filter((e) => e.status === "Present").length / list.length) * 100)}%` : "—";
    }
    return [s.name, STAFF_TYPE_LABELS[s.staffType], s.mobile, s.salary, pct];
  });

  return (
    <div className="space-y-4">
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