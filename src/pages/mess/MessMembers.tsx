import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, CalendarClock, Eye, Check, X, Coins, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessPage, MessSelect, useMessScope } from "@/components/mess/MessShell";
import { AttachmentInput, InitialChargesFields, Pager, ReasonDialog, ReceivePaymentDialog, SearchInput, SeatPicker, StatusBadge, StudentPicker, TableState, type InitialChargesValue, type PickedStudent } from "@/components/mess/MessCommon";
import { api } from "@/lib/apiClient";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import {
  effectiveProration, errMsg, MEMBERSHIP_STATUS_LABELS, newIdempotencyKey, previewJoiningCharge, PRORATION_MODE_LABELS, qs, refName, RESERVATION_STATUS_LABELS, tk, todayISO, usePagedList,
  type InitialChargesSummary, type Membership, type MembershipStatus, type Reservation, type Seat,
} from "@/lib/mess";
import { MESS_BILLING_MANAGE, MESS_MEMBERS_APPROVE, MESS_MEMBERS_EDIT_DATES, MESS_MEMBERS_MANAGE, MESS_PAYMENTS_COLLECT } from "@/lib/permissions";

export default function MessMembers() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "members";
  const { can } = useMessScope();
  const [admission, setAdmission] = useState<{ open: boolean; fromReservation: Reservation | null }>({ open: params.get("new") === "1" && can(MESS_MEMBERS_MANAGE), fromReservation: null });
  const [reservationOpen, setReservationOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);
  return (
    <MessPage
      title="মেস সদস্য ও ভর্তি"
      subtitle="বিদ্যমান শিক্ষার্থীদের মেস সদস্যপদ, আবেদন ও সিট রিজার্ভেশন"
      actions={can(MESS_MEMBERS_MANAGE) && (
        <>
          <Button variant="outline" onClick={() => setReservationOpen(true)}><CalendarClock className="h-4 w-4 mr-1" />সিট রিজার্ভ</Button>
          <Button onClick={() => setAdmission({ open: true, fromReservation: null })}><Plus className="h-4 w-4 mr-1" />নতুন ভর্তি</Button>
        </>
      )}
    >
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="members">সদস্য</TabsTrigger>
          <TabsTrigger value="applications">আবেদন (অপেক্ষমাণ)</TabsTrigger>
          <TabsTrigger value="reservations">রিজার্ভেশন</TabsTrigger>
        </TabsList>
        <TabsContent value="members"><MembersTab key={`m${refreshKey}`} /></TabsContent>
        <TabsContent value="applications"><MembersTab key={`a${refreshKey}`} pendingOnly onChanged={refresh} /></TabsContent>
        <TabsContent value="reservations"><ReservationsTab key={`r${refreshKey}`} onConvert={(r) => setAdmission({ open: true, fromReservation: r })} onChanged={refresh} /></TabsContent>
      </Tabs>
      <AdmissionDialog
        open={admission.open}
        fromReservation={admission.fromReservation}
        onOpenChange={(v) => {
          setAdmission({ open: v, fromReservation: v ? admission.fromReservation : null });
          if (!v && params.get("new")) setParams({ tab });
        }}
        onSaved={refresh}
      />
      <ReservationDialog open={reservationOpen} onOpenChange={setReservationOpen} onSaved={() => { refresh(); setParams({ tab: "reservations" }); }} />
    </MessPage>
  );
}

function MembersTab({ pendingOnly, onChanged }: { pendingOnly?: boolean; onChanged?: () => void }) {
  const navigate = useNavigate();
  const { messId, can } = useMessScope();
  const { courses } = useAcademic();
  const { batches } = useBatches();
  const [status, setStatus] = useState(pendingOnly ? "pending" : "active,on_leave,notice_given,approved");
  const [search, setSearch] = useState("");
  const [courseId, setCourseId] = useState("all");
  const [batchId, setBatchId] = useState("all");
  const [hasDue, setHasDue] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status, search, courseId, batchId, hasDue, messId]);
  const list = usePagedList<Membership>(`/mess/memberships${qs({ messId, status, search, courseId, batchId, hasDue: hasDue || undefined, page, limit: 25 })}`);
  const [rejecting, setRejecting] = useState<Membership | null>(null);
  const [payFor, setPayFor] = useState<Membership | null>(null);

  const approve = async (m: Membership) => {
    try {
      await api.post(`/mess/memberships/${m._id}/approve`, {});
      toast.success("আবেদন অনুমোদিত — সিট সংরক্ষিত হয়েছে");
      await list.reload();
      onChanged?.();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="নাম, রেজি. নং, মোবাইল, অভিভাবকের মোবাইল" className="lg:col-span-2" />
          {!pendingOnly && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active,on_leave,notice_given,approved">চলমান সদস্য</SelectItem>
                {(Object.keys(MEMBERSHIP_STATUS_LABELS) as MembershipStatus[]).map((s) => <SelectItem key={s} value={s}>{MEMBERSHIP_STATUS_LABELS[s]}</SelectItem>)}
                <SelectItem value="pending,approved,active,on_leave,notice_given,left,cancelled">সব (ইতিহাসসহ)</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={courseId} onValueChange={(v) => { setCourseId(v); setBatchId("all"); }}>
            <SelectTrigger><SelectValue placeholder="কোর্স" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সব কোর্স</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger><SelectValue placeholder="ব্যাচ" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সব ব্যাচ</SelectItem>{batches.filter((b) => courseId === "all" || b.courseId === courseId).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          {!pendingOnly && <label className="flex items-center gap-2 text-sm"><Checkbox checked={hasDue} onCheckedChange={(v) => setHasDue(v === true)} />শুধু বকেয়া আছে</label>}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>শিক্ষার্থী</TableHead><TableHead>কোর্স / ব্যাচ</TableHead><TableHead>মেস / রুম / সিট</TableHead><TableHead>যোগদান</TableHead>
            <TableHead className="text-right">মাসিক চার্জ</TableHead><TableHead className="text-right">বকেয়া</TableHead><TableHead className="text-right">অগ্রিম/জামানত</TableHead><TableHead>অবস্থা</TableHead><TableHead className="text-right">কাজ</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            <TableState colSpan={9} loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText={pendingOnly ? "কোনো অপেক্ষমাণ আবেদন নেই" : "কোনো সদস্য নেই"} />
            {!list.loading && list.items.map((m) => (
              <TableRow key={m._id} className="cursor-pointer" onClick={() => navigate(`/mess/members/${m._id}`)}>
                <TableCell>
                  <p className="font-medium">{m.studentId?.name}</p>
                  <p className="text-xs text-muted-foreground">{m.studentId?.registrationId}{m.studentId?.currentRollNumber ? ` / ${m.studentId.currentRollNumber}` : ""} • {m.studentId?.phone}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{m.membershipNo}</p>
                </TableCell>
                <TableCell className="text-sm">{m.studentId?.course || "—"}<p className="text-xs text-muted-foreground">{refName(m.studentId?.currentBatchId)}</p></TableCell>
                <TableCell className="text-sm">{refName(m.messId)}<p className="text-xs text-muted-foreground">রুম {refName(m.roomId)} • সিট {refName(m.seatId, "seatNumber")}</p></TableCell>
                <TableCell className="text-sm">{m.joiningDate}{m.leftDate && <p className="text-xs text-muted-foreground">চেক-আউট: {m.leftDate}</p>}</TableCell>
                <TableCell className="text-right">{tk(m.monthlyRent)}</TableCell>
                <TableCell className={`text-right ${m.balance?.due > 0 ? "text-destructive font-medium" : ""}`}>{tk(m.balance?.due)}{m.balance?.advance > 0 && <p className="text-xs text-success">অগ্রিম {tk(m.balance.advance)}</p>}</TableCell>
                <TableCell className="text-right">{tk(m.balance?.depositBalance)}<p className="text-xs text-muted-foreground">/ {tk(m.securityDeposit)}</p></TableCell>
                <TableCell><StatusBadge status={m.status} label={MEMBERSHIP_STATUS_LABELS[m.status]} /></TableCell>
                <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  {m.status === "pending" && can(MESS_MEMBERS_APPROVE) && (
                    <>
                      <Button size="sm" variant="outline" className="mr-1" onClick={() => approve(m)} title="অনুমোদন"><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" className="mr-1" onClick={() => setRejecting(m)} title="প্রত্যাখ্যান"><X className="h-3.5 w-3.5" /></Button>
                    </>
                  )}
                  {m.status !== "pending" && m.status !== "cancelled" && can(MESS_PAYMENTS_COLLECT) && (
                    <Button size="sm" variant="outline" className="mr-1" onClick={() => setPayFor(m)} title="পেমেন্ট"><Coins className="h-3.5 w-3.5" /></Button>
                  )}
                  <Button size="sm" variant="outline" className="mr-1" onClick={() => navigate(`/mess/members/${m._id}`)} title="প্রোফাইল"><Eye className="h-3.5 w-3.5" /></Button>
                  {["approved", "active", "on_leave", "notice_given"].includes(m.status) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="sm" variant="outline" aria-label="আরও কাজ"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {can(MESS_MEMBERS_EDIT_DATES) && <DropdownMenuItem onClick={() => navigate(`/mess/members/${m._id}?action=joining`)}>যোগদানের তারিখ সংশোধন</DropdownMenuItem>}
                        {can(MESS_MEMBERS_MANAGE) && <DropdownMenuItem onClick={() => navigate(`/mess/members/${m._id}?action=transfer`)}>মেস / রুম / সিট পরিবর্তন</DropdownMenuItem>}
                        {m.status !== "approved" && can(MESS_BILLING_MANAGE) && <DropdownMenuItem onClick={() => navigate(`/mess/members/${m._id}?action=bill`)}>এই সদস্যের বিল</DropdownMenuItem>}
                        {can(MESS_MEMBERS_MANAGE) && <DropdownMenuItem onClick={() => navigate(`/mess/members/${m._id}?action=checkout`)}>চেক-আউট</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-3"><Pager meta={list.meta} page={page} onPage={setPage} /></div>
      </CardContent>
      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title="আবেদন প্রত্যাখ্যান"
        description={rejecting ? `${rejecting.studentId?.name} — ${rejecting.membershipNo}` : undefined}
        destructive
        onConfirm={async (reason) => {
          await api.post(`/mess/memberships/${rejecting!._id}/reject`, { reason });
          toast.success("আবেদন প্রত্যাখ্যাত হয়েছে");
          await list.reload();
        }}
      />
      <ReceivePaymentDialog
        open={!!payFor}
        onOpenChange={(v) => !v && setPayFor(null)}
        target={payFor ? {
          membershipId: payFor._id,
          label: `${payFor.studentId?.name} — ${payFor.membershipNo}`,
          due: payFor.balance?.due,
          advance: payFor.balance?.advance,
          depositRemaining: Math.max(0, (payFor.securityDeposit ?? 0) - (payFor.balance?.depositCollected ?? 0)),
          allowDeposit: payFor.status !== "left",
        } : null}
        onDone={(id) => { void list.reload(); navigate(`/mess/payments/${id}/receipt`); }}
      />
    </Card>
  );
}

function ReservationsTab({ onConvert, onChanged }: { onConvert: (r: Reservation) => void; onChanged: () => void }) {
  const navigate = useNavigate();
  const { messId, can } = useMessScope();
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status, search, messId]);
  const list = usePagedList<Reservation>(`/mess/reservations${qs({ messId, status, search, page, limit: 25 })}`);
  const [cancelling, setCancelling] = useState<Reservation | null>(null);
  const [payFor, setPayFor] = useState<Reservation | null>(null);
  const expire = async () => {
    try {
      const res = await api.post<{ expired: number }>("/mess/reservations/expire-overdue");
      toast.success(`${res.expired}টি মেয়াদোত্তীর্ণ রিজার্ভেশনের সিট খালি করা হয়েছে`);
      await list.reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-2">
          <SearchInput value={search} onChange={setSearch} className="flex-1" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">সব</SelectItem>{Object.entries(RESERVATION_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          {can(MESS_MEMBERS_MANAGE) && <Button variant="outline" onClick={expire}>মেয়াদোত্তীর্ণ রিজার্ভেশন বাতিল করুন</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>রিজার্ভেশন</TableHead><TableHead>শিক্ষার্থী</TableHead><TableHead>মেস / রুম / সিট</TableHead><TableHead>তারিখ → মেয়াদ</TableHead>
            <TableHead className="text-right">অগ্রিম (নির্ধারিত / জমা)</TableHead><TableHead>অবস্থা</TableHead><TableHead className="text-right">কাজ</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            <TableState colSpan={7} loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText="কোনো রিজার্ভেশন নেই" />
            {!list.loading && list.items.map((r) => (
              <TableRow key={r._id}>
                <TableCell className="font-mono text-xs">{r.reservationNo}</TableCell>
                <TableCell><p className="font-medium">{r.studentId?.name}</p><p className="text-xs text-muted-foreground">{r.studentId?.registrationId} • {r.studentId?.phone}</p></TableCell>
                <TableCell className="text-sm">{refName(r.messId)}<p className="text-xs text-muted-foreground">রুম {refName(r.roomId)} • সিট {refName(r.seatId, "seatNumber")}</p></TableCell>
                <TableCell className="text-sm">{r.reservationDate} → {r.expiryDate}</TableCell>
                <TableCell className="text-right">{tk(r.advanceAmount)} / {tk(r.advancePaid)}</TableCell>
                <TableCell><StatusBadge status={r.status} label={RESERVATION_STATUS_LABELS[r.status]} /></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.status === "active" && can(MESS_PAYMENTS_COLLECT) && <Button size="sm" variant="outline" className="mr-1" onClick={() => setPayFor(r)}>অগ্রিম নিন</Button>}
                  {r.status === "active" && can(MESS_MEMBERS_MANAGE) && <Button size="sm" className="mr-1" onClick={() => onConvert(r)}>ভর্তি করুন</Button>}
                  {r.status === "active" && can(MESS_MEMBERS_MANAGE) && <Button size="sm" variant="outline" onClick={() => setCancelling(r)}>বাতিল</Button>}
                  {r.status === "converted" && r.membershipId && <Button size="sm" variant="outline" onClick={() => navigate(`/mess/members/${r.membershipId}`)}>সদস্যপদ দেখুন</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-3"><Pager meta={list.meta} page={page} onPage={setPage} /></div>
      </CardContent>
      <ReasonDialog
        open={!!cancelling}
        onOpenChange={(v) => !v && setCancelling(null)}
        title="রিজার্ভেশন বাতিল"
        description="সিটটি আবার খালি হবে। জমা দেওয়া অগ্রিম ফেরত দিলে পেমেন্ট তালিকা থেকে সেই পেমেন্ট বাতিল (রিভার্স) করুন।"
        destructive
        onConfirm={async (reason) => {
          await api.post(`/mess/reservations/${cancelling!._id}/cancel`, { reason });
          toast.success("রিজার্ভেশন বাতিল হয়েছে");
          await list.reload();
          onChanged();
        }}
      />
      <ReceivePaymentDialog
        open={!!payFor}
        onOpenChange={(v) => !v && setPayFor(null)}
        target={payFor ? { reservationId: payFor._id, label: `রিজার্ভেশন অগ্রিম — ${payFor.studentId?.name} (${payFor.reservationNo})`, due: 0, advance: payFor.advancePaid, depositRemaining: 0, allowDeposit: false } : null}
        onDone={(id) => { void list.reload(); navigate(`/mess/payments/${id}/receipt`); }}
      />
    </Card>
  );
}

function AdmissionDialog({ open, onOpenChange, fromReservation, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; fromReservation: Reservation | null; onSaved: () => void }) {
  const navigate = useNavigate();
  const { messId: scopeMess, settings, can, messes } = useMessScope();
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [messId, setMessId] = useState("");
  const [seatId, setSeatId] = useState("");
  const [form, setForm] = useState({ joiningDate: todayISO(), expectedLeavingDate: "", monthlyRent: "", discount: "0", ecName: "", ecPhone: "", ecRelation: "", notes: "" });
  const [charges, setCharges] = useState<InitialChargesValue>({ initialDiningCharge: "", advanceDeposit: "", amountPaid: "", method: "", reference: "" });
  const [diningTouched, setDiningTouched] = useState(false);
  const [doc, setDoc] = useState<{ url: string; publicId?: string } | null>(null);
  const [initialStatus, setInitialStatus] = useState<"pending" | "approved" | "active">("pending");
  const [busy, setBusy] = useState(false);
  const keyRef = useRef(newIdempotencyKey());
  const mode = effectiveProration(settings);
  const messDefaults = (id: string) => messes.find((x) => x._id === id);

  useEffect(() => {
    if (!open) return;
    const r = fromReservation;
    const mid = r ? (r.messId?._id ?? "") : scopeMess !== "all" ? scopeMess : settings?.defaultMessId ?? (messes.length === 1 ? messes[0]._id : "");
    const md = messDefaults(mid);
    setStudent(r ? (r.studentId as PickedStudent) : null);
    setMessId(mid);
    setSeatId(r ? (r.seatId?._id ?? "") : "");
    setForm({ joiningDate: todayISO(), expectedLeavingDate: "", monthlyRent: r?.seatId?.monthlyRent ? String(r.seatId.monthlyRent) : md?.defaultDiningCharge != null ? String(md.defaultDiningCharge) : "", discount: "0", ecName: "", ecPhone: "", ecRelation: "", notes: "" });
    setCharges({ initialDiningCharge: "", advanceDeposit: String(md?.defaultDeposit ?? settings?.defaultDeposit ?? 0), amountPaid: "", method: "", reference: "" });
    setDiningTouched(false);
    setDoc(null);
    setInitialStatus(can(MESS_MEMBERS_APPROVE) ? "active" : "pending");
    keyRef.current = newIdempotencyKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fromReservation, scopeMess, settings, can, messes]);

  // The joining month's charge follows the proration rule until the operator types their own figure.
  const rent = Number(form.monthlyRent) || 0;
  const ruleCharge = previewJoiningCharge(rent, form.joiningDate, mode);
  useEffect(() => {
    if (!diningTouched) setCharges((c) => ({ ...c, initialDiningCharge: String(ruleCharge) }));
  }, [ruleCharge, diningTouched]);

  const onSeat = (id: string, seat?: Seat) => {
    setSeatId(id);
    if (seat) setForm((f) => ({ ...f, monthlyRent: String(seat.monthlyRent || messDefaults(messId)?.defaultDiningCharge || settings?.defaultRent || 0) }));
  };
  const onMess = (id: string) => {
    setMessId(id);
    setSeatId("");
    const md = messDefaults(id);
    if (md?.defaultDeposit != null) setCharges((c) => ({ ...c, advanceDeposit: String(md.defaultDeposit) }));
  };

  const submit = async () => {
    if (!student) { toast.error("শিক্ষার্থী নির্বাচন করুন"); return; }
    if (!messId || !seatId) { toast.error("মেস ও সিট নির্বাচন করুন"); return; }
    const paid = can(MESS_PAYMENTS_COLLECT) ? Number(charges.amountPaid) || 0 : 0;
    if (initialStatus === "active" && paid > 0 && !charges.method) { toast.error("পরিশোধের পেমেন্ট পদ্ধতি নির্বাচন করুন"); return; }
    if (busy) return;
    setBusy(true);
    try {
      const m = await api.post<{ _id: string; membershipNo: string; initial?: InitialChargesSummary; initialError?: string }>("/mess/memberships", {
        studentId: student._id,
        messId,
        seatId,
        joiningDate: form.joiningDate,
        expectedLeavingDate: form.expectedLeavingDate || undefined,
        monthlyRent: form.monthlyRent !== "" ? Number(form.monthlyRent) : undefined,
        securityDeposit: charges.advanceDeposit !== "" ? Number(charges.advanceDeposit) : undefined,
        discount: Number(form.discount) || 0,
        emergencyContact: form.ecName || form.ecPhone ? { name: form.ecName || undefined, phone: form.ecPhone || undefined, relation: form.ecRelation || undefined } : undefined,
        notes: form.notes || undefined,
        documents: doc ? [{ label: "সংযুক্ত ডকুমেন্ট", url: doc.url, publicId: doc.publicId }] : undefined,
        initialStatus,
        reservationId: fromReservation?._id,
        ...(initialStatus === "active"
          ? {
              initialDiningCharge: Number(charges.initialDiningCharge) || 0,
              initialPayment: paid > 0 ? { amount: paid, method: charges.method, reference: charges.reference || undefined, idempotencyKey: keyRef.current } : undefined,
            }
          : {}),
      });
      if (m.initialError) toast.warning(`সদস্যপদ ${m.membershipNo} তৈরি হয়েছে, কিন্তু প্রারম্ভিক চার্জ/পেমেন্ট সম্পন্ন হয়নি: ${m.initialError} — প্রোফাইল থেকে সম্পন্ন করুন।`, { duration: 10000 });
      else if (m.initial?.receiptNo) toast.success(`ভর্তি সম্পন্ন — ${m.membershipNo}, রসিদ ${m.initial.receiptNo}, অবশিষ্ট ${tk(m.initial.remainingDue)}`);
      else toast.success(`সদস্যপদ তৈরি হয়েছে — ${m.membershipNo}`);
      onOpenChange(false);
      onSaved();
      navigate(m.initial?.paymentId ? `/mess/payments/${m.initial.paymentId}/receipt` : `/mess/members/${m._id}`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const ruleHint = `নিয়ম: ${PRORATION_MODE_LABELS[mode]} — হিসাব অনুযায়ী ${tk(ruleCharge)}${diningTouched ? " (আপনি পরিবর্তন করেছেন)" : ""}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fromReservation ? `রিজার্ভেশন থেকে ভর্তি — ${fromReservation.reservationNo}` : "মেসে নতুন ভর্তি"}</DialogTitle>
          <DialogDescription>শিক্ষার্থী → মেস → রুম/সিট → মাসিক চার্জ → প্রারম্ভিক চার্জ ও পেমেন্ট → রসিদ</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <section className="space-y-2">
            <Label className="text-sm font-semibold">১. শিক্ষার্থী (বিদ্যমান তালিকা থেকে)</Label>
            {fromReservation ? (
              <div className="rounded-md border p-3 text-sm bg-muted/30">{student?.name} — {student?.registrationId}</div>
            ) : <StudentPicker value={student} onChange={setStudent} />}
          </section>
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>২. মেস *</Label>{fromReservation ? <Input disabled value={refName(fromReservation.messId)} /> : <MessSelect value={messId} onChange={onMess} activeOnly />}</div>
            <div className="space-y-1.5"><Label>৩. রুম / সিট *</Label>{fromReservation ? <Input disabled value={`রুম ${refName(fromReservation.roomId)} • সিট ${refName(fromReservation.seatId, "seatNumber")}`} /> : <SeatPicker messId={messId} value={seatId} onChange={onSeat} />}</div>
          </section>
          <section className="space-y-2">
            <Label className="text-sm font-semibold">৪. যোগদান ও মাসিক চার্জ</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5"><Label>যোগদানের তারিখ *</Label><Input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>মাসিক ডাইনিং চার্জ (৳)</Label><Input type="number" min={0} value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })} placeholder="সিটের চার্জ" /></div>
              <div className="space-y-1.5"><Label>মাসিক ছাড় (৳)</Label><Input type="number" min={0} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>সম্ভাব্য ছাড়ার তারিখ</Label><Input type="date" value={form.expectedLeavingDate} onChange={(e) => setForm({ ...form, expectedLeavingDate: e.target.value })} /></div>
            </div>
          </section>
          <section className="space-y-1.5">
            <Label className="text-sm font-semibold">৫. অবস্থা</Label>
            <Select value={initialStatus} onValueChange={(v) => setInitialStatus(v as typeof initialStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">অপেক্ষমাণ আবেদন (পরে পর্যালোচনা)</SelectItem>
                {can(MESS_MEMBERS_APPROVE) && <SelectItem value="approved">অনুমোদিত (সিট সংরক্ষিত, এখনো ওঠেননি)</SelectItem>}
                {can(MESS_MEMBERS_APPROVE) && <SelectItem value="active">সরাসরি সক্রিয় সদস্য (প্রারম্ভিক পেমেন্টসহ)</SelectItem>}
              </SelectContent>
            </Select>
          </section>
          <section className="space-y-2">
            <Label className="text-sm font-semibold">৬. প্রারম্ভিক চার্জ ও পেমেন্ট</Label>
            {initialStatus === "active" ? (
              <InitialChargesFields
                value={charges}
                onChange={(v) => { if (v.initialDiningCharge !== charges.initialDiningCharge) setDiningTouched(true); setCharges(v); }}
                ruleHint={ruleHint}
                allowPayment={can(MESS_PAYMENTS_COLLECT)}
              />
            ) : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>এক মাসের অগ্রিম / জামানত (৳)</Label><Input type="number" min={0} value={charges.advanceDeposit} onChange={(e) => setCharges({ ...charges, advanceDeposit: e.target.value })} /></div>
                </div>
                <p className="text-xs text-muted-foreground">প্রারম্ভিক ডাইনিং চার্জ ও পেমেন্ট সক্রিয় করার সময় নেওয়া হবে।</p>
              </div>
            )}
          </section>
          <section className="space-y-2">
            <Label className="text-sm font-semibold">জরুরি যোগাযোগ ও ডকুমেন্ট</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input placeholder="নাম" value={form.ecName} onChange={(e) => setForm({ ...form, ecName: e.target.value })} />
              <Input placeholder="মোবাইল" value={form.ecPhone} onChange={(e) => setForm({ ...form, ecPhone: e.target.value })} />
              <Input placeholder="সম্পর্ক" value={form.ecRelation} onChange={(e) => setForm({ ...form, ecRelation: e.target.value })} />
            </div>
            <AttachmentInput value={doc} onChange={setDoc} />
            <Textarea rows={2} placeholder="নোট" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={submit}>{busy ? "সংরক্ষণ হচ্ছে..." : initialStatus === "active" ? "ভর্তি ও পেমেন্ট নিশ্চিত করুন" : "নিশ্চিত করুন"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReservationDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { messId: scopeMess } = useMessScope();
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [messId, setMessId] = useState("");
  const [seatId, setSeatId] = useState("");
  const [form, setForm] = useState({ reservationDate: todayISO(), expiryDate: "", advanceAmount: "0", notes: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setStudent(null); setMessId(scopeMess !== "all" ? scopeMess : ""); setSeatId("");
      setForm({ reservationDate: todayISO(), expiryDate: "", advanceAmount: "0", notes: "" });
    }
  }, [open, scopeMess]);
  const submit = async () => {
    if (!student || !messId || !seatId || !form.expiryDate) { toast.error("শিক্ষার্থী, মেস, সিট ও মেয়াদ দিন"); return; }
    setBusy(true);
    try {
      const r = await api.post<{ reservationNo: string }>("/mess/reservations", { studentId: student._id, messId, seatId, reservationDate: form.reservationDate, expiryDate: form.expiryDate, advanceAmount: Number(form.advanceAmount) || 0, notes: form.notes || undefined });
      toast.success(`সিট রিজার্ভ হয়েছে — ${r.reservationNo}`);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>সিট রিজার্ভেশন</DialogTitle><DialogDescription>মেয়াদ শেষ হলে সিটটি স্বয়ংক্রিয়ভাবে (পরবর্তী লোডে) বা "মেয়াদোত্তীর্ণ রিজার্ভেশন বাতিল করুন" দিয়ে খালি হবে।</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <StudentPicker value={student} onChange={setStudent} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>মেস *</Label><MessSelect value={messId} onChange={(v) => { setMessId(v); setSeatId(""); }} activeOnly /></div>
            <div className="space-y-1.5"><Label>সিট *</Label><SeatPicker messId={messId} value={seatId} onChange={(id) => setSeatId(id)} /></div>
            <div className="space-y-1.5"><Label>রিজার্ভেশনের তারিখ</Label><Input type="date" value={form.reservationDate} onChange={(e) => setForm({ ...form, reservationDate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>মেয়াদ শেষ *</Label><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>নির্ধারিত অগ্রিম (৳)</Label><Input type="number" min={0} value={form.advanceAmount} onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>নোট</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">অগ্রিমের টাকা রিজার্ভেশন তালিকার "অগ্রিম নিন" দিয়ে নিন — রসিদ তৈরি হবে এবং ভর্তি হলে সদস্যের অগ্রিম হিসেবে জমা হবে।</p>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={submit}>{busy ? "সংরক্ষণ হচ্ছে..." : "রিজার্ভ করুন"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
