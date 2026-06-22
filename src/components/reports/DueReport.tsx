import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStudents } from "@/contexts/StudentContext";
import { ReportToolbar } from "./ReportToolbar";

export default function DueReport() {
  const { students } = useStudents();
  const dues = students.filter((s) => s.due > 0).sort((a, b) => b.due - a.due);
  const headers = ["শিক্ষার্থী", "কোর্স", "ব্যাচ", "মোট বকেয়া"];
  const rows = dues.map((s) => [s.name, s.course, s.batch, s.due]);
  const total = dues.reduce((sum, s) => sum + s.due, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">মোট বকেয়া: <span className="font-bold text-foreground">৳ {total.toLocaleString()}</span> ({dues.length} জন)</div>
        <ReportToolbar data={{ filename: "due-report", title: "বকেয়া রিপোর্ট", headers, rows }} />
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">কোনো বকেয়া নেই</TableCell></TableRow> :
              rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={j === 3 ? "font-semibold text-destructive" : ""}>{j === 3 ? `৳ ${Number(c).toLocaleString()}` : c}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}