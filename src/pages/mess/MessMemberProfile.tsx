import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Coins, Receipt, Printer } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessPage, MessSelect, useMessScope } from "@/components/mess/MessShell";
import { MethodSelect, ReasonDialog, ReceivePaymentDialog, SeatPicker, StatusBadge } from "@/components/mess/MessCommon";
import { api } from "@/lib/apiClient";
import {
  BILL_STATUS_LABELS, currentPeriod, DEPOSIT_TX_LABELS, DEPOSIT_TX_STATUS_LABELS, errMsg, MEMBERSHIP_STATUS_LABELS, PURPOSE_LABELS, refName,
  SETTLEMENT_STATUS_LABELS, tk, todayISO, useApiData, type Bill, type DepositTx, type Membership, type MessPayment, type Settlement,
} from "@/lib/mess";
import {
  MESS_BILLING_MANAGE, MESS_FINANCE_APPROVE, MESS_MEMBERS_APPROVE, MESS_MEMBERS_MANAGE, MESS_PAYMENTS_COLLECT,
} from "@/lib/permissions";

interface Profile {
  membership: Membership;
  guardian: { name: string; phone: string; relation: string } | null;
  bills: Bill[];
  payments: MessPayment[];
  depositTransactions: DepositTx[];
  settlements: Settlement[];
  otherMemberships: { _id: string; membershipNo: string; status: Membership["status"]; joiningDate: string; leftDate?: string; messId: { name: string }; roomId: { name: string }; seatId: { seatNumber: string } }[];
}

type DialogKind = null | "pay" | "activate" | "status" | "transfer" | "terms" | "cancel" | "reject" | "bill" | "deposit" | "settle";

export default function MessMemberProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useMessScope();
  const { data, loading, error, reload } = useApiData<Profile>(id ? `/mess/memberships/${id}` : null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const close = () => setDialog(null);
  const done = async (msg: string) => { toast.success(msg); close(); await reload(); };

  if (loading && !data) return <MessPage title="সদস্য প্রোফাইল" hideMessFilter><Skeleton className="h-64" /></MessPage>;
  if (error || !data) return <MessPage title="সদস্য প্রোফাইল" hideMessFilter><Card><CardContent className="py-8 text-center text-destructive">{error || "পাওয়া যায়নি"}</CardContent></Card></MessPage>;

  const m = data.membership;
  const s = m.studentId;
  const b = m.balance;
  const isOpen = ["pending", "approved", "active", "on_leave", "notice_given"].includes(m.status);
  const liveSettlement = data.settlements.find((x) => x.status === "pending" || x.status === "approved");

  const approve = async () => {
    try { await api.post(`/mess/memberships/${m._id}/approve`, {}); await done("আবেদন অনুমোদিত — সিট সংরক্ষিত"); } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <MessPage
      title={s?.name ?? "সদস্য"}
      subtitle={`${m.membershipNo} • সিস্টেম আইডি ${s?.registrationId ?? "—"}${s?.currentRollNumber ? ` • রেজি. ${s.currentRollNumber}` : ""}`}
      hideMessFilter
      actions={
        <>
          <Button variant="ghost" onClick={() => navigate("/mess/members")}><ArrowLeft className="h-4 w-4 mr-1" />তালিকা</Button>
          {m.status !== "pending" && m.status !== "cancelled" && can(MESS_PAYMENTS_COLLECT) && <Button onClick={() => setDialog("pay")}><Coins className="h-4 w-4 mr-1" />পেমেন্ট নিন</Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline">আরও কাজ</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {m.status === "pending" && can(MESS_MEMBERS_APPROVE) && <DropdownMenuItem onClick={approve}>আবেদন অনুমোদন</DropdownMenuItem>}
              {m.status === "pending" && can(MESS_MEMBERS_APPROVE) && <DropdownMenuItem onClick={() => setDialog("reject")}>আবেদন প্রত্যাখ্যান</DropdownMenuItem>}
              {(m.status === "approved" || m.status === "pending") && can(MESS_MEMBERS_APPROVE) && <DropdownMenuItem onClick={() => setDialog("activate")}>সক্রিয় করুন (মেসে উঠেছেন)</DropdownMenuItem>}
              {["active", "on_leave", "notice_given"].includes(m.status) && can(MESS_MEMBERS_MANAGE) && <DropdownMenuItem onClick={() => setDialog("status")}>অবস্থা পরিবর্তন (ছুটি/নোটিশ)</DropdownMenuItem>}
              {m.holdsSeat && can(MESS_MEMBERS_MANAGE) && <DropdownMenuItem onClick={() => setDialog("transfer")}>সিট স্থানান্তর</DropdownMenuItem>}
              {isOpen && can(MESS_MEMBERS_MANAGE) && <DropdownMenuItem onClick={() => setDialog("terms")}>ভাড়া/জামানত/তথ্য সম্পাদনা</DropdownMenuItem>}
              <DropdownMenuSeparator />
              {["active", "on_leave", "notice_given"].includes(m.status) && can(MESS_BILLING_MANAGE) && <DropdownMenuItem onClick={() => setDialog("bill")}>এই সদস্যের বিল তৈরি</DropdownMenuItem>}
              {m.status !== "cancelled" && m.status !== "left" && can(MESS_PAYMENTS_COLLECT) && <DropdownMenuItem onClick={() => setDialog("deposit")}>জামানত সমন্বয় / ফেরত</DropdownMenuItem>}
              {["approved", "active", "on_leave", "notice_given"].includes(m.status) && !liveSettlement && can(MESS_MEMBERS_MANAGE) && <DropdownMenuItem onClick={() => setDialog("settle")}>ছেড়ে যাওয়া — চূড়ান্ত নিষ্পত্তি</DropdownMenuItem>}
              {isOpen && can(MESS_MEMBERS_MANAGE) && <DropdownMenuItem className="text-destructive" onClick={() => setDialog("cancel")}>সদস্যপদ বাতিল</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Figure label="বর্তমান বকেয়া" value={tk(b?.due)} tone={b?.due > 0 ? "text-destructive" : ""} />
        <Figure label="অগ্রিম জমা" value={tk(b?.advance)} tone="text-success" />
        <Figure label="মোট বিল / পরিশোধ" value={`${tk(b?.totalBilled)} / ${tk(b?.totalPaid)}`} />
        <Figure label="জামানত (জমা / নির্ধারিত)" value={`${tk(b?.depositBalance)} / ${tk(m.securityDeposit)}`} />
        <Figure label="মাসিক ভাড়া − ছাড়" value={`${tk(m.monthlyRent)} − ${tk(m.discount)}`} />
      </div>

      {liveSettlement && (
        <Card className="border-warning/40"><CardContent className="py-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <span>চূড়ান্ত নিষ্পত্তি {liveSettlement.settlementNo} — {SETTLEMENT_STATUS_LABELS[liveSettlement.status]} (ফেরতযোগ্য: {tk(liveSettlement.refundableAmount)})</span>
          <Button size="sm" variant="outline" onClick={() => navigate("/mess/deposits?tab=settlements")}>নিষ্পত্তি দেখুন</Button>
        </CardContent></Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">সদস্যপদের তথ্য</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="অবস্থা"><StatusBadge status={m.status} label={MEMBERSHIP_STATUS_LABELS[m.status]} /></Row>
            <Row label="মেস">{refName(m.messId)}</Row>
            <Row label="রুম / সিট">{refName(m.roomId)} / {refName(m.seatId, "seatNumber")}</Row>
            <Row label="যোগদান">{m.joiningDate}</Row>
            <Row label="বিলিং শুরু">{m.billingStartDate}</Row>
            {m.expectedLeavingDate && <Row label="সম্ভাব্য ছাড়া">{m.expectedLeavingDate}</Row>}
            {m.leftDate && <Row label="ছেড়েছেন">{m.leftDate}</Row>}
            <Row label="সেটআপ চার্জ">{tk(m.setupCharge)} {m.setupChargeBilled ? "(বিলে যুক্ত)" : m.setupCharge > 0 ? "(পরবর্তী বিলে যুক্ত হবে)" : ""}</Row>
            {m.cancelReason && <Row label="বাতিলের কারণ">{m.cancelReason}</Row>}
            {m.notes && <Row label="নোট">{m.notes}</Row>}
            {(m.documents ?? []).map((d) => <Row key={d.url} label={d.label}><a className="text-primary underline" href={d.url} target="_blank" rel="noreferrer">দেখুন</a></Row>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">শিক্ষার্থী (একাডেমিক তথ্য অপরিবর্তিত)</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="নাম"><Link to={`/students/${s?._id}`} className="text-primary underline">{s?.name}</Link></Row>
            <Row label="মোবাইল">{s?.phone || "—"}</Row>
            <Row label="কোর্স">{s?.course || "—"}</Row>
            <Row label="ব্যাচ">{refName(s?.currentBatchId)}</Row>
            <Row label="অভিভাবক">{data.guardian ? `${data.guardian.name} (${data.guardian.relation}) — ${data.guardian.phone}` : "—"}</Row>
            <Row label="জরুরি যোগাযোগ">{m.emergencyContact?.name || m.emergencyContact?.phone ? `${m.emergencyContact?.name ?? ""} ${m.emergencyContact?.phone ?? ""} ${m.emergencyContact?.relation ? `(${m.emergencyContact.relation})` : ""}` : "—"}</Row>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">অন্যান্য সদস্যপদ (ইতিহাস)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.otherMemberships.length === 0 ? <p className="text-muted-foreground">নেই</p> : data.otherMemberships.map((o) => (
              <Link key={o._id} to={`/mess/members/${o._id}`} className="block rounded-md border p-2 hover:bg-muted/50">
                <p className="font-mono text-xs">{o.membershipNo} • {MEMBERSHIP_STATUS_LABELS[o.status]}</p>
                <p className="text-xs text-muted-foreground">{o.messId?.name} • রুম {o.roomId?.name} • সিট {o.seatId?.seatNumber} • {o.joiningDate} → {o.leftDate || "—"}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bills">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="bills">বিল ({data.bills.length})</TabsTrigger>
          <TabsTrigger value="payments">পেমেন্ট ({data.payments.length})</TabsTrigger>
          <TabsTrigger value="deposit">জামানত লেনদেন ({data.depositTransactions.length})</TabsTrigger>
          <TabsTrigger value="seats">সিটের ইতিহাস</TabsTrigger>
          <TabsTrigger value="status">অবস্থার ইতিহাস</TabsTrigger>
          <TabsTrigger value="settlements">নিষ্পত্তি ({data.settlements.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="bills">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>বিল নং</TableHead><TableHead>মাস</TableHead><TableHead className="text-right">চার্জ</TableHead><TableHead className="text-right">পূর্বের বকেয়া</TableHead><TableHead className="text-right">মোট পরিশোধযোগ্য</TableHead><TableHead className="text-right">পরিশোধ</TableHead><TableHead className="text-right">বাকি</TableHead><TableHead>অবস্থা</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {data.bills.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">কোনো বিল নেই</TableCell></TableRow> : data.bills.map((x) => (
                  <TableRow key={x._id}>
                    <TableCell className="font-mono text-xs">{x.billNo}</TableCell>
                    <TableCell>{x.period}</TableCell>
                    <TableCell className="text-right">{tk(x.currentCharges)}</TableCell>
                    <TableCell className="text-right">{tk(x.previousDue)}</TableCell>
                    <TableCell className="text-right">{tk(x.totalPayable)}</TableCell>
                    <TableCell className="text-right">{tk(x.paidAmount)}</TableCell>
                    <TableCell className="text-right">{tk(x.dueAmount)}</TableCell>
                    <TableCell><StatusBadge status={x.status} label={BILL_STATUS_LABELS[x.status]} /></TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => navigate(`/mess/bills/${x._id}/invoice`)}><Printer className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>রসিদ</TableHead><TableHead>তারিখ</TableHead><TableHead>ধরন</TableHead><TableHead>পদ্ধতি</TableHead><TableHead className="text-right">পরিমাণ</TableHead><TableHead>অবস্থা</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {data.payments.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">কোনো পেমেন্ট নেই</TableCell></TableRow> : data.payments.map((p) => (
                  <TableRow key={p._id} className={p.status === "cancelled" ? "opacity-60" : ""}>
                    <TableCell className="font-mono text-xs">{p.receiptNo}</TableCell>
                    <TableCell>{p.date}</TableCell>
                    <TableCell>{PURPOSE_LABELS[p.purpose]}</TableCell>
                    <TableCell>{p.method}{p.reference ? <p className="text-xs text-muted-foreground">{p.reference}</p> : null}</TableCell>
                    <TableCell className="text-right">{tk(p.amount)}</TableCell>
                    <TableCell>{p.status === "cancelled" ? <StatusBadge status="cancelled" label="বাতিল" /> : p.verified ? <StatusBadge status="approved" label="যাচাইকৃত" /> : <StatusBadge status="active" label="সক্রিয়" />}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => navigate(`/mess/payments/${p._id}/receipt`)}><Receipt className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="deposit">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>নং</TableHead><TableHead>তারিখ</TableHead><TableHead>ধরন</TableHead><TableHead>কারণ</TableHead><TableHead className="text-right">পরিমাণ</TableHead><TableHead>অবস্থা</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.depositTransactions.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">জামানত থেকে কোনো কর্তন/ফেরত নেই</TableCell></TableRow> : data.depositTransactions.map((t) => (
                  <TableRow key={t._id}>
                    <TableCell className="font-mono text-xs">{t.txNo}</TableCell>
                    <TableCell>{t.date}</TableCell>
                    <TableCell>{DEPOSIT_TX_LABELS[t.type]}</TableCell>
                    <TableCell className="text-sm">{t.reason || "—"}</TableCell>
                    <TableCell className="text-right">{tk(t.amount)}</TableCell>
                    <TableCell><StatusBadge status={t.status} label={DEPOSIT_TX_STATUS_LABELS[t.status]} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="seats">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>মেস</TableHead><TableHead>রুম</TableHead><TableHead>সিট</TableHead><TableHead>থেকে</TableHead><TableHead>পর্যন্ত</TableHead><TableHead className="text-right">ভাড়া</TableHead><TableHead>কারণ</TableHead></TableRow></TableHeader>
              <TableBody>
                {(m.seatHistory ?? []).length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">এখনো মেসে ওঠেননি</TableCell></TableRow> : [...(m.seatHistory ?? [])].reverse().map((h, i) => (
                  <TableRow key={i}><TableCell>{refName(h.messId)}</TableCell><TableCell>{refName(h.roomId)}</TableCell><TableCell>{refName(h.seatId, "seatNumber")}</TableCell><TableCell>{h.fromDate}</TableCell><TableCell>{h.toDate || "বর্তমান"}</TableCell><TableCell className="text-right">{tk(h.monthlyRent)}</TableCell><TableCell className="text-sm">{h.reason || "—"}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="status">
          <Card><CardContent className="space-y-2 py-4">
            {[...(m.statusHistory ?? [])].reverse().map((h, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm border-b pb-2">
                <StatusBadge status={h.status} label={MEMBERSHIP_STATUS_LABELS[h.status]} />
                <span className="text-muted-foreground text-xs">{new Date(h.at).toLocaleString("bn-BD")}</span>
                {h.note && <span>{h.note}</span>}
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="settlements">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>নং</TableHead><TableHead>ছাড়ার তারিখ</TableHead><TableHead className="text-right">ফেরতযোগ্য</TableHead><TableHead className="text-right">অবশিষ্ট বকেয়া</TableHead><TableHead>অবস্থা</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {data.settlements.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">নেই</TableCell></TableRow> : data.settlements.map((x) => (
                  <TableRow key={x._id}><TableCell className="font-mono text-xs">{x.settlementNo}</TableCell><TableCell>{x.leavingDate}</TableCell><TableCell className="text-right">{tk(x.refundableAmount)}</TableCell><TableCell className="text-right">{tk(x.remainingDue)}</TableCell><TableCell><StatusBadge status={x.status} label={SETTLEMENT_STATUS_LABELS[x.status]} /></TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => navigate(`/mess/settlements/${x._id}/print`)}><Printer className="h-3.5 w-3.5" /></Button></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <ReceivePaymentDialog
        open={dialog === "pay"}
        onOpenChange={(v) => !v && close()}
        target={{ membershipId: m._id, label: `${s?.name} — ${m.membershipNo}`, due: b?.due, advance: b?.advance, depositRemaining: Math.max(0, m.securityDeposit - (b?.depositCollected ?? 0)), allowDeposit: m.status !== "left" }}
        onDone={(pid) => { void reload(); navigate(`/mess/payments/${pid}/receipt`); }}
      />
      <ReasonDialog open={dialog === "reject"} onOpenChange={(v) => !v && close()} title="আবেদন প্রত্যাখ্যান" destructive onConfirm={async (reason) => { await api.post(`/mess/memberships/${m._id}/reject`, { reason }); await done("আবেদন প্রত্যাখ্যাত"); }} />
      <ReasonDialog open={dialog === "cancel"} onOpenChange={(v) => !v && close()} title="সদস্যপদ বাতিল" description="শুধু কোনো বিল/পেমেন্ট না থাকলে বাতিল করা যায়। আর্থিক লেনদেন থাকলে চূড়ান্ত নিষ্পত্তি ব্যবহার করুন।" destructive onConfirm={async (reason) => { await api.post(`/mess/memberships/${m._id}/cancel`, { reason }); await done("সদস্যপদ বাতিল হয়েছে"); }} />
      <ActivateDialog open={dialog === "activate"} membership={m} onClose={close} onDone={done} />
      <StatusDialog open={dialog === "status"} membership={m} onClose={close} onDone={done} />
      <TransferDialog open={dialog === "transfer"} membership={m} onClose={close} onDone={done} />
      <TermsDialog open={dialog === "terms"} membership={m} onClose={close} onDone={done} />
      <IndividualBillDialog open={dialog === "bill"} membership={m} onClose={close} onDone={done} />
      <DepositTxDialog open={dialog === "deposit"} membership={m} onClose={close} onDone={done} />
      <SettlementDialog open={dialog === "settle"} membership={m} onClose={close} onDone={done} canApprove={can(MESS_FINANCE_APPROVE)} />
    </MessPage>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`text-lg font-bold ${tone ?? ""}`}>{value}</p></CardContent></Card>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-b border-dashed pb-1"><span className="text-muted-foreground">{label}</span><span className="text-right">{children}</span></div>;
}

type ChildProps = { open: boolean; membership: Membership; onClose: () => void; onDone: (msg: string) => Promise<void> };

function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return { busy, run };
}

function SimpleDialog({ open, onClose, title, description, busy, onSubmit, children, submitLabel = "নিশ্চিত করুন" }: { open: boolean; onClose: () => void; title: string; description?: string; busy: boolean; onSubmit: () => void; children: React.ReactNode; submitLabel?: string }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>
        <div className="space-y-3">{children}</div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>বাতিল</Button>
          <Button disabled={busy} onClick={onSubmit}>{busy ? "প্রক্রিয়া হচ্ছে..." : submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivateDialog({ open, membership: m, onClose, onDone }: ChildProps) {
  const [joiningDate, setJoiningDate] = useState(m.joiningDate);
  const [billingStartDate, setBillingStartDate] = useState("");
  const { busy, run } = useBusy();
  useEffect(() => { if (open) { setJoiningDate(m.joiningDate); setBillingStartDate(""); } }, [open, m]);
  return (
    <SimpleDialog open={open} onClose={onClose} title="সদস্যপদ সক্রিয় করুন" description="সদস্য মেসে উঠেছেন — সিট দখলকৃত হবে এবং বিলিং শুরু হবে।" busy={busy}
      onSubmit={() => run(async () => { await api.post(`/mess/memberships/${m._id}/activate`, { joiningDate, billingStartDate: billingStartDate || undefined }); await onDone("সদস্যপদ সক্রিয় হয়েছে"); })}>
      <div className="space-y-1.5"><Label>প্রকৃত যোগদানের তারিখ</Label><Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>বিলিং শুরুর তারিখ (ঐচ্ছিক)</Label><Input type="date" value={billingStartDate} onChange={(e) => setBillingStartDate(e.target.value)} /></div>
    </SimpleDialog>
  );
}

function StatusDialog({ open, membership: m, onClose, onDone }: ChildProps) {
  const options = (["active", "on_leave", "notice_given"] as const).filter((x) => x !== m.status);
  const [status, setStatus] = useState<string>(options[0]);
  const [expectedLeavingDate, setExpected] = useState("");
  const [note, setNote] = useState("");
  const { busy, run } = useBusy();
  useEffect(() => { if (open) { setStatus(options[0]); setExpected(m.expectedLeavingDate ?? ""); setNote(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <SimpleDialog open={open} onClose={onClose} title="অবস্থা পরিবর্তন" description="ছুটিতে থাকলেও সিট ও মাসিক ভাড়া বহাল থাকে।" busy={busy}
      onSubmit={() => run(async () => { await api.post(`/mess/memberships/${m._id}/status`, { status, expectedLeavingDate: expectedLeavingDate || undefined, note: note || undefined }); await onDone("অবস্থা পরিবর্তিত হয়েছে"); })}>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{MEMBERSHIP_STATUS_LABELS[o]}</SelectItem>)}</SelectContent>
      </Select>
      {status === "notice_given" && <div className="space-y-1.5"><Label>সম্ভাব্য ছাড়ার তারিখ *</Label><Input type="date" value={expectedLeavingDate} onChange={(e) => setExpected(e.target.value)} /></div>}
      <Textarea rows={2} placeholder="নোট" value={note} onChange={(e) => setNote(e.target.value)} />
    </SimpleDialog>
  );
}

function TransferDialog({ open, membership: m, onClose, onDone }: ChildProps) {
  const [messId, setMessId] = useState(m.messId?._id ?? "");
  const [seatId, setSeatId] = useState("");
  const [rent, setRent] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const { busy, run } = useBusy();
  useEffect(() => { if (open) { setMessId(m.messId?._id ?? ""); setSeatId(""); setRent(""); setEffectiveDate(todayISO()); setReason(""); } }, [open, m]);
  return (
    <SimpleDialog open={open} onClose={onClose} title="সিট স্থানান্তর" description={`বর্তমান: রুম ${refName(m.roomId)}, সিট ${refName(m.seatId, "seatNumber")}`} busy={busy}
      onSubmit={() => run(async () => {
        if (!seatId) throw new Error("নতুন সিট নির্বাচন করুন");
        await api.post(`/mess/memberships/${m._id}/transfer`, { seatId, effectiveDate, monthlyRent: rent !== "" ? Number(rent) : undefined, reason: reason || undefined });
        await onDone("সিট স্থানান্তর সম্পন্ন");
      })}>
      <div className="space-y-1.5"><Label>মেস</Label><MessSelect value={messId} onChange={(v) => { setMessId(v); setSeatId(""); }} activeOnly /></div>
      <div className="space-y-1.5"><Label>নতুন সিট</Label><SeatPicker messId={messId} value={seatId} onChange={(id, seat) => { setSeatId(id); if (seat) setRent(String(seat.monthlyRent)); }} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>নতুন মাসিক ভাড়া</Label><Input type="number" min={0} value={rent} onChange={(e) => setRent(e.target.value)} placeholder={String(m.monthlyRent)} /></div>
        <div className="space-y-1.5"><Label>কার্যকর তারিখ</Label><Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></div>
      </div>
      <Input placeholder="কারণ" value={reason} onChange={(e) => setReason(e.target.value)} />
    </SimpleDialog>
  );
}

function TermsDialog({ open, membership: m, onClose, onDone }: ChildProps) {
  const [f, setF] = useState({ monthlyRent: "", discount: "", securityDeposit: "", setupCharge: "", expectedLeavingDate: "", billingStartDate: "", ecName: "", ecPhone: "", ecRelation: "", notes: "" });
  const { busy, run } = useBusy();
  useEffect(() => {
    if (open) setF({ monthlyRent: String(m.monthlyRent), discount: String(m.discount), securityDeposit: String(m.securityDeposit), setupCharge: String(m.setupCharge), expectedLeavingDate: m.expectedLeavingDate ?? "", billingStartDate: m.billingStartDate, ecName: m.emergencyContact?.name ?? "", ecPhone: m.emergencyContact?.phone ?? "", ecRelation: m.emergencyContact?.relation ?? "", notes: m.notes ?? "" });
  }, [open, m]);
  return (
    <SimpleDialog open={open} onClose={onClose} title="সদস্যপদের শর্ত সম্পাদনা" description="পরিবর্তন শুধু ভবিষ্যতের বিলে প্রযোজ্য — আগের বিল অপরিবর্তিত থাকে।" busy={busy}
      onSubmit={() => run(async () => {
        await api.patch(`/mess/memberships/${m._id}`, {
          monthlyRent: Number(f.monthlyRent) || 0, discount: Number(f.discount) || 0, securityDeposit: Number(f.securityDeposit) || 0,
          ...(m.setupChargeBilled ? {} : { setupCharge: Number(f.setupCharge) || 0 }),
          expectedLeavingDate: f.expectedLeavingDate || undefined, billingStartDate: f.billingStartDate || undefined,
          emergencyContact: { name: f.ecName || undefined, phone: f.ecPhone || undefined, relation: f.ecRelation || undefined }, notes: f.notes || undefined,
        });
        await onDone("তথ্য আপডেট হয়েছে");
      })}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>মাসিক ভাড়া</Label><Input type="number" min={0} value={f.monthlyRent} onChange={(e) => setF({ ...f, monthlyRent: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>মাসিক ছাড়</Label><Input type="number" min={0} value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>জামানত</Label><Input type="number" min={0} value={f.securityDeposit} onChange={(e) => setF({ ...f, securityDeposit: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>সেটআপ চার্জ</Label><Input type="number" min={0} disabled={m.setupChargeBilled} value={f.setupCharge} onChange={(e) => setF({ ...f, setupCharge: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>বিলিং শুরু</Label><Input type="date" value={f.billingStartDate} onChange={(e) => setF({ ...f, billingStartDate: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>সম্ভাব্য ছাড়া</Label><Input type="date" value={f.expectedLeavingDate} onChange={(e) => setF({ ...f, expectedLeavingDate: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Input placeholder="জরুরি যোগাযোগ" value={f.ecName} onChange={(e) => setF({ ...f, ecName: e.target.value })} />
        <Input placeholder="মোবাইল" value={f.ecPhone} onChange={(e) => setF({ ...f, ecPhone: e.target.value })} />
        <Input placeholder="সম্পর্ক" value={f.ecRelation} onChange={(e) => setF({ ...f, ecRelation: e.target.value })} />
      </div>
      <Textarea rows={2} placeholder="নোট" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
    </SimpleDialog>
  );
}

function IndividualBillDialog({ open, membership: m, onClose, onDone }: ChildProps) {
  const [period, setPeriod] = useState(currentPeriod());
  const [charges, setCharges] = useState<{ label: string; amount: string }[]>([]);
  const [extraDiscount, setExtraDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const { busy, run } = useBusy();
  useEffect(() => { if (open) { setPeriod(currentPeriod()); setCharges([]); setExtraDiscount("0"); setNotes(""); } }, [open]);
  return (
    <SimpleDialog open={open} onClose={onClose} title="সদস্যের মাসিক বিল তৈরি" description="একই মাসের জন্য দ্বিতীয়বার বিল তৈরি হবে না।" busy={busy} submitLabel="বিল তৈরি করুন"
      onSubmit={() => run(async () => {
        const res = await api.post<{ created: number; skippedExisting: number; failed: { reason: string }[] }>("/mess/bills/generate", {
          period, membershipIds: [m._id],
          additionalCharges: charges.filter((c) => c.label && Number(c.amount) > 0).map((c) => ({ label: c.label, amount: Number(c.amount) })),
          extraDiscount: Number(extraDiscount) || 0, notes: notes || undefined,
        });
        if (res.failed.length) throw new Error(res.failed[0].reason);
        await onDone(res.created ? "বিল তৈরি হয়েছে" : "এই মাসের বিল আগেই তৈরি হয়েছে");
      })}>
      <div className="space-y-1.5"><Label>বিলের মাস</Label><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
      <div className="space-y-2">
        <Label>অতিরিক্ত চার্জ</Label>
        {charges.map((c, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="বিবরণ" value={c.label} onChange={(e) => setCharges(charges.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Input type="number" min={0} className="w-32" placeholder="৳" value={c.amount} onChange={(e) => setCharges(charges.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
            <Button variant="ghost" size="sm" onClick={() => setCharges(charges.filter((_, j) => j !== i))}>×</Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setCharges([...charges, { label: "", amount: "" }])}>+ চার্জ যোগ</Button>
      </div>
      <div className="space-y-1.5"><Label>এই বিলে অতিরিক্ত ছাড় (৳)</Label><Input type="number" min={0} value={extraDiscount} onChange={(e) => setExtraDiscount(e.target.value)} /></div>
      <Input placeholder="নোট" value={notes} onChange={(e) => setNotes(e.target.value)} />
    </SimpleDialog>
  );
}

function DepositTxDialog({ open, membership: m, onClose, onDone }: ChildProps) {
  const [type, setType] = useState<DepositTx["type"]>("deduct");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("");
  const { busy, run } = useBusy();
  useEffect(() => { if (open) { setType("deduct"); setAmount(""); setReason(""); setMethod(""); } }, [open]);
  return (
    <SimpleDialog open={open} onClose={onClose} title="জামানত সমন্বয় / ফেরত" description={`বর্তমান জামানত: ${tk(m.balance?.depositBalance)} • বকেয়া: ${tk(m.balance?.due)}`} busy={busy}
      onSubmit={() => run(async () => {
        const tx = await api.post<{ status: string }>(`/mess/memberships/${m._id}/deposit-transactions`, { type, amount: Number(amount), reason: reason || undefined, method: type === "refund" && method ? method : undefined });
        await onDone(tx.status === "pending" ? "অনুরোধ জমা হয়েছে — অনুমোদনের অপেক্ষায়" : "সম্পন্ন হয়েছে");
      })}>
      <Select value={type} onValueChange={(v) => setType(v as DepositTx["type"])}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(DEPOSIT_TX_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
      </Select>
      <div className="space-y-1.5"><Label>পরিমাণ (৳)</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      {type === "refund" && <div className="space-y-1.5"><Label>ফেরতের পদ্ধতি</Label><MethodSelect value={method} onChange={setMethod} /></div>}
      <Textarea rows={2} placeholder={type === "refund" ? "নোট" : "কারণ *"} value={reason} onChange={(e) => setReason(e.target.value)} />
      <p className="text-xs text-muted-foreground">ফেরত অনুমোদনের পর "জামানত ও নিষ্পত্তি" পেজ থেকে পরিশোধ সম্পন্ন করুন। সদস্য মেস ছাড়লে "চূড়ান্ত নিষ্পত্তি" ব্যবহার করুন।</p>
    </SimpleDialog>
  );
}

interface SettlementPreview { depositBalance: number; advanceBalance: number; outstandingDue: number; damageCharges: number; depositApplied: number; depositRefund: number; advanceRefund: number; refundableAmount: number; remainingDue: number; pendingDepositTransactions: number }

function SettlementDialog({ open, membership: m, onClose, onDone, canApprove }: ChildProps & { canApprove: boolean }) {
  const [leavingDate, setLeavingDate] = useState(m.expectedLeavingDate || todayISO());
  const [damage, setDamage] = useState("0");
  const [damageNote, setDamageNote] = useState("");
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const { busy, run } = useBusy();
  useEffect(() => { if (open) { setLeavingDate(m.expectedLeavingDate || todayISO()); setDamage("0"); setDamageNote(""); } }, [open, m]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api.get<SettlementPreview>(`/mess/memberships/${m._id}/settlement-preview?damageCharges=${Number(damage) || 0}`).then(setPreview).catch((err) => toast.error(errMsg(err)));
    }, 300);
    return () => clearTimeout(t);
  }, [open, damage, m._id]);
  return (
    <SimpleDialog open={open} onClose={onClose} title="চূড়ান্ত হিসাব নিষ্পত্তি (মেস ছাড়া)" description="জামানত + অগ্রিম − বকেয়া − ক্ষতি/অন্যান্য চার্জ = ফেরতযোগ্য" busy={busy} submitLabel={canApprove ? "নিষ্পত্তি তৈরি ও অনুমোদন" : "অনুমোদনের জন্য জমা দিন"}
      onSubmit={() => run(async () => {
        await api.post(`/mess/memberships/${m._id}/settlements`, { leavingDate, damageCharges: Number(damage) || 0, damageNote: damageNote || undefined });
        await onDone(canApprove ? "নিষ্পত্তি অনুমোদিত — 'জামানত ও নিষ্পত্তি' থেকে সম্পন্ন করুন" : "নিষ্পত্তি অনুমোদনের জন্য জমা হয়েছে");
      })}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>ছাড়ার তারিখ</Label><Input type="date" value={leavingDate} onChange={(e) => setLeavingDate(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>ক্ষতি / অন্যান্য চার্জ (৳)</Label><Input type="number" min={0} value={damage} onChange={(e) => setDamage(e.target.value)} /></div>
      </div>
      {Number(damage) > 0 && <Input placeholder="চার্জের বিবরণ *" value={damageNote} onChange={(e) => setDamageNote(e.target.value)} />}
      {preview && (
        <div className="rounded-md border text-sm divide-y">
          <PRow label="জামানত ব্যালেন্স" value={tk(preview.depositBalance)} />
          <PRow label="+ অগ্রিম ব্যালেন্স" value={tk(preview.advanceBalance)} />
          <PRow label="− বকেয়া" value={tk(preview.outstandingDue)} />
          <PRow label="− ক্ষতি/অন্যান্য" value={tk(preview.damageCharges)} />
          <PRow label="= ফেরতযোগ্য" value={tk(preview.refundableAmount)} bold />
          <PRow label="জামানত থেকে বকেয়ায় সমন্বয়" value={tk(preview.depositApplied)} />
          <PRow label="জামানত ফেরত" value={tk(preview.depositRefund)} />
          <PRow label="অগ্রিম ফেরত" value={tk(preview.advanceRefund)} />
          {preview.remainingDue > 0 && <PRow label="নিষ্পত্তির পরও শিক্ষার্থীর বকেয়া" value={tk(preview.remainingDue)} bold />}
          {preview.pendingDepositTransactions > 0 && <p className="p-2 text-destructive text-xs">জামানতের অপেক্ষমাণ লেনদেন আছে — আগে সেগুলো নিষ্পত্তি করুন।</p>}
        </div>
      )}
    </SimpleDialog>
  );
}
function PRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between px-3 py-1.5 ${bold ? "font-semibold" : ""}`}><span>{label}</span><span>{value}</span></div>;
}
