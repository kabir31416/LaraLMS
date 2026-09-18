import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Printer, Receipt as ReceiptIcon } from "lucide-react";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { applyPrintPageSize } from "@/lib/print";
import { toast } from "sonner";

/**
 * Dedicated, print-ready Payment Receipt page (Coaching Reg No / Roll vs
 * System ID spec §11/§18/§20) — replaces FeeManagement.tsx's old
 * ReceiptDialog, which printed the dialog/modal itself and was fragile
 * (clipped content, dialog chrome bleeding into the printed page). This
 * page is a normal route, deliberately NOT wrapped in DashboardLayout, so
 * the sidebar/navbar never render here at all — nothing needs to be hidden
 * at print time beyond this page's own Back/Print toolbar (`.no-print`,
 * index.css). It loads everything from the backend by paymentId alone
 * (GET /payments/:id/receipt — payment.service.ts's getReceipt), so a
 * browser refresh always works, exactly like any other page.
 *
 * Layout deliberately mirrors the public Marksheet print's look
 * (marksheetExport.ts's printIndividualMarksheet) rather than a narrow
 * "receipt slip" card — a full-width document with a bordered section
 * heading + a two-column info grid for Student Details, and a real table
 * (+ a totals row) for Fee/Payment Details, instead of a boxed card
 * floating on a muted page.
 */

interface ReceiptStudent {
  _id: string;
  registrationId: string;
  currentRollNumber?: string;
  name: string;
  phone: string;
  course?: string;
  guardianName?: string;
  guardianMobile?: string;
  totalFee?: number;
  admissionFee?: number;
  totalCourseFee?: number;
  monthlyFee?: number;
  feeType?: "এককালীন" | "মাসিক";
}

interface ReceiptPayment {
  _id: string;
  receiptNo: string;
  date: string;
  amount: number;
  discount: number;
  fine: number;
  paidAmount: number;
  method: string;
  feeType: string;
  month?: string;
  note?: string;
  previousDue?: number;
  source: "admission" | "regular" | "material";
}

interface ReceiptInstitution {
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  print: {
    signatureLabel: string;
    paperSize: "A4" | "Letter";
    showLogoOnDocuments: boolean;
  };
}

interface ReceiptResponse {
  payment: ReceiptPayment;
  student: ReceiptStudent;
  batchName?: string;
  currentDue?: number;
  institution: ReceiptInstitution;
}

function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

/** One label/value pair in the Student Details grid — blank values never render an empty row (the caller simply omits them). */
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-xs border-b border-dashed">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono font-medium text-right" : "font-medium text-right"}>{value}</span>
    </div>
  );
}

/** One figure in the totals row beneath the fee table — same "big number + small label underneath" shape as the Marksheet print's own `.overall` summary row. */
function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: "destructive" | "success" }) {
  const color = tone === "destructive" ? "text-destructive" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

/** Compact overrides for the shared Table component's fairly generous default padding (p-4 / h-12) — a receipt needs many short rows, not a data-grid's breathing room. */
const CELL = "px-2.5 py-1 text-xs";
const HEAD = "h-auto px-2.5 py-1 text-xs";

export default function PaymentReceipt() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ReceiptResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;
    setLoading(true);
    setError(null);
    api
      .get<ReceiptResponse>(`/payments/${paymentId}/receipt`)
      .then(setData)
      .catch((err) => {
        const message = friendlyError(err, "রসিদ লোড করা যায়নি।");
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [paymentId]);

  const handlePrint = () => {
    if (data) applyPrintPageSize(data.institution.print.paperSize || "A4");
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-3 sm:p-6">
        <div className="max-w-xl mx-auto space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">{error || "রসিদ পাওয়া যায়নি।"}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> ফিরে যান
        </Button>
      </div>
    );
  }

  const { payment, student, batchName, currentDue, institution } = data;
  const showLogo = institution.print.showLogoOnDocuments !== false && !!institution.logoUrl;

  // Historical (as-of-this-payment) figures — derived from this payment's
  // own stored snapshot (previousDue) plus the student's totalFee, never
  // from the student's *live* due/paid (which would drift for an old
  // receipt once later payments are recorded). Payment Transactions remain
  // the sole source of truth — this is pure arithmetic over already-stored
  // fields, never an independent recalculation.
  const totalFee = student.totalFee;
  const totalPaidToDate = totalFee !== undefined && currentDue !== undefined ? totalFee - currentDue : undefined;
  const courseFeeLabel = student.feeType === "মাসিক" ? "মাসিক ফি" : "কোর্স ফি";
  const courseFeeValue = student.feeType === "মাসিক" ? student.monthlyFee : student.totalCourseFee;

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="no-print sticky top-0 z-10 border-b bg-background px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> ফিরে যান
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" /> প্রিন্ট করুন
        </Button>
      </div>

      {/* A generous, full-width document rather than a narrow receipt-slip
          card — matches the public Marksheet print's own layout language
          (see this file's top comment). The muted page background around it
          is purely an on-screen affordance (so the document reads as a
          "sheet of paper"); print:bg-white + print:shadow-none/border-none
          neutralize it so the printed page is a plain white document. */}
      <div className="max-w-xl mx-auto p-3 sm:p-6 print:p-0 print:max-w-none">
        <div id="receipt-print" className="bg-background border rounded-lg p-4 sm:p-6 print:border-none print:rounded-none print:p-0">
          <div className="text-center border-b pb-2 mb-3">
            {showLogo && <img src={institution.logoUrl} alt="" className="h-8 mx-auto object-contain mb-0.5" />}
            <h1 className="text-base font-bold">{institution.name || "কোচিং সেন্টার"}</h1>
            {institution.address && <p className="text-[11px] text-muted-foreground leading-tight">{institution.address}</p>}
            <p className="text-[11px] text-muted-foreground leading-tight">{[institution.phone, institution.email].filter(Boolean).join(" • ")}</p>
            {institution.website && <p className="text-[11px] text-muted-foreground leading-tight">{institution.website}</p>}
          </div>

          <div className="text-center mb-3">
            <h2 className="text-sm font-semibold flex items-center justify-center gap-1.5">
              <ReceiptIcon className="h-3.5 w-3.5" /> পেমেন্ট রসিদ
            </h2>
            <p className="text-xs text-muted-foreground">
              রসিদ নং: <span className="font-mono font-semibold text-foreground">{payment.receiptNo}</span>
              <span className="mx-1.5">•</span>
              তারিখ: {payment.date}
            </p>
          </div>

          <section className="mb-3">
            <h3 className="text-xs font-semibold border-b pb-1 mb-1.5">শিক্ষার্থীর তথ্য</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <InfoRow label="নাম" value={student.name} />
              {/* System ID is ALWAYS shown — the one identifier guaranteed to exist even when Roll is empty (Coaching Reg No / Roll vs System ID spec §14/§21). */}
              <InfoRow label="সিস্টেম আইডি" value={student.registrationId} mono />
              {student.currentRollNumber && <InfoRow label="রোল" value={student.currentRollNumber} mono />}
              {student.course && <InfoRow label="কোর্স" value={student.course} />}
              {batchName && <InfoRow label="ব্যাচ" value={batchName} />}
              <InfoRow label="মোবাইল" value={student.phone} />
              {student.guardianName && <InfoRow label="অভিভাবকের নাম" value={student.guardianName} />}
              {student.guardianMobile && <InfoRow label="অভিভাবকের মোবাইল" value={student.guardianMobile} />}
            </div>
          </section>

          <section className="mb-3">
            <h3 className="text-xs font-semibold border-b pb-1 mb-1.5">ফি ও পেমেন্ট বিবরণ</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={HEAD}>বিবরণ</TableHead>
                  <TableHead className={`${HEAD} text-right`}>পরিমাণ (৳)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseFeeValue !== undefined && (
                  <TableRow>
                    <TableCell className={`${CELL} text-muted-foreground`}>{courseFeeLabel}</TableCell>
                    <TableCell className={`${CELL} text-right`}>{courseFeeValue.toLocaleString()}</TableCell>
                  </TableRow>
                )}
                {student.admissionFee !== undefined && student.admissionFee > 0 && (
                  <TableRow>
                    <TableCell className={`${CELL} text-muted-foreground`}>ভর্তি ফি</TableCell>
                    <TableCell className={`${CELL} text-right`}>{student.admissionFee.toLocaleString()}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className={`${CELL} text-muted-foreground`}>এই পেমেন্টের পরিমাণ</TableCell>
                  <TableCell className={`${CELL} text-right`}>{payment.amount.toLocaleString()}</TableCell>
                </TableRow>
                {payment.discount > 0 && (
                  <TableRow>
                    <TableCell className={`${CELL} text-muted-foreground`}>ডিসকাউন্ট</TableCell>
                    <TableCell className={`${CELL} text-right text-success`}>- {payment.discount.toLocaleString()}</TableCell>
                  </TableRow>
                )}
                {payment.fine > 0 && (
                  <TableRow>
                    <TableCell className={`${CELL} text-muted-foreground`}>জরিমানা</TableCell>
                    <TableCell className={`${CELL} text-right text-warning`}>+ {payment.fine.toLocaleString()}</TableCell>
                  </TableRow>
                )}
                {payment.previousDue !== undefined && (
                  <TableRow>
                    <TableCell className={`${CELL} text-muted-foreground`}>পূর্ববর্তী বকেয়া</TableCell>
                    <TableCell className={`${CELL} text-right`}>{payment.previousDue.toLocaleString()}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className={`${CELL} text-muted-foreground`}>ফি ধরন</TableCell>
                  <TableCell className={`${CELL} text-right`}>{payment.feeType}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={`${CELL} text-muted-foreground`}>পেমেন্ট পদ্ধতি</TableCell>
                  <TableCell className={`${CELL} text-right`}>{payment.method}</TableCell>
                </TableRow>
                {payment.month && (
                  <TableRow>
                    <TableCell className={`${CELL} text-muted-foreground`}>মাস</TableCell>
                    <TableCell className={`${CELL} text-right`}>{payment.month}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-2 pt-2 border-t">
              <SummaryStat label="বর্তমান পেমেন্ট" value={`৳ ${payment.paidAmount.toLocaleString()}`} />
              {totalFee !== undefined && <SummaryStat label="সর্বমোট পরিশোধযোগ্য" value={`৳ ${totalFee.toLocaleString()}`} />}
              {totalPaidToDate !== undefined && <SummaryStat label="সর্বমোট পরিশোধিত" value={`৳ ${totalPaidToDate.toLocaleString()}`} />}
              {currentDue !== undefined && (
                <SummaryStat
                  label="বর্তমান বকেয়া"
                  value={`৳ ${currentDue.toLocaleString()}`}
                  tone={currentDue > 0 ? "destructive" : "success"}
                />
              )}
            </div>
          </section>

          {payment.note && (
            <div className="text-xs text-muted-foreground border-t pt-1.5 mb-3">
              <span className="font-medium text-foreground">নোট: </span>{payment.note}
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <div className="text-center text-[10px]">
              <div className="border-t border-foreground/40 pt-0.5 w-28">
                {institution.print.signatureLabel || "অনুমোদিতকারী"}
              </div>
            </div>
          </div>

          <div className="text-center text-[10px] text-muted-foreground pt-1.5 mt-1.5 border-t">
            ধন্যবাদ! আপনার পেমেন্ট সফলভাবে গৃহীত হয়েছে।
          </div>
        </div>
      </div>
    </div>
  );
}
