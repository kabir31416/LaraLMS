import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus2, Printer, Ban, SlidersHorizontal, BellRing, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessPage, MessSelect, useMessScope } from "@/components/mess/MessShell";
import { SuperDeleteButton } from "@/components/mess/SuperDelete";
import { Pager, ReasonDialog, SearchInput, StatusBadge, TableState } from "@/components/mess/MessCommon";
import { api } from "@/lib/apiClient";
import { BILL_STATUS_LABELS, currentPeriod, errMsg, periodName, PRORATION_MODE_LABELS, qs, refName, tk, usePagedList, type Bill, type ProrationMode } from "@/lib/mess";
import { MESS_BILLING_MANAGE, MESS_PAYMENTS_COLLECT } from "@/lib/permissions";
import { exportExcel } from "@/lib/exporters";

export default function MessBilling() {
  const navigate = useNavigate();
  const { messId, can, settings } = useMessScope();
  const [period, setPeriod] = useState(currentPeriod());
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId, period, status, search]);
  const list = usePagedList<Bill>(`/mess/bills${qs({ messId, period, status, search, page, limit: 25 })}`);
  const totals = (list.meta?.totals ?? { charges: 0, paid: 0, due: 0 }) as { charges: number; paid: number; due: number };
  const [genOpen, setGenOpen] = useState(false);
  const [cancelling, setCancelling] = useState<Bill | null>(null);
  const [adjusting, setAdjusting] = useState<Bill | null>(null);
  const canManage = can(MESS_BILLING_MANAGE);
  const [reminding, setReminding] = useState(false);
  const sendReminders = async () => {
    if (!window.confirm(`${messId === "all" ? "সব মেসের" : "নির্বাচিত মেসের"} বকেয়া থাকা সদস্যদের মোবাইলে রিমাইন্ডার SMS যাবে (আজ একজনকে একবারই)। পাঠাবেন?`)) return;
    setReminding(true);
    try {
      const r = await api.post<{ candidates: number; sent: number; failed: number; skipped: number }>("/mess/sms/due-reminders", { messId: messId !== "all" ? messId : undefined });
      toast.success(`বকেয়া সদস্য ${r.candidates} জন • প্রোভাইডার গ্রহণ করেছে ${r.sent} • ব্যর্থ ${r.failed} • বাদ ${r.skipped} (আগেই পাঠানো/মোবাইল নেই)`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setReminding(false);
    }
  };

  const exportRows = () => exportExcel({
    filename: `mess-bills-${period || "all"}`,
    title: "Mess Bills",
    headers: ["Bill No", "Period", "Student", "Reg ID", "Mess", "Room", "Seat", "Rent & Charges", "Previous Due", "Total Payable", "Paid", "Due", "Status"],
    rows: list.items.map((b) => [b.billNo, b.period, b.studentId?.name ?? "", b.studentId?.registrationId ?? "", refName(b.messId), refName(b.roomId), refName(b.seatId, "seatNumber"), b.currentCharges, b.previousDue, b.totalPayable, b.paidAmount, b.dueAmount, BILL_STATUS_LABELS[b.status]]),
  });

  return (
    <MessPage
      title="মাসিক বিলিং"
      subtitle="মাসিক বিল শুধু সিট ভাড়ার: মোট প্রদেয় = মাসিক ভাড়া + অন্যান্য চার্জ/জরিমানা − ছাড় + পূর্বের বকেয়া। একবারের ডাইনিং চার্জ ও এক মাসের অগ্রিম বিলে আসে না।"
      actions={
        <>
          {(can(MESS_PAYMENTS_COLLECT) || canManage) && <Button variant="outline" onClick={sendReminders} disabled={reminding}><BellRing className="h-4 w-4 mr-1" />{reminding ? "পাঠানো হচ্ছে..." : "বকেয়া রিমাইন্ডার SMS"}</Button>}
          {canManage && <Button onClick={() => setGenOpen(true)}><FilePlus2 className="h-4 w-4 mr-1" />বিল তৈরি</Button>}
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">মোট চার্জ</p><p className="text-lg font-bold">{tk(totals.charges)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">পরিশোধিত</p><p className="text-lg font-bold text-success">{tk(totals.paid)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">বাকি</p><p className="text-lg font-bold text-destructive">{tk(totals.due)}</p></CardContent></Card>
      </div>
      {settings && (
        <p className="flex items-start gap-2 rounded-lg border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          <Zap className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            {settings.autoBillingEnabled ? `স্বয়ংক্রিয় বিল চালু — প্রতি মাসের ${settings.billingDay} তারিখে সার্ভার নিজেই সব সক্রিয় সদস্যের বিল তৈরি করে।` : "স্বয়ংক্রিয় বিল বন্ধ — মেস সেটিংস থেকে চালু করুন।"}{" "}
            এখানকার "বিল তৈরি" একই নিয়মে চলে, তাই আগে তৈরি বিল আবার হয় না। যোগদানের মাসের ভাড়া: {PRORATION_MODE_LABELS[(settings.prorationMode ?? (settings.prorationEnabled ? "prorate" : "full")) as ProrationMode]}
          </span>
        </p>
      )}
      <Card>
        <CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">সব (বাতিল ছাড়া)</SelectItem>{Object.entries(BILL_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <SearchInput value={search} onChange={setSearch} />
            <Button variant="outline" onClick={exportRows} disabled={list.items.length === 0}>এক্সেল (এই পৃষ্ঠা)</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>বিল নং</TableHead><TableHead>মাস</TableHead><TableHead>সদস্য</TableHead><TableHead>মেস / রুম / সিট</TableHead>
              <TableHead className="text-right">ভাড়া ও চার্জ</TableHead><TableHead className="text-right">পূর্বের বকেয়া</TableHead><TableHead className="text-right">মোট প্রদেয়</TableHead>
              <TableHead className="text-right">পরিশোধ</TableHead><TableHead className="text-right">বাকি</TableHead><TableHead>অবস্থা</TableHead><TableHead className="text-right">কাজ</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableState colSpan={11} loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText="এই মাসের কোনো বিল নেই" />
              {!list.loading && list.items.map((b) => (
                <TableRow key={b._id} className={b.status === "cancelled" ? "opacity-60" : ""}>
                  <TableCell className="font-mono text-xs">{b.billNo}</TableCell>
                  <TableCell>{periodName(b.period)}{b.source === "auto" && <p className="text-[11px] text-muted-foreground">স্বয়ংক্রিয়</p>}{b.source === "admission" && <p className="text-[11px] text-muted-foreground">ভর্তি</p>}</TableCell>
                  <TableCell><button className="text-left hover:underline" onClick={() => navigate(`/mess/members/${b.membershipId}`)}><p className="font-medium">{b.studentId?.name}</p><p className="text-xs text-muted-foreground">{b.studentId?.registrationId}</p></button></TableCell>
                  <TableCell className="text-sm">{refName(b.messId)}<p className="text-xs text-muted-foreground">{refName(b.roomId)} / {refName(b.seatId, "seatNumber")}</p></TableCell>
                  <TableCell className="text-right">{tk(b.currentCharges)}{b.adjustment > 0 && <p className="text-xs text-success">সমন্বয় −{tk(b.adjustment)}</p>}</TableCell>
                  <TableCell className="text-right">{tk(b.previousDue)}</TableCell>
                  <TableCell className="text-right">{tk(b.totalPayable)}</TableCell>
                  <TableCell className="text-right">{tk(b.paidAmount)}</TableCell>
                  <TableCell className="text-right">{tk(b.dueAmount)}</TableCell>
                  <TableCell><StatusBadge status={b.status} label={BILL_STATUS_LABELS[b.status]} /></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" className="mr-1" onClick={() => navigate(`/mess/bills/${b._id}/invoice`)} title="ইনভয়েস"><Printer className="h-3.5 w-3.5" /></Button>
                    {canManage && b.status !== "cancelled" && <Button size="sm" variant="outline" className="mr-1" onClick={() => setAdjusting(b)} title="সমন্বয়"><SlidersHorizontal className="h-3.5 w-3.5" /></Button>}
                    {canManage && b.status !== "cancelled" && <Button size="sm" variant="outline" onClick={() => setCancelling(b)} title="বাতিল"><Ban className="h-3.5 w-3.5" /></Button>}
                    <SuperDeleteButton entity="bill" id={b._id} what={`বিল ${b.billNo} — ${b.studentId?.name ?? ""} (${b.period})`} onDeleted={list.reload} className="ml-1" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-3"><Pager meta={list.meta} page={page} onPage={setPage} /></div>
        </CardContent>
      </Card>
      <GenerateDialog open={genOpen} onOpenChange={setGenOpen} onDone={(p) => { setPeriod(p); void list.reload(); }} />
      <ReasonDialog
        open={!!cancelling}
        onOpenChange={(v) => !v && setCancelling(null)}
        title="বিল বাতিল / সংশোধন"
        description={cancelling ? `${cancelling.billNo} (${cancelling.period}) বাতিল হবে। সংশোধনের জন্য বাতিলের পর একই মাসের বিল আবার তৈরি করুন। পেমেন্ট মুছবে না — সদস্যের হিসাবে থাকবে।` : undefined}
        destructive
        onConfirm={async (reason) => { await api.post(`/mess/bills/${cancelling!._id}/cancel`, { reason }); toast.success("বিল বাতিল হয়েছে"); await list.reload(); }}
      />
      <AdjustDialog bill={adjusting} onOpenChange={(v) => !v && setAdjusting(null)} onDone={list.reload} />
    </MessPage>
  );
}

interface Preview { period: string; eligible: number; alreadyBilled: number; notBilledByRule?: number; toCreate: number }
interface GenerateResult { eligible: number; created: number; skippedExisting: number; skipped?: { membershipNo?: string; reason: string }[]; failed: { membershipNo?: string; reason: string }[] }

function GenerateDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: (period: string) => void }) {
  const { messId: scopeMess } = useMessScope();
  const [period, setPeriod] = useState(currentPeriod());
  const [messId, setMessId] = useState("all");
  const [charges, setCharges] = useState<{ label: string; amount: string }[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setPeriod(currentPeriod()); setMessId(scopeMess); setCharges([]); setDueDate(""); setResult(null); } }, [open, scopeMess]);
  useEffect(() => {
    if (!open || !/^\d{4}-\d{2}$/.test(period)) return;
    setPreview(null);
    api.get<Preview>(`/mess/bills/generation-preview${qs({ period, messId })}`).then(setPreview).catch((err) => toast.error(errMsg(err)));
  }, [open, period, messId]);
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post<GenerateResult>("/mess/bills/generate", {
        period,
        messId: messId !== "all" ? messId : undefined,
        additionalCharges: charges.filter((c) => c.label && Number(c.amount) > 0).map((c) => ({ label: c.label, amount: Number(c.amount) })),
        dueDate: dueDate || undefined,
      });
      setResult(res);
      onDone(period);
      toast.success(`${res.created}টি বিল তৈরি হয়েছে`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>মাসিক বিল তৈরি (বাল্ক)</DialogTitle>
          <DialogDescription>সক্রিয়/ছুটিতে/নোটিশ দেওয়া সদস্যদের বিল তৈরি হবে। একই মাসের বিল আগে থাকলে আবার তৈরি হবে না।</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-2 text-sm">
            <p>যোগ্য সদস্য: <b>{result.eligible}</b></p>
            <p className="text-success">নতুন বিল: <b>{result.created}</b></p>
            <p className="text-muted-foreground">আগেই ছিল (বাদ): <b>{result.skippedExisting}</b></p>
            {(result.skipped?.length ?? 0) > 0 && (
              <div className="text-muted-foreground"><p>নিয়ম অনুযায়ী বিল হয়নি: {result.skipped!.length}</p>{result.skipped!.slice(0, 10).map((f, i) => <p key={i} className="text-xs">{f.membershipNo}: {f.reason}</p>)}</div>
            )}
            {result.failed.length > 0 && (
              <div className="text-destructive"><p>ব্যর্থ: {result.failed.length}</p>{result.failed.slice(0, 10).map((f, i) => <p key={i} className="text-xs">{f.membershipNo}: {f.reason}</p>)}</div>
            )}
            <DialogFooter><Button onClick={() => onOpenChange(false)}>বন্ধ করুন</Button></DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>বিলের মাস</Label><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>শেষ তারিখ (ঐচ্ছিক)</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label>মেস</Label><MessSelect value={messId} onChange={setMessId} includeAll /></div>
              <div className="space-y-2">
                <Label>সবার জন্য অতিরিক্ত চার্জ (ঐচ্ছিক)</Label>
                {charges.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="বিবরণ (যেমন: বিদ্যুৎ বিল ভাগ)" value={c.label} onChange={(e) => setCharges(charges.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    <Input type="number" min={0} className="w-28" placeholder="৳" value={c.amount} onChange={(e) => setCharges(charges.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                    <Button variant="ghost" size="sm" onClick={() => setCharges(charges.filter((_, j) => j !== i))}>×</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setCharges([...charges, { label: "", amount: "" }])}>+ চার্জ যোগ</Button>
              </div>
              <div className="rounded-md border p-3 text-sm bg-muted/30">
                {preview ? (
                  <>যোগ্য সদস্য: <b>{preview.eligible}</b> • আগেই বিল আছে: <b>{preview.alreadyBilled}</b>{preview.notBilledByRule ? <> • নিয়ম অনুযায়ী বাদ: <b>{preview.notBilledByRule}</b></> : null} • নতুন তৈরি হবে: <b className="text-primary">{preview.toCreate}</b></>
                ) : "হিসাব করা হচ্ছে..."}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
              <Button disabled={busy || !preview || preview.toCreate === 0} onClick={submit}>{busy ? "তৈরি হচ্ছে..." : "নিশ্চিত করুন"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ bill, onOpenChange, onDone }: { bill: Bill | null; onOpenChange: (v: boolean) => void; onDone: () => Promise<void> }) {
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (bill) { setAmount(String(bill.adjustment ?? 0)); setReason(bill.adjustmentReason ?? ""); } }, [bill]);
  const submit = async () => {
    if (!bill) return;
    if (!reason.trim()) { toast.error("কারণ লিখুন"); return; }
    setBusy(true);
    try {
      await api.post(`/mess/bills/${bill._id}/adjust`, { adjustment: Number(amount) || 0, reason });
      toast.success("সমন্বয় সংরক্ষিত হয়েছে");
      onOpenChange(false);
      await onDone();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  const gross = bill ? bill.items.reduce((s, i) => s + i.amount, 0) : 0;
  return (
    <Dialog open={!!bill} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>বিল সমন্বয় — {bill?.billNo}</DialogTitle><DialogDescription>অনুমোদিত এককালীন ছাড়/সংশোধন। মোট চার্জ {tk(gross)}, মাসিক ছাড় {tk(bill?.discount)}।</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>সমন্বয়ের পরিমাণ (৳)</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>কারণ *</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={submit}>{busy ? "সংরক্ষণ হচ্ছে..." : "নিশ্চিত করুন"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
