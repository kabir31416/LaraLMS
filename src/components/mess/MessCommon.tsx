import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Loader2, Paperclip, Search, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { useAcademic } from "@/contexts/AcademicContext";
import {
  currentPeriod,
  errMsg,
  newIdempotencyKey,
  periodName,
  PURPOSE_LABELS,
  recentPeriods,
  qs,
  refName,
  statusTone,
  tk,
  todayISO,
  type PageMeta,
  type Seat,
  type StudentRef,
} from "@/lib/mess";
import { useMessScope } from "./MessShell";

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge variant="outline" className={statusTone(status)}>{label}</Badge>;
}

export function TableState({ colSpan, loading, error, empty, emptyText = "কোনো তথ্য নেই" }: { colSpan: number; loading: boolean; error: string | null; empty: boolean; emptyText?: string }) {
  if (loading) return <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />লোড হচ্ছে...</TableCell></TableRow>;
  if (error) return <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-destructive">{error}</TableCell></TableRow>;
  if (empty) return <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">{emptyText}</TableCell></TableRow>;
  return null;
}

export function Pager({ meta, page, onPage }: { meta: PageMeta | null; page: number; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return meta ? <p className="text-xs text-muted-foreground px-1">মোট {meta.total}টি</p> : null;
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <p className="text-xs text-muted-foreground">মোট {meta.total}টি • পৃষ্ঠা {page}/{meta.totalPages}</p>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/** Debounced search box — the list re-queries the server, never filters a cached page. */
export function SearchInput({ value, onChange, placeholder = "নাম / রেজি. নং / মোবাইল দিয়ে খুঁজুন", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => { if (text !== value) onChange(text); }, 350);
    return () => clearTimeout(t);
  }, [text, value, onChange]);
  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
      <Input className="pl-8" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/** Asks for a reason before an irreversible/financial action; the action button is disabled while it runs (no double submits). */
export function ReasonDialog({
  open, onOpenChange, title, description, confirmLabel = "নিশ্চিত করুন", required = true, destructive, onConfirm,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: React.ReactNode; confirmLabel?: string; required?: boolean; destructive?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setReason(""); }, [open]);
  const submit = async () => {
    if (required && !reason.trim()) { toast.error("কারণ লিখুন"); return; }
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription asChild><div>{description}</div></DialogDescription>}
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>কারণ {required ? "*" : "(ঐচ্ছিক)"}</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button variant={destructive ? "destructive" : "default"} disabled={busy} onClick={submit}>{busy ? "প্রক্রিয়া হচ্ছে..." : confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Active PaymentMethod master data (Settings → Payment Methods), narrowed to the Mess subset when one is configured in Mess Settings. */
export function MethodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { paymentMethods } = useAcademic();
  const { settings } = useMessScope();
  const active = paymentMethods.filter((m) => m.status === "সক্রিয়").map((m) => m.name);
  const allowed = settings?.paymentMethods?.length ? active.filter((m) => settings.paymentMethods.includes(m)) : active;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="পদ্ধতি নির্বাচন করুন" /></SelectTrigger>
      <SelectContent>
        {allowed.length === 0 ? <SelectItem value="__none" disabled>কোনো সক্রিয় পদ্ধতি নেই</SelectItem> : allowed.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export interface PickedStudent extends StudentRef {
  guardian?: { name: string; phone: string; relation: string } | null;
  openMembership?: { membershipNo: string; status: string; messId?: { name: string } } | null;
  activeReservation?: { reservationNo: string; _id: string; seatId: string; messId: string } | null;
}

/** Searches the EXISTING Student database (name, reg. no, system id, phone, guardian phone, course/batch) — Mess never creates students. */
export function StudentPicker({ value, onChange }: { value: PickedStudent | null; onChange: (s: PickedStudent | null) => void }) {
  const { courses } = useAcademic();
  const [search, setSearch] = useState("");
  const [courseId, setCourseId] = useState("all");
  const [results, setResults] = useState<PickedStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    if (value) return;
    if (!search.trim() && courseId === "all") { setResults([]); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await api.get<PickedStudent[]>(`/mess/students/search${qs({ search: search.trim(), courseId })}`);
        if (mine === seq.current) setResults(rows);
      } catch (err) {
        if (mine === seq.current) toast.error(errMsg(err, "শিক্ষার্থী খোঁজা যায়নি"));
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [search, courseId, value]);

  if (value) {
    return (
      <div className="rounded-md border p-3 flex items-start justify-between gap-2 bg-muted/30">
        <div className="text-sm space-y-0.5">
          <p className="font-semibold">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            সিস্টেম আইডি: {value.registrationId}{value.currentRollNumber ? ` • রেজি.: ${value.currentRollNumber}` : ""} • {value.phone}
          </p>
          <p className="text-xs text-muted-foreground">{value.course || "—"} • ব্যাচ: {refName(value.currentBatchId)}{value.guardian ? ` • অভিভাবক: ${value.guardian.phone}` : ""}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}><X className="h-4 w-4" /></Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-2 relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, রেজি. নং, সিস্টেম আইডি, মোবাইল বা অভিভাবকের মোবাইল" />
        </div>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger><SelectValue placeholder="কোর্স" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব কোর্স</SelectItem>
            {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
        {loading ? <p className="p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />খোঁজা হচ্ছে...</p>
          : results.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{search.trim() || courseId !== "all" ? "কোনো শিক্ষার্থী পাওয়া যায়নি" : "খুঁজতে টাইপ করুন"}</p>
          : results.map((s) => {
            const blocked = !!s.openMembership;
            return (
              <button
                type="button"
                key={s._id}
                disabled={blocked}
                onClick={() => onChange(s)}
                className="w-full text-left p-2.5 hover:bg-muted/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <p className="text-sm font-medium">{s.name} <span className="text-xs text-muted-foreground font-normal">({s.registrationId}{s.currentRollNumber ? ` / ${s.currentRollNumber}` : ""})</span></p>
                <p className="text-xs text-muted-foreground">{s.phone} • {s.course || "—"} • {refName(s.currentBatchId)}</p>
                {blocked && <p className="text-xs text-destructive">ইতিমধ্যে মেস সদস্য: {s.openMembership?.membershipNo} ({refName(s.openMembership?.messId)})</p>}
                {s.activeReservation && <p className="text-xs text-warning">সক্রিয় রিজার্ভেশন: {s.activeReservation.reservationNo}</p>}
              </button>
            );
          })}
      </div>
    </div>
  );
}

/** Available seats of one Mess (seats in inactive/maintenance rooms are excluded server-side). */
export function SeatPicker({ messId, value, onChange, includeSeat }: { messId: string; value: string; onChange: (seatId: string, seat?: Seat) => void; includeSeat?: Seat | null }) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!messId || messId === "all") { setSeats([]); return; }
    let cancelled = false;
    setLoading(true);
    api.getWithMeta<Seat[]>(`/mess/seats${qs({ messId, availableOnly: true, limit: 100 })}`)
      .then((res) => { if (!cancelled) setSeats(res.data); })
      .catch((err) => { if (!cancelled) toast.error(errMsg(err, "সিট লোড করা যায়নি")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [messId]);
  const list = includeSeat && !seats.some((s) => s._id === includeSeat._id) ? [includeSeat, ...seats] : seats;
  return (
    <Select value={value} onValueChange={(v) => onChange(v, list.find((s) => s._id === v))} disabled={!messId || messId === "all"}>
      <SelectTrigger><SelectValue placeholder={loading ? "লোড হচ্ছে..." : !messId || messId === "all" ? "আগে মেস নির্বাচন করুন" : "খালি সিট নির্বাচন করুন"} /></SelectTrigger>
      <SelectContent>
        {list.length === 0 ? <SelectItem value="__none" disabled>কোনো খালি সিট নেই</SelectItem> : list.map((s) => (
          <SelectItem key={s._id} value={s._id}>রুম {refName(s.roomId)} • সিট {s.seatNumber}{s.seatType ? ` (${s.seatType})` : ""} • {tk(s.monthlyRent)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Uploads one file through the backend (Cloudinary credentials never reach the browser). */
export function AttachmentInput({ value, onChange }: { value?: { url: string; publicId?: string } | null; onChange: (v: { url: string; publicId?: string; resourceType?: string } | null) => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("ফাইল সর্বোচ্চ ৫MB হতে পারে"); return; }
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      onChange(await api.postForm<{ url: string; publicId: string; resourceType: string }>("/mess/uploads", fd));
      toast.success("ফাইল আপলোড হয়েছে");
    } catch (err) {
      toast.error(errMsg(err, "আপলোড ব্যর্থ হয়েছে"));
    } finally {
      setBusy(false);
    }
  };
  if (value?.url) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <a href={value.url} target="_blank" rel="noreferrer" className="text-primary underline truncate max-w-[220px]"><Paperclip className="h-3.5 w-3.5 inline mr-1" />সংযুক্তি দেখুন</a>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}><X className="h-4 w-4" /></Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
  );
}

/**
 * Receive a Mess payment. One idempotency key per dialog opening: a
 * double-click or a network retry submits the same key, and the backend
 * returns the already-recorded payment instead of creating a second one.
 */
export function ReceivePaymentDialog({
  open, onOpenChange, target, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: { membershipId?: string; reservationId?: string; label: string; due?: number; advance?: number; depositRemaining?: number; allowDeposit?: boolean } | null;
  onDone: (paymentId: string) => void;
}) {
  const [purpose, setPurpose] = useState<"rent" | "deposit">("rent");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [billingMonth, setBillingMonth] = useState(currentPeriod());
  const [busy, setBusy] = useState(false);
  const keyRef = useRef(newIdempotencyKey());
  useEffect(() => {
    if (open) {
      keyRef.current = newIdempotencyKey();
      setPurpose("rent"); setAmount(""); setMethod(""); setDate(todayISO()); setReference(""); setNote(""); setBillingMonth(currentPeriod());
    }
  }, [open]);
  if (!target) return null;
  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) { toast.error("সঠিক পরিমাণ লিখুন"); return; }
    if (!method) { toast.error("পেমেন্ট পদ্ধতি নির্বাচন করুন"); return; }
    if (busy) return;
    setBusy(true);
    try {
      const p = await api.post<{ _id: string; receiptNo: string }>("/mess/payments", {
        membershipId: target.membershipId,
        reservationId: target.reservationId,
        purpose,
        amount: n,
        method,
        date,
        billingMonth: purpose === "rent" && target.membershipId ? billingMonth : undefined,
        reference: reference || undefined,
        note: note || undefined,
        idempotencyKey: keyRef.current,
      });
      toast.success(`পেমেন্ট গৃহীত হয়েছে — রসিদ: ${p.receiptNo}`);
      onOpenChange(false);
      onDone(p._id);
    } catch (err) {
      toast.error(errMsg(err, "পেমেন্ট নেওয়া যায়নি"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>পেমেন্ট গ্রহণ</DialogTitle>
          <DialogDescription>{target.label}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md border p-2"><p className="text-muted-foreground">বকেয়া</p><p className="font-semibold text-destructive">{tk(target.due)}</p></div>
          <div className="rounded-md border p-2"><p className="text-muted-foreground">অগ্রিম</p><p className="font-semibold text-success">{tk(target.advance)}</p></div>
          <div className="rounded-md border p-2"><p className="text-muted-foreground">জামানত বাকি</p><p className="font-semibold">{tk(target.depositRemaining)}</p></div>
        </div>
        <div className="space-y-3">
          {target.allowDeposit !== false && (
            <div className="space-y-1.5">
              <Label>পেমেন্টের ধরন</Label>
              <Select value={purpose} onValueChange={(v) => setPurpose(v as "rent" | "deposit")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">{PURPOSE_LABELS.rent}</SelectItem>
                  <SelectItem value="deposit">{PURPOSE_LABELS.deposit}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">বকেয়ার চেয়ে বেশি পেমেন্ট পরের ভাড়ার জন্য জমা থাকবে। এক মাসের অগ্রিম আলাদা হিসাবে রাখা হয়।</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>পরিমাণ (৳) *</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>তারিখ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>পেমেন্ট পদ্ধতি *</Label><MethodSelect value={method} onChange={setMethod} /></div>
          {purpose === "rent" && target.membershipId && (
            <div className="space-y-1.5">
              <Label>বিলের মাস</Label>
              <Select value={billingMonth} onValueChange={setBillingMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{recentPeriods(12).map((p) => <SelectItem key={p} value={p}>{periodName(p)}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">রসিদে দেখানো হবে। হিসাবে পুরোনো বকেয়া আগে পরিশোধ ধরা হয়।</p>
            </div>
          )}
          <div className="space-y-1.5"><Label>রেফারেন্স (TrxID / স্লিপ নং)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>নোট</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {Number(amount) > 0 && purpose === "rent" && (target.due ?? 0) > 0 && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs">পেমেন্টের পর আনুমানিক বকেয়া: <b>{tk(Math.max(0, (target.due ?? 0) - Number(amount)))}</b> <span className="text-muted-foreground">(চূড়ান্ত হিসাব সার্ভার থেকে)</span></p>
          )}
          <p className="text-[11px] text-muted-foreground">SMS চালু থাকলে শিক্ষার্থীর মোবাইলে পেমেন্ট SMS যাবে। SMS ব্যর্থ হলেও পেমেন্ট বহাল থাকে।</p>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={submit}>{busy ? "সংরক্ষণ হচ্ছে..." : "পেমেন্ট নিশ্চিত করুন"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface InitialChargesValue {
  diningCharge: string;
  advance: string;
  amountPaid: string;
  method: string;
  reference: string;
}

/**
 * Admission charges — one-time DINING CHARGE + ONE-MONTH ADVANCE only.
 * Monthly seat rent is never part of this; it is billed monthly. Display
 * maths only — the backend recomputes and allocates everything.
 */
export function InitialChargesFields({
  value,
  onChange,
  editable = true,
  allowPayment = true,
  note,
}: {
  value: InitialChargesValue;
  onChange: (v: InitialChargesValue) => void;
  /** False when the amounts are already fixed on the membership (edit them from "terms"). */
  editable?: boolean;
  /** False for roles without the payment-collect permission — the backend refuses the payment anyway. */
  allowPayment?: boolean;
  note?: string;
}) {
  const dining = Number(value.diningCharge) || 0;
  const advance = Number(value.advance) || 0;
  const total = dining + advance;
  const paid = allowPayment ? Number(value.amountPaid) || 0 : 0;
  const set = (k: keyof InitialChargesValue, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>ডাইনিং চার্জ — একবারই (৳)</Label>
          <Input type="number" min={0} value={value.diningCharge} disabled={!editable} onChange={(e) => set("diningCharge", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>এক মাসের অগ্রিম (৳)</Label>
          <Input type="number" min={0} value={value.advance} disabled={!editable} onChange={(e) => set("advance", e.target.value)} />
          <p className="text-[11px] text-muted-foreground">জমা থাকে, চেক-আউটে বকেয়া কেটে বাকিটা ফেরত। আয় নয়।</p>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
        <span>ভর্তির সময় মোট প্রদেয়</span>
        <b className="tabular-nums">{tk(total)}</b>
      </div>
      {!allowPayment && <p className="text-xs text-muted-foreground">পেমেন্ট নেওয়ার অনুমতি আপনার নেই — চার্জ যুক্ত হবে, পেমেন্ট হিসাবরক্ষক/অ্যাডমিন নেবেন।</p>}
      {allowPayment && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5"><Label>পরিশোধ (৳)</Label><Input type="number" min={0} value={value.amountPaid} onChange={(e) => set("amountPaid", e.target.value)} placeholder="0" /></div>
        <div className="space-y-1.5"><Label>পেমেন্ট পদ্ধতি</Label><MethodSelect value={value.method} onChange={(v) => set("method", v)} /></div>
        <div className="space-y-1.5"><Label>রেফারেন্স</Label><Input value={value.reference} onChange={(e) => set("reference", e.target.value)} placeholder="TrxID / স্লিপ" /></div>
      </div>}
      <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm">
        <span>অবশিষ্ট বকেয়া</span>
        <b className={`tabular-nums ${total - paid > 0 ? "text-destructive" : "text-success"}`}>{tk(Math.max(0, total - paid))}</b>
      </div>
      <p className="text-[11px] text-muted-foreground">আংশিক পরিশোধ করা যায়। পরিশোধ আগে ডাইনিং চার্জে, তারপর অগ্রিমে ধরা হবে — একটি রসিদ তৈরি হবে।{paid > total && total > 0 ? " অতিরিক্ত অংশ ভাড়ার জন্য জমা থাকবে।" : ""}</p>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
