import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { applyPrintPageSize } from "@/lib/print";
import { BILL_STATUS_LABELS, periodName, PURPOSE_LABELS, refName, tk, useApiData, type Bill, type Institution, type MessPayment, type Settlement, type StudentRef } from "@/lib/mess";

/**
 * Print-ready Mess documents — same approach and look as the existing
 * Payment Receipt page (PaymentReceipt.tsx): a plain route outside
 * DashboardLayout, loaded from the backend by id (so refresh works),
 * institution branding from central Settings, only the toolbar hidden at
 * print time (`.no-print`).
 */
const CELL = "px-2.5 py-1 text-xs";
const HEAD = "h-auto px-2.5 py-1 text-xs";

function PrintFrame({ loading, error, institution, title, docNo, date, cancelled, children }: { loading: boolean; error: string | null; institution?: Institution; title: string; docNo?: string; date?: string; cancelled?: string; children?: React.ReactNode }) {
  const navigate = useNavigate();
  if (loading) return <div className="min-h-screen p-6 max-w-xl mx-auto space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>;
  if (error || !institution) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">{error || "পাওয়া যায়নি"}</p>
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />ফিরে যান</Button>
      </div>
    );
  }
  const showLogo = institution.print?.showLogoOnDocuments !== false && !!institution.logoUrl;
  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="no-print sticky top-0 z-10 border-b bg-background px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />ফিরে যান</Button>
        <Button onClick={() => { applyPrintPageSize(institution.print?.paperSize || "A4"); window.print(); }}><Printer className="h-4 w-4 mr-2" />প্রিন্ট করুন</Button>
      </div>
      <div className="max-w-xl mx-auto p-3 sm:p-6 print:p-0 print:max-w-none">
        <div className="bg-background border rounded-lg p-4 sm:p-6 print:border-none print:rounded-none print:p-0">
          <div className="text-center border-b pb-2 mb-3">
            {showLogo && <img src={institution.logoUrl} alt="" className="h-8 mx-auto object-contain mb-0.5" />}
            <h1 className="text-base font-bold">{institution.name || "কোচিং সেন্টার"}</h1>
            {institution.address && <p className="text-[11px] text-muted-foreground leading-tight">{institution.address}</p>}
            <p className="text-[11px] text-muted-foreground leading-tight">{[institution.phone, institution.email].filter(Boolean).join(" • ")}</p>
          </div>
          <div className="text-center mb-3">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{docNo && <>নং: <span className="font-mono font-semibold text-foreground">{docNo}</span></>}{date && <><span className="mx-1.5">•</span>তারিখ: {date}</>}</p>
          </div>
          {cancelled && (
            <div className="mb-3 rounded-md border-2 border-destructive bg-destructive/10 text-destructive text-center py-2 px-3">
              <p className="text-sm font-bold">{cancelled}</p>
              <p className="text-[11px]">শুধুমাত্র রেকর্ডের জন্য সংরক্ষিত।</p>
            </div>
          )}
          {children}
          <div className="pt-6 flex justify-end">
            <div className="text-center text-[10px]"><div className="border-t border-foreground/40 pt-0.5 w-28">{institution.print?.signatureLabel || "অনুমোদিতকারী"}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex justify-between gap-3 py-0.5 text-xs border-b border-dashed">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono font-medium text-right" : "font-medium text-right"}>{value}</span>
    </div>
  );
}

function StudentSection({ s, mess, room, seat, membershipNo }: { s?: StudentRef; mess?: unknown; room?: unknown; seat?: unknown; membershipNo?: string }) {
  return (
    <section className="mb-3">
      <h3 className="text-xs font-semibold border-b pb-1 mb-1.5">সদস্যের তথ্য</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <Info label="নাম" value={s?.name} />
        <Info label="সিস্টেম আইডি" value={s?.registrationId} mono />
        <Info label="রেজিস্ট্রেশন নম্বর" value={s?.currentRollNumber} mono />
        <Info label="মোবাইল" value={s?.phone} />
        <Info label="সদস্যপদ" value={membershipNo} mono />
        <Info label="মেস" value={refName(mess)} />
        {room ? <Info label="রুম / সিট" value={`${refName(room)} / ${refName(seat, "seatNumber")}`} /> : null}
      </div>
    </section>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <TableRow><TableCell className={`${CELL} text-muted-foreground`}>{label}</TableCell><TableCell className={`${CELL} text-right ${tone ?? ""}`}>{value}</TableCell></TableRow>;
}

type ReceiptData = { payment: MessPayment & { membershipId?: { membershipNo: string; roomId?: { name: string }; seatId?: { seatNumber: string } } }; institution: Institution };

export function MessReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error } = useApiData<ReceiptData>(id ? `/mess/payments/${id}/receipt` : null);
  const p = data?.payment;
  const membership = p && typeof p.membershipId === "object" ? p.membershipId : undefined;
  return (
    <PrintFrame loading={loading} error={error} institution={data?.institution} title="মেস পেমেন্ট রসিদ" docNo={p?.receiptNo} date={p?.date} cancelled={p?.status === "cancelled" ? "এই পেমেন্টটি বাতিল করা হয়েছে" : undefined}>
      {p && (
        <>
          <StudentSection s={p.studentId} mess={p.messId} room={membership?.roomId} seat={membership?.seatId} membershipNo={membership?.membershipNo} />
          <section className="mb-3">
            <h3 className="text-xs font-semibold border-b pb-1 mb-1.5">পেমেন্ট বিবরণ</h3>
            <Table>
              <TableHeader><TableRow><TableHead className={HEAD}>বিবরণ</TableHead><TableHead className={`${HEAD} text-right`}>পরিমাণ</TableHead></TableRow></TableHeader>
              <TableBody>
                <Line label="পেমেন্টের ধরন" value={PURPOSE_LABELS[p.purpose]} />
                {p.billingMonth && <Line label="বিলের মাস" value={periodName(p.billingMonth)} />}
                {p.dueBefore != null && <Line label="পূর্বের বকেয়া (পেমেন্টের আগে)" value={tk(p.dueBefore)} />}
                {p.purpose === "initial" && p.allocation && <Line label="— ডাইনিং চার্জে" value={tk(p.allocation.rent)} />}
                {p.purpose === "initial" && p.allocation && <Line label="— এক মাসের অগ্রিম / জামানতে" value={tk(p.allocation.deposit)} />}
                {typeof p.reservationId === "object" && p.reservationId && <Line label="রিজার্ভেশন" value={p.reservationId.reservationNo} />}
                <Line label="পেমেন্ট পদ্ধতি" value={p.method} />
                {p.reference && <Line label="রেফারেন্স" value={p.reference} />}
                <Line label="গৃহীত অর্থ" value={tk(p.amount)} tone="font-bold" />
              </TableBody>
            </Table>
            {p.balanceAfter && (
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-2 pt-2 border-t text-center">
                <div><p className={`text-sm font-bold ${p.balanceAfter.due > 0 ? "text-destructive" : "text-success"}`}>{tk(p.balanceAfter.due)}</p><p className="text-[10px] text-muted-foreground">অবশিষ্ট বকেয়া</p></div>
                <div><p className="text-sm font-bold text-success">{tk(p.balanceAfter.advance)}</p><p className="text-[10px] text-muted-foreground">অতিরিক্ত পরিশোধ জমা</p></div>
                <div><p className="text-sm font-bold">{tk(p.balanceAfter.depositBalance)}</p><p className="text-[10px] text-muted-foreground">অগ্রিম / জামানত ব্যালেন্স</p></div>
              </div>
            )}
          </section>
          {p.note && <p className="text-xs text-muted-foreground border-t pt-1.5"><span className="font-medium text-foreground">নোট: </span>{p.note}</p>}
          {(p.purpose === "deposit" || (p.allocation?.deposit ?? 0) > 0) && <p className="text-[10px] text-muted-foreground mt-2">এক মাসের অগ্রিম / জামানত ফেরতযোগ্য জমা — মেস সেটিংসের নিয়ম অনুযায়ী মাসিক বিলে বা চেক-আউটের চূড়ান্ত হিসাবে সমন্বয় হবে।</p>}
        </>
      )}
    </PrintFrame>
  );
}

type InvoiceData = { bill: Bill; membership: { membershipNo: string; balance: { due: number; advance: number; depositBalance: number } } | null; institution: Institution };

export function MessInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error } = useApiData<InvoiceData>(id ? `/mess/bills/${id}/invoice` : null);
  const b = data?.bill;
  return (
    <PrintFrame loading={loading} error={error} institution={data?.institution} title={`মেস বিল / ইনভয়েস — ${b?.period ?? ""}`} docNo={b?.billNo} date={b?.issueDate} cancelled={b?.status === "cancelled" ? `এই বিলটি বাতিল করা হয়েছে${b.cancelReason ? ` (${b.cancelReason})` : ""}` : undefined}>
      {b && (
        <>
          <StudentSection s={b.studentId} mess={b.messId} room={b.roomId} seat={b.seatId} membershipNo={data?.membership?.membershipNo} />
          <section className="mb-3">
            <h3 className="text-xs font-semibold border-b pb-1 mb-1.5">বিলের বিবরণ</h3>
            <Table>
              <TableHeader><TableRow><TableHead className={HEAD}>বিবরণ</TableHead><TableHead className={`${HEAD} text-right`}>পরিমাণ</TableHead></TableRow></TableHeader>
              <TableBody>
                {b.items.map((i, idx) => <Line key={idx} label={i.label} value={tk(i.amount)} />)}
                {b.discount > 0 && <Line label="− ছাড়" value={`− ${tk(b.discount)}`} tone="text-success" />}
                {b.adjustment > 0 && <Line label={`− অনুমোদিত সমন্বয়${b.adjustmentReason ? ` (${b.adjustmentReason})` : ""}`} value={`− ${tk(b.adjustment)}`} tone="text-success" />}
                <Line label="এই মাসের চার্জ" value={tk(b.currentCharges)} tone="font-semibold" />
                <Line label={b.previousDue >= 0 ? "+ পূর্বের বকেয়া" : "− পূর্বের অতিরিক্ত পরিশোধ"} value={tk(Math.abs(b.previousDue))} />
                {(b.advanceAdjusted ?? 0) > 0 && <Line label="− এক মাসের অগ্রিম সমন্বয়" value={`− ${tk(b.advanceAdjusted)}`} tone="text-success" />}
                <Line label="মোট প্রদেয়" value={tk(b.totalPayable)} tone="font-bold" />
              </TableBody>
            </Table>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-2 pt-2 border-t text-center">
              <div><p className="text-sm font-bold">{BILL_STATUS_LABELS[b.status]}</p><p className="text-[10px] text-muted-foreground">বিলের অবস্থা</p></div>
              <div><p className="text-sm font-bold">{b.dueDate}</p><p className="text-[10px] text-muted-foreground">পরিশোধের শেষ তারিখ</p></div>
              {data?.membership && <div><p className={`text-sm font-bold ${data.membership.balance.due > 0 ? "text-destructive" : "text-success"}`}>{tk(data.membership.balance.due)}</p><p className="text-[10px] text-muted-foreground">বর্তমান মোট বকেয়া</p></div>}
            </div>
          </section>
          {b.notes && <p className="text-xs text-muted-foreground border-t pt-1.5">নোট: {b.notes}</p>}
          <p className="text-[10px] text-muted-foreground mt-2">জামানত এই বিলের অংশ নয় — আলাদা হিসাবে রাখা হয়।</p>
        </>
      )}
    </PrintFrame>
  );
}

type SettlementData = { settlement: Settlement & { membershipId?: { membershipNo: string; joiningDate: string; roomId?: { name: string }; seatId?: { seatNumber: string } } }; institution: Institution };

export function MessSettlementPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error } = useApiData<SettlementData>(id ? `/mess/settlements/${id}` : null);
  const s = data?.settlement;
  const m = s && typeof s.membershipId === "object" ? s.membershipId : undefined;
  return (
    <PrintFrame loading={loading} error={error} institution={data?.institution} title="মেস চূড়ান্ত নিষ্পত্তি" docNo={s?.settlementNo} date={s?.leavingDate} cancelled={s?.status === "cancelled" ? "এই নিষ্পত্তি বাতিল করা হয়েছে" : s && s.status !== "completed" ? "খসড়া — এখনো সম্পন্ন হয়নি" : undefined}>
      {s && (
        <>
          <StudentSection s={s.studentId} mess={s.messId} room={m?.roomId} seat={m?.seatId} membershipNo={m?.membershipNo} />
          <section className="mb-3">
            <h3 className="text-xs font-semibold border-b pb-1 mb-1.5">হিসাব</h3>
            <Table>
              <TableBody>
                <Line label="যোগদান → ছাড়া" value={`${m?.joiningDate ?? "—"} → ${s.leavingDate}`} />
                <Line label="জামানত ব্যালেন্স" value={tk(s.depositBalance)} />
                <Line label="+ অগ্রিম ব্যালেন্স" value={tk(s.advanceBalance)} />
                <Line label="− বকেয়া" value={tk(s.outstandingDue)} />
                <Line label={`− ক্ষতি/অন্যান্য${s.damageNote ? ` (${s.damageNote})` : ""}`} value={tk(s.damageCharges)} />
                <Line label="= ফেরতযোগ্য" value={tk(s.refundableAmount)} tone="font-bold" />
                <Line label="জামানত থেকে বকেয়ায় সমন্বয়" value={tk(s.depositApplied)} />
                <Line label="জামানত ফেরত" value={tk(s.depositRefund)} />
                <Line label="অগ্রিম ফেরত" value={tk(s.advanceRefund)} />
                {s.remainingDue > 0 && <Line label="শিক্ষার্থীর অবশিষ্ট বকেয়া" value={tk(s.remainingDue)} tone="font-bold text-destructive" />}
                {s.refundMethod && <Line label="ফেরতের পদ্ধতি / তারিখ" value={`${s.refundMethod} • ${s.refundDate ?? ""}`} />}
              </TableBody>
            </Table>
          </section>
        </>
      )}
    </PrintFrame>
  );
}
