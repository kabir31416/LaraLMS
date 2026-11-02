import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, Receipt, Ban, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessPage, useMessScope } from "@/components/mess/MessShell";
import { SuperDeleteButton } from "@/components/mess/SuperDelete";
import { Pager, ReasonDialog, ReceivePaymentDialog, SearchInput, StatusBadge, TableState } from "@/components/mess/MessCommon";
import { api } from "@/lib/apiClient";
import { useAcademic } from "@/contexts/AcademicContext";
import { errMsg, MEMBERSHIP_STATUS_LABELS, periodName, PURPOSE_LABELS, qs, refName, tk, usePagedList, type Membership, type MessPayment } from "@/lib/mess";
import { MESS_FINANCE_APPROVE, MESS_PAYMENTS_CANCEL, MESS_PAYMENTS_COLLECT } from "@/lib/permissions";
import { exportExcel } from "@/lib/exporters";

export default function MessPayments() {
  const navigate = useNavigate();
  const { messId, can } = useMessScope();
  const { paymentMethods } = useAcademic();
  const [purpose, setPurpose] = useState("all");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("active");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId, purpose, method, status, dateFrom, dateTo, search]);
  const list = usePagedList<MessPayment>(`/mess/payments${qs({ messId, purpose, method, status: status === "any" ? undefined : status, includeCancelled: status === "any" || undefined, dateFrom, dateTo, search, page, limit: 25 })}`);
  const totals = (list.meta?.totals ?? { rent: 0, deposit: 0 }) as { rent: number; deposit: number };
  const [pickOpen, setPickOpen] = useState(false);
  const [payFor, setPayFor] = useState<Membership | null>(null);
  const [cancelling, setCancelling] = useState<MessPayment | null>(null);

  const verify = async (p: MessPayment) => {
    try { await api.post(`/mess/payments/${p._id}/verify`); toast.success("পেমেন্ট যাচাই করা হয়েছে"); await list.reload(); } catch (err) { toast.error(errMsg(err)); }
  };
  const exportRows = () => exportExcel({
    filename: "mess-payments",
    title: "Mess Payments",
    headers: ["Receipt", "Date", "Student", "Reg ID", "Mess", "Purpose", "Method", "Reference", "Amount", "Status"],
    rows: list.items.map((p) => [p.receiptNo, p.date, p.studentId?.name ?? "", p.studentId?.registrationId ?? "", refName(p.messId), PURPOSE_LABELS[p.purpose], p.method, p.reference ?? "", p.amount, p.status === "cancelled" ? "Cancelled" : p.verified ? "Verified" : "Active"]),
  });

  return (
    <MessPage
      title="মেস পেমেন্ট"
      subtitle="মাসিক ভাড়া, ডাইনিং চার্জ ও অগ্রিম সংগ্রহ — কোর্স ফি থেকে সম্পূর্ণ আলাদা হিসাব"
      actions={can(MESS_PAYMENTS_COLLECT) && <Button onClick={() => setPickOpen(true)}><Coins className="h-4 w-4 mr-1" />পেমেন্ট গ্রহণ</Button>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">ভাড়া ও ডাইনিং চার্জ আদায় (ফিল্টার অনুযায়ী)</p><p className="text-lg font-bold">{tk(totals.rent)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">অগ্রিম সংগ্রহ (আয় নয়)</p><p className="text-lg font-bold">{tk(totals.deposit)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader>
          <div className="grid grid-cols-2 lg:grid-cols-7 gap-2">
            <SearchInput value={search} onChange={setSearch} className="col-span-2" />
            <Select value={purpose} onValueChange={setPurpose}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব ধরন</SelectItem><SelectItem value="rent">{PURPOSE_LABELS.rent}</SelectItem><SelectItem value="deposit">{PURPOSE_LABELS.deposit}</SelectItem><SelectItem value="initial">{PURPOSE_LABELS.initial}</SelectItem></SelectContent></Select>
            <Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব পদ্ধতি</SelectItem>{paymentMethods.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent></Select>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">সক্রিয়</SelectItem><SelectItem value="cancelled">বাতিল</SelectItem><SelectItem value="any">সব</SelectItem></SelectContent></Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="থেকে" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="পর্যন্ত" />
          </div>
          <div className="flex justify-end"><Button size="sm" variant="outline" onClick={exportRows} disabled={list.items.length === 0}>এক্সেল (এই পৃষ্ঠা)</Button></div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>রসিদ</TableHead><TableHead>তারিখ</TableHead><TableHead>শিক্ষার্থী</TableHead><TableHead>মেস</TableHead><TableHead>ধরন</TableHead>
              <TableHead>পদ্ধতি</TableHead><TableHead className="text-right">পরিমাণ</TableHead><TableHead>অবস্থা</TableHead><TableHead className="text-right">কাজ</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableState colSpan={9} loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText="কোনো পেমেন্ট নেই" />
              {!list.loading && list.items.map((p) => (
                <TableRow key={p._id} className={p.status === "cancelled" ? "opacity-60" : ""}>
                  <TableCell className="font-mono text-xs">{p.receiptNo}</TableCell>
                  <TableCell>{p.date}</TableCell>
                  <TableCell><p className="font-medium">{p.studentId?.name}</p><p className="text-xs text-muted-foreground">{p.studentId?.registrationId} • {typeof p.membershipId === "object" && p.membershipId ? p.membershipId.membershipNo : typeof p.reservationId === "object" && p.reservationId ? `রিজার্ভেশন ${p.reservationId.reservationNo}` : ""}</p></TableCell>
                  <TableCell className="text-sm">{refName(p.messId)}</TableCell>
                  <TableCell className="text-sm">{PURPOSE_LABELS[p.purpose]}{p.purpose === "initial" && p.allocation && <p className="text-[11px] text-muted-foreground">ডাইনিং {tk(p.allocation.rent)} + অগ্রিম {tk(p.allocation.deposit)}</p>}{p.billingMonth && <p className="text-[11px] text-muted-foreground">{periodName(p.billingMonth)}</p>}</TableCell>
                  <TableCell className="text-sm">{p.method}{p.reference && <p className="text-xs text-muted-foreground">{p.reference}</p>}</TableCell>
                  <TableCell className="text-right font-medium">{tk(p.amount)}</TableCell>
                  <TableCell>{p.status === "cancelled" ? <StatusBadge status="cancelled" label="বাতিল" /> : p.verified ? <StatusBadge status="approved" label="যাচাইকৃত" /> : <StatusBadge status="pending" label="যাচাই বাকি" />}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" className="mr-1" onClick={() => navigate(`/mess/payments/${p._id}/receipt`)} title="রসিদ"><Receipt className="h-3.5 w-3.5" /></Button>
                    {p.status === "active" && !p.verified && can(MESS_FINANCE_APPROVE) && <Button size="sm" variant="outline" className="mr-1" onClick={() => verify(p)} title="যাচাই"><BadgeCheck className="h-3.5 w-3.5" /></Button>}
                    {p.status === "active" && can(MESS_PAYMENTS_CANCEL) && <Button size="sm" variant="outline" onClick={() => setCancelling(p)} title="বাতিল/রিভার্স"><Ban className="h-3.5 w-3.5" /></Button>}
                    <SuperDeleteButton entity="payment" id={p._id} what={`পেমেন্ট ${p.receiptNo} — ${p.studentId?.name ?? ""} (${tk(p.amount)})`} onDeleted={list.reload} className="ml-1" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-3"><Pager meta={list.meta} page={page} onPage={setPage} /></div>
        </CardContent>
      </Card>
      <MemberPickDialog open={pickOpen} onOpenChange={setPickOpen} onPick={(m) => { setPickOpen(false); setPayFor(m); }} />
      <ReceivePaymentDialog
        open={!!payFor}
        onOpenChange={(v) => !v && setPayFor(null)}
        target={payFor ? { membershipId: payFor._id, label: `${payFor.studentId?.name} — ${payFor.membershipNo}`, due: payFor.balance?.due, advance: payFor.balance?.advance, depositRemaining: Math.max(0, payFor.securityDeposit - (payFor.balance?.depositCollected ?? 0)), allowDeposit: payFor.status !== "left" } : null}
        onDone={(id) => { void list.reload(); navigate(`/mess/payments/${id}/receipt`); }}
      />
      <ReasonDialog
        open={!!cancelling}
        onOpenChange={(v) => !v && setCancelling(null)}
        title="পেমেন্ট বাতিল / রিভার্স"
        description={cancelling ? `${cancelling.receiptNo} — ${tk(cancelling.amount)}। রসিদ রেকর্ডে থাকবে কিন্তু হিসাব থেকে বাদ যাবে।` : undefined}
        destructive
        onConfirm={async (reason) => { await api.post(`/mess/payments/${cancelling!._id}/cancel`, { reason }); toast.success("পেমেন্ট বাতিল হয়েছে"); await list.reload(); }}
      />
    </MessPage>
  );
}

function MemberPickDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (v: boolean) => void; onPick: (m: Membership) => void }) {
  const { messId } = useMessScope();
  const [search, setSearch] = useState("");
  useEffect(() => { if (open) setSearch(""); }, [open]);
  const list = usePagedList<Membership>(open ? `/mess/memberships${qs({ messId, search, status: "approved,active,on_leave,notice_given,left", limit: 10 })}` : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>সদস্য নির্বাচন</DialogTitle><DialogDescription>যার পেমেন্ট নেবেন সেই সদস্যকে খুঁজুন</DialogDescription></DialogHeader>
        <SearchInput value={search} onChange={setSearch} />
        <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
          {list.loading ? <p className="p-3 text-sm text-muted-foreground">লোড হচ্ছে...</p> : list.items.length === 0 ? <p className="p-3 text-sm text-muted-foreground">কোনো সদস্য পাওয়া যায়নি</p> : list.items.map((m) => (
            <button key={m._id} type="button" className="w-full text-left p-2.5 hover:bg-muted/50" onClick={() => onPick(m)}>
              <p className="text-sm font-medium">{m.studentId?.name} <span className="text-xs text-muted-foreground">({m.studentId?.registrationId})</span></p>
              <p className="text-xs text-muted-foreground">{m.membershipNo} • {refName(m.messId)} • {MEMBERSHIP_STATUS_LABELS[m.status]} • বকেয়া {tk(m.balance?.due)}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
