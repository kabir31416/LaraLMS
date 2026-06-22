import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStudents } from "@/contexts/StudentContext";
import { useStudentSelf } from "./useStudentSelf";
import { Navigate } from "react-router-dom";

export default function StudentPayments() {
  const { user, student } = useStudentSelf();
  const { getPayments } = useStudents();
  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;
  const payments = getPayments(student.id);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">পেমেন্ট</h1>
        <div className="grid grid-cols-3 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">মোট ফি</CardTitle></CardHeader><CardContent className="pt-0 text-xl font-bold">৳ {student.totalFee.toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">পরিশোধিত</CardTitle></CardHeader><CardContent className="pt-0 text-xl font-bold text-success">৳ {student.paid.toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">বকেয়া</CardTitle></CardHeader><CardContent className="pt-0 text-xl font-bold text-destructive">৳ {student.due.toLocaleString()}</CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle className="text-base">পেমেন্ট ইতিহাস</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>রসিদ নং</TableHead><TableHead>তারিখ</TableHead><TableHead>পরিমাণ</TableHead><TableHead>পদ্ধতি</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">কোনো পেমেন্ট নেই</TableCell></TableRow> :
                  payments.map((p) => <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.receiptNo}</TableCell>
                    <TableCell>{p.date}</TableCell>
                    <TableCell className="font-semibold">৳ {p.paidAmount.toLocaleString()}</TableCell>
                    <TableCell>{p.method}</TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}