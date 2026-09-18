import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
      <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
        <div className="max-w-md mx-auto space-y-3">
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

  // Historical (as-of-this-payment) figures — same arithmetic the old
  // ReceiptDialog used, derived from this payment's own stored snapshot
  // (previousDue) plus the student's totalFee, never from the student's
  // *live* due/paid (which would drift for an old receipt once later
  // payments are recorded). Payment Transactions remain the sole source of
  // truth — this is pure arithmetic over already-stored fields.
  const totalFee = student.totalFee;
  const previousPaid = totalFee !== undefined && payment.previousDue !== undefined ? totalFee - payment.previousDue : undefined;
  const totalPaidToDate = totalFee !== undefined && currentDue !== undefined ? totalFee - currentDue : undefined;
  const courseFeeLabel = student.feeType === "মাসিক" ? "মাসিক ফি" : "কোর্স ফি";
  const courseFeeValue = student.feeType === "মাসিক" ? student.monthlyFee : student.totalCourseFee;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="no-print sticky top-0 z-10 border-b bg-background px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> ফিরে যান
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" /> প্রিন্ট করুন
        </Button>
      </div>

      <div className="max-w-md mx-auto p-4 sm:p-8">
        <div id="receipt-print" className="bg-background rounded-lg border p-5 space-y-4">
          <div className="text-center border-b border-dashed pb-3 space-y-1">
            {showLogo && <img src={institution.logoUrl} alt="" className="h-12 mx-auto object-contain" />}
            <h2 className="font-bold text-lg">{institution.name || "কোচিং সেন্টার"}</h2>
            {institution.address && <p className="text-xs text-muted-foreground">{institution.address}</p>}
            <p className="text-xs text-muted-foreground">{[institution.phone, institution.email].filter(Boolean).join(" • ")}</p>
            {institution.website && <p className="text-xs text-muted-foreground">{institution.website}</p>}
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold flex items-center justify-center gap-1.5">
              <ReceiptIcon className="h-4 w-4" /> পেমেন্ট রসিদ
            </p>
          </div>

          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">রসিদ নম্বর</p>
            <p className="text-lg font-bold font-mono text-primary">{payment.receiptNo}</p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground shrink-0">শিক্ষার্থীর নাম:</span>
              <span className="font-medium text-right">{student.name}</span>
            </div>
            {/* System ID is ALWAYS shown — the one identifier guaranteed to exist even when Roll is empty (Coaching Reg No / Roll vs System ID spec §14/§21). */}
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground shrink-0">সিস্টেম আইডি:</span>
              <span className="font-mono text-xs">{student.registrationId}</span>
            </div>
            {student.currentRollNumber && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">রোল:</span>
                <span className="font-mono text-xs">{student.currentRollNumber}</span>
              </div>
            )}
            {student.course && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">কোর্স:</span>
                <span className="text-right">{student.course}</span>
              </div>
            )}
            {batchName && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">ব্যাচ:</span>
                <span className="text-right">{batchName}</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground shrink-0">মোবাইল:</span>
              <span className="text-right">{student.phone}</span>
            </div>
            {student.guardianName && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">অভিভাবকের নাম:</span>
                <span className="text-right">{student.guardianName}</span>
              </div>
            )}
            {student.guardianMobile && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">অভিভাবকের মোবাইল:</span>
                <span className="text-right">{student.guardianMobile}</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground shrink-0">তারিখ:</span>
              <span>{payment.date}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground shrink-0">ফি ধরন:</span>
              <Badge variant="outline">{payment.feeType}</Badge>
            </div>
            {payment.month && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">মাস:</span>
                <span>{payment.month}</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground shrink-0">পেমেন্ট পদ্ধতি:</span>
              <span>{payment.method}</span>
            </div>
          </div>

          <div className="border-t border-dashed pt-3 space-y-1.5 text-sm">
            {courseFeeValue !== undefined && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{courseFeeLabel}:</span>
                <span>৳ {courseFeeValue.toLocaleString()}</span>
              </div>
            )}
            {student.admissionFee !== undefined && student.admissionFee > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>ভর্তি ফি:</span>
                <span>৳ {student.admissionFee.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">পরিমাণ:</span>
              <span>৳ {payment.amount.toLocaleString()}</span>
            </div>
            {payment.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ডিসকাউন্ট:</span>
                <span className="text-success">- ৳ {payment.discount.toLocaleString()}</span>
              </div>
            )}
            {payment.fine > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">জরিমানা:</span>
                <span className="text-warning">+ ৳ {payment.fine.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="font-semibold">বর্তমান পেমেন্ট:</span>
              <span className="font-bold text-lg text-primary">৳ {payment.paidAmount.toLocaleString()}</span>
            </div>
            {previousPaid !== undefined && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>পূর্বে পরিশোধিত:</span>
                <span>৳ {previousPaid.toLocaleString()}</span>
              </div>
            )}
            {totalPaidToDate !== undefined && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>সর্বমোট পরিশোধিত:</span>
                <span>৳ {totalPaidToDate.toLocaleString()}</span>
              </div>
            )}
            {totalFee !== undefined && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>সর্বমোট পরিশোধযোগ্য:</span>
                <span>৳ {totalFee.toLocaleString()}</span>
              </div>
            )}
            {payment.previousDue !== undefined && (
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>পূর্ববর্তী বকেয়া:</span>
                <span>৳ {payment.previousDue.toLocaleString()}</span>
              </div>
            )}
            {currentDue !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">বর্তমান বকেয়া:</span>
                <span className={currentDue > 0 ? "text-destructive font-medium" : "text-success font-medium"}>
                  ৳ {currentDue.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {payment.note && (
            <div className="text-xs text-muted-foreground border-t border-dashed pt-2">
              <span className="font-medium">নোট: </span>{payment.note}
            </div>
          )}

          <div className="pt-6 flex justify-end">
            <div className="text-center text-xs">
              <div className="border-t border-foreground/40 pt-1 w-32">
                {institution.print.signatureLabel || "অনুমোদিতকারী"}
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground pt-2 border-t border-dashed">
            ধন্যবাদ! আপনার পেমেন্ট সফলভাবে গৃহীত হয়েছে।
          </div>
        </div>
      </div>
    </div>
  );
}
