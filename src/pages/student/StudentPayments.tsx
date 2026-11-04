import { Link } from "react-router-dom";
import { CheckCircle2, Receipt as ReceiptIcon, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ListSkeleton, Panel, SplitMeter } from "@/components/dashboard/DashboardKit";
import { MiniStat, StudentPage } from "@/components/student/StudentPortalKit";
import { usePayments } from "@/contexts/PaymentContext";
import { useStudentSelf } from "./useStudentSelf";
import { taka } from "@/lib/dashboardFormat";

/**
 * My Fees & Payments. Totals are the student's own record (totalFee / paid /
 * due, maintained by the server); history is the student's own payments
 * (the payments API only ever returns the signed-in student's rows).
 */
const SOURCE_LABELS: Record<string, string> = { admission: "ভর্তি", regular: "ফি", material: "ম্যাটেরিয়াল" };

export default function StudentPayments() {
  const { student } = useStudentSelf();
  const { getPayments, loading } = usePayments();
  const payments = student ? getPayments(student.id).slice().sort((a, b) => b.date.localeCompare(a.date)) : [];
  const active = payments.filter((p) => p.status !== "cancelled");

  return (
    <StudentPage icon={Wallet} title="ফি ও পেমেন্ট" description="মোট ফি, পরিশোধ, বকেয়া এবং প্রতিটি পেমেন্টের রসিদ">
      {student && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="মোট প্রদেয়" value={taka(student.totalFee)} sub={student.discount ? `ছাড় ${taka(student.discount)}` : undefined} />
            <MiniStat label="পরিশোধিত" value={taka(student.paid)} tone="success" sub={`${active.length}টি পেমেন্ট`} />
            <MiniStat label="বকেয়া" value={taka(student.due)} tone={student.due > 0 ? "destructive" : "success"} sub={student.due > 0 ? "অফিসে যোগাযোগ করুন" : "কোনো বকেয়া নেই"} />
            <MiniStat
              label="ফি অবস্থা"
              value={<span className="text-lg">{student.due > 0 ? "বকেয়া আছে" : "সম্পূর্ণ পরিশোধিত"}</span>}
              tone={student.due > 0 ? "warning" : "success"}
              sub={student.feeType}
            />
          </div>

          <Panel title="পরিশোধের অগ্রগতি" icon={CheckCircle2}>
            <SplitMeter a={{ label: "পরিশোধিত", value: student.paid, className: "bg-success" }} b={{ label: "বকেয়া", value: Math.max(0, student.due), className: "bg-destructive" }} format={taka} />
          </Panel>

          <Card className="overflow-hidden">
            <div className="border-b p-3 sm:p-4"><h2 className="font-semibold">পেমেন্ট ইতিহাস</h2><p className="text-xs text-muted-foreground">রসিদ দেখতে বা প্রিন্ট করতে রসিদ বাটনে চাপুন</p></div>
            {loading ? <div className="p-4"><ListSkeleton rows={4} /></div> : payments.length === 0 ? (
              <EmptyState icon={ReceiptIcon} title="এখনো কোনো পেমেন্ট নেই" />
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader><TableRow><TableHead>রসিদ নং</TableHead><TableHead>তারিখ</TableHead><TableHead>ধরন</TableHead><TableHead>পদ্ধতি</TableHead><TableHead className="text-right">পরিমাণ</TableHead><TableHead>অবস্থা</TableHead><TableHead className="text-right">রসিদ</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id} className={p.status === "cancelled" ? "opacity-60" : ""}>
                          <TableCell className="font-mono text-xs">{p.receiptNo}</TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">{p.date}</TableCell>
                          <TableCell>{SOURCE_LABELS[p.source ?? "regular"]}{p.month ? ` · ${p.month}` : ""}</TableCell>
                          <TableCell>{p.method}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{taka(p.paidAmount)}</TableCell>
                          <TableCell>{p.status === "cancelled" ? <Badge variant="outline" className="border-destructive/25 text-destructive">বাতিল</Badge> : <Badge variant="outline" className="border-success/25 bg-success/10 text-success">সম্পন্ন</Badge>}</TableCell>
                          <TableCell className="text-right"><Button asChild size="sm" variant="ghost"><Link to={`/payments/${p.id}/receipt`} aria-label={`রসিদ ${p.receiptNo}`}><ReceiptIcon className="h-4 w-4" />রসিদ</Link></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="divide-y md:hidden">
                  {payments.map((p) => (
                    <li key={p.id} className={p.status === "cancelled" ? "opacity-60" : ""}>
                      <Link to={`/payments/${p.id}/receipt`} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/40">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ReceiptIcon className="h-4 w-4" aria-hidden /></span>
                        <span className="min-w-0 flex-1"><span className="block font-mono text-xs">{p.receiptNo}</span><span className="block text-xs text-muted-foreground">{p.date} · {p.method} · {SOURCE_LABELS[p.source ?? "regular"]}</span></span>
                        <span className="text-right"><b className="tabular-nums">{taka(p.paidAmount)}</b>{p.status === "cancelled" && <span className="block text-[11px] text-destructive">বাতিল</span>}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </>
      )}
    </StudentPage>
  );
}
