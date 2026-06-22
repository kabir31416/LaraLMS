import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useBooks } from "@/contexts/BookContext";
import { useStudentSelf } from "./useStudentSelf";
import { Navigate } from "react-router-dom";

export default function StudentBooks() {
  const { user, student } = useStudentSelf();
  const { getStudentIssues, books } = useBooks();
  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;
  const issues = getStudentIssues(student.id);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">আমার বই</h1>
        <Card><CardHeader><CardTitle className="text-base">ইস্যু ইতিহাস</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>বই</TableHead><TableHead>সংখ্যা</TableHead><TableHead>ইস্যু তারিখ</TableHead><TableHead>স্ট্যাটাস</TableHead></TableRow></TableHeader>
              <TableBody>
                {issues.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">কোনো বই ইস্যু হয়নি</TableCell></TableRow> :
                  issues.map((i) => {
                    const book = books.find((b) => b.id === i.bookId);
                    return <TableRow key={i.id}>
                      <TableCell className="font-medium">{book?.name || "—"}</TableCell>
                      <TableCell>{i.quantity}</TableCell>
                      <TableCell>{i.issueDate}</TableCell>
                      <TableCell><Badge variant="outline">{i.status}</Badge></TableCell>
                    </TableRow>;
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}