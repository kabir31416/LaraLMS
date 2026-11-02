import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BedDouble, Receipt, Printer, Bell, Plus } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import {
  BILL_STATUS_LABELS, COMPLAINT_PRIORITY_LABELS, COMPLAINT_STATUS_LABELS, DEPOSIT_TX_LABELS, DEPOSIT_TX_STATUS_LABELS, errMsg, MEMBERSHIP_STATUS_LABELS,
  NOTICE_TYPE_LABELS, periodName, PURPOSE_LABELS, refName, statusTone, tk, useApiData, type Balance, type Bill, type Complaint, type DepositTx, type Membership,
  type MessNotice, type MessPayment, type Reservation, type Settlement,
} from "@/lib/mess";

interface MyMess {
  current: Membership | null;
  reservation: Reservation | null;
  balances: Omit<Balance, "updatedAt"> | null;
  currentBill: Bill | null;
  memberships: Pick<Membership, "_id" | "membershipNo" | "status" | "joiningDate" | "leftDate" | "messId" | "roomId" | "seatId">[];
  bills: Bill[];
  payments: MessPayment[];
  depositTransactions: DepositTx[];
  settlements: Settlement[];
  notices: MessNotice[];
  complaints: Complaint[];
}

/** Student Portal — the backend scopes every field to the logged-in student's own token; nothing here can request another student's data. */
export default function StudentMess() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload, setData } = useApiData<MyMess>(user?.role === "Student" ? "/mess/portal/me" : null);
  const [complaintOpen, setComplaintOpen] = useState(false);
  if (!user || user.role !== "Student") return <Navigate to="/studentLogin" replace />;

  const markRead = async (n: MessNotice) => {
    if (n.isRead || !data) return;
    try {
      await api.post(`/mess/portal/notices/${n._id}/read`);
      setData({ ...data, notices: data.notices.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)) });
    } catch {
      /* read receipts are best-effort */
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">আমার মেস / হোস্টেল</h1>
          {data?.current && ["approved", "active", "on_leave", "notice_given"].includes(data.current.status) && <Button onClick={() => setComplaintOpen(true)}><Plus className="h-4 w-4 mr-1" />অভিযোগ জানান</Button>}
        </div>
        {loading && !data ? <Skeleton className="h-48" /> : error ? (
          <Card><CardContent className="py-8 text-center space-y-2"><p className="text-destructive">{error}</p><Button variant="outline" onClick={reload}>আবার চেষ্টা করুন</Button></CardContent></Card>
        ) : !data?.current ? (
          <Card><CardContent className="py-10 text-center space-y-2">
            <BedDouble className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">আপনার কোনো মেস সদস্যপদ নেই।</p>
            {data?.reservation && <p className="text-sm">সক্রিয় রিজার্ভেশন: {data.reservation.reservationNo} — {refName(data.reservation.messId)}, রুম {refName(data.reservation.roomId)}, সিট {refName(data.reservation.seatId, "seatNumber")} (মেয়াদ {data.reservation.expiryDate})</p>}
          </CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Fig label="বর্তমান বকেয়া" value={tk(data.balances?.due)} tone={data.balances && data.balances.due > 0 ? "text-destructive" : "text-success"} />
              <Fig label="মোট পরিশোধ" value={tk(data.balances?.totalPaid)} />
              <Fig label="অতিরিক্ত পরিশোধ জমা" value={tk(data.balances?.advance)} tone="text-success" />
              <Fig label="অগ্রিম (জমা / নির্ধারিত)" value={`${tk(data.balances?.depositBalance)} / ${tk(data.balances?.depositRequired)}`} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">বর্তমান সদস্যপদ</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <Row label="অবস্থা"><Badge variant="outline" className={statusTone(data.current.status)}>{MEMBERSHIP_STATUS_LABELS[data.current.status]}</Badge></Row>
                  <Row label="সদস্যপদ নং">{data.current.membershipNo}</Row>
                  <Row label="মেস">{refName(data.current.messId)}</Row>
                  <Row label="রুম / সিট">{refName(data.current.roomId)} / {refName(data.current.seatId, "seatNumber")}</Row>
                  <Row label="মাসিক ভাড়া">{tk(data.current.monthlyRent)}{data.current.discount > 0 ? ` (ছাড় ${tk(data.current.discount)})` : ""}</Row>
                  <Row label="ডাইনিং চার্জ (একবার)">{tk(data.current.diningCharge ?? 0)}{(data.current.balance?.diningDue ?? 0) > 0 ? ` — বাকি ${tk(data.current.balance?.diningDue)}` : ""}</Row>
                  <Row label="এক মাসের অগ্রিম">{tk(data.balances?.depositBalance)} / {tk(data.balances?.depositRequired)} <span className="text-xs text-muted-foreground">(চেক-আউটে সমন্বয়)</span></Row>
                  <Row label="যোগদান">{data.current.joiningDate}</Row>
                  {data.current.leftDate && <Row label="চেক-আউট">{data.current.leftDate}</Row>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">চলতি মাসের ভাড়ার বিল</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  {!data.currentBill ? <p className="text-muted-foreground">কোনো বিল নেই</p> : (
                    <>
                      <Row label="মাস">{periodName(data.currentBill.period)}</Row>
                      <Row label="এই মাসের চার্জ">{tk(data.currentBill.currentCharges)}</Row>
                      <Row label="পূর্বের বকেয়া">{tk(Math.max(0, data.currentBill.previousDue))}</Row>
                      <Row label="মোট প্রদেয় (বিল তৈরির সময়)">{tk(data.currentBill.totalPayable)}</Row>
                      <Row label="এই বিলের বাকি">{tk(data.currentBill.dueAmount)}</Row>
                      <Row label="মোট অবশিষ্ট বকেয়া (আজ)"><b className={data.balances && data.balances.due > 0 ? "text-destructive" : "text-success"}>{tk(data.balances?.due)}</b></Row>
                      <Row label="শেষ তারিখ">{data.currentBill.dueDate}</Row>
                      <Row label="অবস্থা"><Badge variant="outline" className={statusTone(data.currentBill.status)}>{BILL_STATUS_LABELS[data.currentBill.status]}</Badge></Row>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/mess/bills/${data.currentBill!._id}/invoice`)}><Printer className="h-3.5 w-3.5 mr-1" />ইনভয়েস</Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="notices">
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="notices">নোটিশ ({data.notices.filter((n) => !n.isRead).length} নতুন)</TabsTrigger>
                <TabsTrigger value="payments">পেমেন্ট</TabsTrigger>
                <TabsTrigger value="bills">বিল</TabsTrigger>
                <TabsTrigger value="deposit">জামানত</TabsTrigger>
                <TabsTrigger value="complaints">অভিযোগ</TabsTrigger>
                <TabsTrigger value="history">সদস্যপদের ইতিহাস</TabsTrigger>
              </TabsList>
              <TabsContent value="notices" className="space-y-2">
                {data.notices.length === 0 ? <Card><CardContent className="py-6 text-center text-muted-foreground">কোনো নোটিশ নেই</CardContent></Card> : data.notices.map((n) => (
                  <Card key={n._id} className={n.isRead ? "" : "border-primary/40"} onClick={() => markRead(n)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2"><CardTitle className="text-base flex items-center gap-2">{!n.isRead && <Bell className="h-4 w-4 text-primary" />}{n.title}</CardTitle><Badge variant="outline">{NOTICE_TYPE_LABELS[n.type]}</Badge></div>
                      <p className="text-xs text-muted-foreground">{n.publishDate}{n.expiryDate ? ` • মেয়াদ ${n.expiryDate}` : ""}</p>
                    </CardHeader>
                    <CardContent><p className="text-sm whitespace-pre-wrap">{n.body}</p>{!n.isRead && <p className="text-xs text-primary mt-1">পড়া হয়েছে চিহ্নিত করতে ক্লিক করুন</p>}</CardContent>
                  </Card>
                ))}
              </TabsContent>
              <TabsContent value="payments">
                <Card><CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>রসিদ</TableHead><TableHead>তারিখ</TableHead><TableHead>ধরন</TableHead><TableHead>পদ্ধতি</TableHead><TableHead className="text-right">পরিমাণ</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {data.payments.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">কোনো পেমেন্ট নেই</TableCell></TableRow> : data.payments.map((p) => (
                        <TableRow key={p._id}><TableCell className="font-mono text-xs">{p.receiptNo}</TableCell><TableCell>{p.date}</TableCell><TableCell>{PURPOSE_LABELS[p.purpose]}{p.billingMonth && <p className="text-[11px] text-muted-foreground">{periodName(p.billingMonth)}</p>}</TableCell><TableCell>{p.method}</TableCell><TableCell className="text-right">{tk(p.amount)}</TableCell>
                          <TableCell><Button size="sm" variant="ghost" onClick={() => navigate(`/mess/payments/${p._id}/receipt`)}><Receipt className="h-3.5 w-3.5" /></Button></TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent></Card>
              </TabsContent>
              <TabsContent value="bills">
                <Card><CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>মাস</TableHead><TableHead className="text-right">চার্জ</TableHead><TableHead className="text-right">পরিশোধ</TableHead><TableHead className="text-right">বাকি</TableHead><TableHead>অবস্থা</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {data.bills.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">কোনো বিল নেই</TableCell></TableRow> : data.bills.map((b) => (
                        <TableRow key={b._id}><TableCell>{b.period}</TableCell><TableCell className="text-right">{tk(b.currentCharges)}</TableCell><TableCell className="text-right">{tk(b.paidAmount)}</TableCell><TableCell className="text-right">{tk(b.dueAmount)}</TableCell>
                          <TableCell><Badge variant="outline" className={statusTone(b.status)}>{BILL_STATUS_LABELS[b.status]}</Badge></TableCell>
                          <TableCell><Button size="sm" variant="ghost" onClick={() => navigate(`/mess/bills/${b._id}/invoice`)}><Printer className="h-3.5 w-3.5" /></Button></TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent></Card>
              </TabsContent>
              <TabsContent value="deposit">
                <Card><CardContent className="space-y-2 py-4 text-sm">
                  <p>নির্ধারিত জামানত: <b>{tk(data.balances?.depositRequired)}</b> • জমা দিয়েছেন: <b>{tk(data.balances?.depositCollected)}</b> • বর্তমান ব্যালেন্স: <b>{tk(data.balances?.depositBalance)}</b></p>
                  {data.depositTransactions.map((t) => <p key={t._id} className="text-xs text-muted-foreground border-b pb-1">{t.date} • {DEPOSIT_TX_LABELS[t.type]} • {tk(t.amount)} • {DEPOSIT_TX_STATUS_LABELS[t.status]}{t.reason ? ` — ${t.reason}` : ""}</p>)}
                  {data.settlements.map((s) => (
                    <div key={s._id} className="rounded-md border p-2">
                      <p className="font-medium">চূড়ান্ত নিষ্পত্তি {s.settlementNo} — ফেরতযোগ্য {tk(s.refundableAmount)}</p>
                      <Button size="sm" variant="link" className="px-0" onClick={() => navigate(`/mess/settlements/${s._id}/print`)}>বিস্তারিত / প্রিন্ট</Button>
                    </div>
                  ))}
                </CardContent></Card>
              </TabsContent>
              <TabsContent value="complaints" className="space-y-2">
                {data.complaints.length === 0 ? <Card><CardContent className="py-6 text-center text-muted-foreground">কোনো অভিযোগ নেই</CardContent></Card> : data.complaints.map((c) => (
                  <Card key={c._id}><CardContent className="py-3 text-sm space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{c.ticketNo} — {c.title}</p><Badge variant="outline" className={statusTone(c.status)}>{COMPLAINT_STATUS_LABELS[c.status]}</Badge></div>
                    <p className="text-xs text-muted-foreground">{c.category} • {c.date} • {COMPLAINT_PRIORITY_LABELS[c.priority]}</p>
                    {c.history?.length > 1 && <p className="text-xs">সর্বশেষ আপডেট: {c.history[c.history.length - 1].note || COMPLAINT_STATUS_LABELS[c.history[c.history.length - 1].status as Complaint["status"]]}</p>}
                  </CardContent></Card>
                ))}
              </TabsContent>
              <TabsContent value="history">
                <Card><CardContent className="space-y-2 py-4 text-sm">
                  {data.memberships.map((m) => <p key={m._id} className="border-b pb-1">{m.membershipNo} • {refName(m.messId)} • রুম {refName(m.roomId)} / সিট {refName(m.seatId, "seatNumber")} • {m.joiningDate} → {m.leftDate || "—"} • {MEMBERSHIP_STATUS_LABELS[m.status]}</p>)}
                  {(data.current.seatHistory ?? []).length > 0 && <p className="text-xs text-muted-foreground pt-2">বর্তমান সদস্যপদের সিট পরিবর্তন: {(data.current.seatHistory ?? []).map((h) => `${refName(h.roomId)}/${refName(h.seatId, "seatNumber")} (${h.fromDate}→${h.toDate || "বর্তমান"})`).join(", ")}</p>}
                </CardContent></Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
      <ComplaintDialog open={complaintOpen} onOpenChange={setComplaintOpen} onSaved={reload} />
    </DashboardLayout>
  );
}

function Fig({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`text-lg font-bold ${tone ?? ""}`}>{value}</p></CardContent></Card>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-b border-dashed pb-1"><span className="text-muted-foreground">{label}</span><span className="text-right">{children}</span></div>;
}

function ComplaintDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => Promise<void> }) {
  const { data: options } = useApiData<{ complaintCategories: string[] }>(open ? "/mess/portal/options" : null);
  const [f, setF] = useState({ category: "", title: "", description: "", priority: "normal" as Complaint["priority"] });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ category: "", title: "", description: "", priority: "normal" }); }, [open]);
  const save = async () => {
    if (!f.category || !f.title.trim()) { toast.error("ক্যাটাগরি ও শিরোনাম দিন"); return; }
    setBusy(true);
    try {
      await api.post("/mess/portal/complaints", { ...f, description: f.description || undefined });
      toast.success("অভিযোগ জমা হয়েছে");
      onOpenChange(false);
      await onSaved();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>মেস কর্তৃপক্ষের কাছে অভিযোগ</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>ক্যাটাগরি *</Label><Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger><SelectContent>{(options?.complaintCategories ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>শিরোনাম *</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>বিস্তারিত</Label><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>অগ্রাধিকার</Label><Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as Complaint["priority"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(COMPLAINT_PRIORITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={save}>{busy ? "জমা হচ্ছে..." : "জমা দিন"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
