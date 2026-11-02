import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, X, Printer } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessPage, useMessScope } from "@/components/mess/MessShell";
import { MethodSelect, Pager, ReasonDialog, SearchInput, StatusBadge, TableState } from "@/components/mess/MessCommon";
import { api } from "@/lib/apiClient";
import {
  DEPOSIT_TX_LABELS, DEPOSIT_TX_STATUS_LABELS, errMsg, qs, refId, refName, SETTLEMENT_STATUS_LABELS, tk, todayISO, usePagedList,
  type DepositTx, type Settlement,
} from "@/lib/mess";
import { MESS_FINANCE_APPROVE, MESS_MEMBERS_MANAGE, MESS_PAYMENTS_COLLECT } from "@/lib/permissions";

export default function MessDeposits() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "transactions";
  return (
    <MessPage title="জামানত ও চূড়ান্ত নিষ্পত্তি" subtitle="জামানত ফেরতযোগ্য অর্থ — আয় হিসেবে গণ্য হয় না। কর্তন/ফেরত অনুমোদন সাপেক্ষে।">
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="transactions">জামানত লেনদেন</TabsTrigger>
          <TabsTrigger value="settlements">চূড়ান্ত নিষ্পত্তি</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions"><TransactionsTab /></TabsContent>
        <TabsContent value="settlements"><SettlementsTab /></TabsContent>
      </Tabs>
    </MessPage>
  );
}

function TransactionsTab() {
  const navigate = useNavigate();
  const { messId, can } = useMessScope();
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId, status, type, search]);
  const list = usePagedList<DepositTx>(`/mess/deposit-transactions${qs({ messId, status, type, search, page, limit: 25 })}`);
  const [rejecting, setRejecting] = useState<DepositTx | null>(null);
  const [cancelling, setCancelling] = useState<DepositTx | null>(null);
  const [paying, setPaying] = useState<DepositTx | null>(null);
  const approve = async (t: DepositTx) => {
    try { await api.post(`/mess/deposit-transactions/${t._id}/approve`); toast.success("অনুমোদিত হয়েছে"); await list.reload(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <Card>
      <CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <SearchInput value={search} onChange={setSearch} />
          <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব ধরন</SelectItem>{Object.entries(DEPOSIT_TX_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব অবস্থা</SelectItem>{Object.entries(DEPOSIT_TX_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        </div>
        <p className="text-xs text-muted-foreground">জামানত সংগ্রহ হয় "পেমেন্ট" থেকে (ধরন: জামানত)। এখানে জামানত থেকে কর্তন, বকেয়ায় সমন্বয় ও ফেরতের অনুরোধ দেখা যায়।</p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>নং</TableHead><TableHead>তারিখ</TableHead><TableHead>সদস্য</TableHead><TableHead>ধরন</TableHead><TableHead>কারণ</TableHead>
            <TableHead className="text-right">পরিমাণ</TableHead><TableHead>অবস্থা</TableHead><TableHead className="text-right">কাজ</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            <TableState colSpan={8} loading={list.loading} error={list.error} empty={list.items.length === 0} />
            {!list.loading && list.items.map((t) => (
              <TableRow key={t._id}>
                <TableCell className="font-mono text-xs">{t.txNo}</TableCell>
                <TableCell>{t.date}</TableCell>
                <TableCell><button className="text-left hover:underline" onClick={() => navigate(`/mess/members/${refId(t.membershipId)}`)}><p className="font-medium">{t.studentId?.name}</p><p className="text-xs text-muted-foreground">{typeof t.membershipId === "object" ? t.membershipId.membershipNo : ""} • {refName(t.messId)}</p></button></TableCell>
                <TableCell className="text-sm">{DEPOSIT_TX_LABELS[t.type]}{t.settlementId && <p className="text-xs text-muted-foreground">নিষ্পত্তি থেকে</p>}</TableCell>
                <TableCell className="text-sm">{t.reason || "—"}{t.rejectedReason && <p className="text-xs text-destructive">{t.rejectedReason}</p>}{t.method && <p className="text-xs text-muted-foreground">{t.method}{t.reference ? ` • ${t.reference}` : ""}</p>}</TableCell>
                <TableCell className="text-right font-medium">{tk(t.amount)}</TableCell>
                <TableCell><StatusBadge status={t.status} label={DEPOSIT_TX_STATUS_LABELS[t.status]} /></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {t.status === "pending" && can(MESS_FINANCE_APPROVE) && <>
                    <Button size="sm" variant="outline" className="mr-1" onClick={() => approve(t)} title="অনুমোদন"><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline" className="mr-1" onClick={() => setRejecting(t)} title="প্রত্যাখ্যান"><X className="h-3.5 w-3.5" /></Button>
                  </>}
                  {t.type === "refund" && t.status === "approved" && can(MESS_PAYMENTS_COLLECT) && <Button size="sm" className="mr-1" onClick={() => setPaying(t)}>ফেরত পরিশোধ</Button>}
                  {!t.settlementId && t.status === "approved" && can(MESS_FINANCE_APPROVE) && <Button size="sm" variant="outline" onClick={() => setCancelling(t)}>রিভার্স</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-3"><Pager meta={list.meta} page={page} onPage={setPage} /></div>
      </CardContent>
      <ReasonDialog open={!!rejecting} onOpenChange={(v) => !v && setRejecting(null)} title="অনুরোধ প্রত্যাখ্যান" destructive onConfirm={async (reason) => { await api.post(`/mess/deposit-transactions/${rejecting!._id}/reject`, { reason }); toast.success("প্রত্যাখ্যাত"); await list.reload(); }} />
      <ReasonDialog open={!!cancelling} onOpenChange={(v) => !v && setCancelling(null)} title="লেনদেন রিভার্স" description="অনুমোদিত কর্তন/সমন্বয় বাতিল হবে এবং জামানত ব্যালেন্স পুনরায় হিসাব হবে।" destructive onConfirm={async (reason) => { await api.post(`/mess/deposit-transactions/${cancelling!._id}/cancel`, { reason }); toast.success("রিভার্স হয়েছে"); await list.reload(); }} />
      <PayoutDialog
        title="জামানত ফেরত পরিশোধ"
        description={paying ? `${paying.studentId?.name} — ${tk(paying.amount)}` : ""}
        open={!!paying}
        onOpenChange={(v) => !v && setPaying(null)}
        onSubmit={async ({ method, date, reference }) => { await api.post(`/mess/deposit-transactions/${paying!._id}/complete-refund`, { method, date, reference: reference || undefined }); toast.success("ফেরত পরিশোধ সম্পন্ন"); await list.reload(); }}
      />
    </Card>
  );
}

function SettlementsTab() {
  const navigate = useNavigate();
  const { messId, can } = useMessScope();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId, status, search]);
  const list = usePagedList<Settlement>(`/mess/settlements${qs({ messId, status, search, page, limit: 25 })}`);
  const [completing, setCompleting] = useState<Settlement | null>(null);
  const [cancelling, setCancelling] = useState<Settlement | null>(null);
  const approve = async (s: Settlement) => {
    try { await api.post(`/mess/settlements/${s._id}/approve`); toast.success("নিষ্পত্তি অনুমোদিত (সর্বশেষ হিসাব অনুযায়ী পুনর্গণনা হয়েছে)"); await list.reload(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <Card>
      <CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SearchInput value={search} onChange={setSearch} />
          <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব অবস্থা</SelectItem>{Object.entries(SETTLEMENT_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        </div>
        <p className="text-xs text-muted-foreground">নতুন নিষ্পত্তি শুরু করতে সদস্যের প্রোফাইল → "আরও কাজ" → "ছেড়ে যাওয়া — চূড়ান্ত নিষ্পত্তি"।</p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>নং</TableHead><TableHead>সদস্য</TableHead><TableHead>ছাড়ার তারিখ</TableHead><TableHead className="text-right">জামানত</TableHead><TableHead className="text-right">অগ্রিম</TableHead>
            <TableHead className="text-right">বকেয়া</TableHead><TableHead className="text-right">ক্ষতি</TableHead><TableHead className="text-right">ফেরতযোগ্য</TableHead><TableHead>অবস্থা</TableHead><TableHead className="text-right">কাজ</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            <TableState colSpan={10} loading={list.loading} error={list.error} empty={list.items.length === 0} />
            {!list.loading && list.items.map((s) => (
              <TableRow key={s._id}>
                <TableCell className="font-mono text-xs">{s.settlementNo}</TableCell>
                <TableCell><button className="text-left hover:underline" onClick={() => navigate(`/mess/members/${refId(s.membershipId)}`)}><p className="font-medium">{s.studentId?.name}</p><p className="text-xs text-muted-foreground">{refName(s.messId)}</p></button></TableCell>
                <TableCell>{s.leavingDate}</TableCell>
                <TableCell className="text-right">{tk(s.depositBalance)}</TableCell>
                <TableCell className="text-right">{tk(s.advanceBalance)}</TableCell>
                <TableCell className="text-right">{tk(s.outstandingDue)}</TableCell>
                <TableCell className="text-right">{tk(s.damageCharges)}</TableCell>
                <TableCell className={`text-right font-semibold ${s.refundableAmount < 0 ? "text-destructive" : "text-success"}`}>{tk(s.refundableAmount)}</TableCell>
                <TableCell><StatusBadge status={s.status} label={SETTLEMENT_STATUS_LABELS[s.status]} /></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="outline" className="mr-1" onClick={() => navigate(`/mess/settlements/${s._id}/print`)}><Printer className="h-3.5 w-3.5" /></Button>
                  {s.status === "pending" && can(MESS_FINANCE_APPROVE) && <Button size="sm" variant="outline" className="mr-1" onClick={() => approve(s)}>অনুমোদন</Button>}
                  {s.status === "approved" && can(MESS_FINANCE_APPROVE) && <Button size="sm" className="mr-1" onClick={() => setCompleting(s)}>সম্পন্ন করুন</Button>}
                  {(s.status === "pending" || s.status === "approved") && (can(MESS_MEMBERS_MANAGE) || can(MESS_FINANCE_APPROVE)) && <Button size="sm" variant="outline" onClick={() => setCancelling(s)}>বাতিল</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-3"><Pager meta={list.meta} page={page} onPage={setPage} /></div>
      </CardContent>
      <ReasonDialog open={!!cancelling} onOpenChange={(v) => !v && setCancelling(null)} title="নিষ্পত্তি বাতিল" destructive onConfirm={async (reason) => { await api.post(`/mess/settlements/${cancelling!._id}/cancel`, { reason }); toast.success("নিষ্পত্তি বাতিল"); await list.reload(); }} />
      <PayoutDialog
        title="চূড়ান্ত নিষ্পত্তি সম্পন্ন"
        description={completing ? `${completing.studentId?.name} — জামানত ফেরত ${tk(completing.depositRefund)} + অগ্রিম ফেরত ${tk(completing.advanceRefund)}। সম্পন্ন হলে সদস্যপদ শেষ হবে ও সিট খালি হবে। পরিমাণ সর্বশেষ হিসাব থেকে পুনর্গণনা হবে।` : ""}
        open={!!completing}
        methodOptional={completing ? completing.depositRefund + completing.advanceRefund <= 0 : false}
        onOpenChange={(v) => !v && setCompleting(null)}
        onSubmit={async ({ method, date, reference }) => {
          await api.post(`/mess/settlements/${completing!._id}/complete`, { refundMethod: method || undefined, refundDate: date, refundReference: reference || undefined });
          toast.success("নিষ্পত্তি সম্পন্ন — সদস্যপদ শেষ হয়েছে");
          await list.reload();
        }}
      />
    </Card>
  );
}

function PayoutDialog({ open, onOpenChange, title, description, onSubmit, methodOptional }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; description: string; methodOptional?: boolean; onSubmit: (v: { method: string; date: string; reference: string }) => Promise<void> }) {
  const [method, setMethod] = useState("");
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setMethod(""); setDate(todayISO()); setReference(""); } }, [open]);
  const submit = async () => {
    if (!methodOptional && !method) { toast.error("পদ্ধতি নির্বাচন করুন"); return; }
    setBusy(true);
    try { await onSubmit({ method, date, reference }); onOpenChange(false); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          {!methodOptional && <div className="space-y-1.5"><Label>পরিশোধ পদ্ধতি *</Label><MethodSelect value={method} onChange={setMethod} /></div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>তারিখ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>রেফারেন্স</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={submit}>{busy ? "প্রক্রিয়া হচ্ছে..." : "নিশ্চিত করুন"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
