import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranchLedger } from "@/contexts/BranchLedgerContext";
import { ReportToolbar } from "./ReportToolbar";

export default function BranchLedgerReport() {
  const { entries } = useBranchLedger();
  const byBranch = new Map<string, { name: string; expense: number; income: number }>();
  entries.forEach((e) => {
    const cur = byBranch.get(e.branchId) || { name: e.branchName, expense: 0, income: 0 };
    if (e.type === "expense") cur.expense += e.amount; else cur.income += e.amount;
    byBranch.set(e.branchId, cur);
  });
  const headers = ["ব্রাঞ্চ", "মোট ব্যয়", "মোট আয়", "বকেয়া ব্যালান্স"];
  const rows = Array.from(byBranch.values()).map((b) => [b.name, b.expense, b.income, b.expense - b.income]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ReportToolbar data={{ filename: "branch-ledger", title: "ব্রাঞ্চ লেজার রিপোর্ট", headers, rows }} /></div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">কোনো এন্ট্রি নেই</TableCell></TableRow> :
              rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{j === 0 ? c : `৳ ${Number(c).toLocaleString()}`}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}