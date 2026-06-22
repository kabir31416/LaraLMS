import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBooks } from "@/contexts/BookContext";
import { ReportToolbar } from "./ReportToolbar";

export default function BookDistributionReport() {
  const { books, issues } = useBooks();
  const rows = books.map((b) => {
    const bookIssues = issues.filter((i) => i.bookId === b.id);
    const qty = bookIssues.reduce((s, i) => s + i.quantity, 0);
    const studentCount = new Set(bookIssues.map((i) => i.studentId)).size;
    return [b.name, qty, studentCount];
  }).filter((r) => Number(r[1]) > 0);
  const headers = ["বই", "ইস্যু সংখ্যা", "শিক্ষার্থী সংখ্যা"];

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ReportToolbar data={{ filename: "book-distribution", title: "বই বিতরণ রিপোর্ট", headers, rows }} /></div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">কোনো বই বিতরণ হয়নি</TableCell></TableRow> :
              rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}