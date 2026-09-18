import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useStudents } from "@/contexts/StudentContext";
import { usePayments } from "@/contexts/PaymentContext";
import { useBatches } from "@/contexts/BatchContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { ApiClientError } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Search, DollarSign, AlertCircle, TrendingUp, Package, Check, ChevronsUpDown, Printer, Receipt as ReceiptIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import { toast } from "sonner";
import { FEE_TYPES } from "@/types/student";
import type { Student, Payment } from "@/types/student";
import type { InstitutionSettings } from "@/types/academic";
import { StatCard } from "@/components/StatCard";
import { api } from "@/lib/apiClient";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const FeeManagement = () => {
  const { students, refreshStudents } = useStudents();
  const { payments, addPayment } = usePayments();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");
  const [filterFeeType, setFilterFeeType] = useState("all");

  // Fetched once here (not duplicated per-dialog-open) and handed to
  // ReceiptDialog — the same central Institution Settings the Settings
  // page itself edits (GET /settings/institution), so a receipt always
  // reflects whatever is currently configured there.
  const [institution, setInstitution] = useState<InstitutionSettings | null>(null);
  useEffect(() => {
    api.get<InstitutionSettings>("/settings/institution").then(setInstitution).catch(() => {});
  }, []);

  // Stats
  const totalDue = students.reduce((sum, s) => sum + s.due, 0);
  const packageDue = students.filter((s) => s.feeType === "এককালীন").reduce((sum, s) => sum + s.due, 0);
  const monthlyDue = students.filter((s) => s.feeType === "মাসিক").reduce((sum, s) => sum + s.due, 0);
  const today = format(new Date(), "yyyy-MM-dd");
  const todayCollection = payments
    .filter((p) => p.date === today)
    .reduce((sum, p) => sum + p.paidAmount, 0);

  const dueStudents = students
    .filter((s) => s.due > 0)
    .filter((s) => {
      if (filterFeeType !== "all" && s.feeType !== filterFeeType) return false;
      if (search) {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.mobile.includes(q);
      }
      return true;
    });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ফি ম্যানেজমেন্ট</h1>
            <p className="text-muted-foreground text-sm">ফি আদায় ও বকেয়া ট্র্যাকিং</p>
          </div>
          <Button onClick={() => setPaymentOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> পেমেন্ট গ্রহণ
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="মোট বকেয়া" value={`৳ ${totalDue.toLocaleString()}`} icon={AlertCircle} variant="warning" />
          <StatCard title="প্যাকেজ বকেয়া" value={`৳ ${packageDue.toLocaleString()}`} icon={Package} variant="info" />
          <StatCard title="মাসিক বকেয়া" value={`৳ ${monthlyDue.toLocaleString()}`} icon={TrendingUp} variant="primary" />
          <StatCard title="আজকের আদায়" value={`৳ ${todayCollection.toLocaleString()}`} icon={DollarSign} variant="success" />
        </div>

        <Tabs defaultValue="due" className="space-y-4">
          <TabsList className="bg-card border">
            <TabsTrigger value="due">বকেয়া তালিকা</TabsTrigger>
            <TabsTrigger value="history">পেমেন্ট ইতিহাস</TabsTrigger>
          </TabsList>

          <TabsContent value="due">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="নাম, আইডি বা মোবাইল দিয়ে খুঁজুন..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select value={filterFeeType} onValueChange={setFilterFeeType}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="ফি ধরন" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">সব ধরন</SelectItem>
                      <SelectItem value="এককালীন">এককালীন</SelectItem>
                      <SelectItem value="মাসিক">মাসিক</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>আইডি</TableHead>
                      <TableHead>নাম</TableHead>
                      <TableHead>কোর্স</TableHead>
                      <TableHead>ফি ধরন</TableHead>
                      <TableHead className="text-right">মোট ফি</TableHead>
                      <TableHead className="text-right">পরিশোধিত</TableHead>
                      <TableHead className="text-right">বকেয়া</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          কোনো বকেয়া শিক্ষার্থী নেই
                        </TableCell>
                      </TableRow>
                    ) : (
                      dueStudents.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">{s.studentId}</TableCell>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>{s.course}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={s.feeType === "এককালীন" ? "bg-info/10 text-info border-info/20" : "bg-primary/10 text-primary border-primary/20"}>
                              {s.feeType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">৳ {s.totalFee.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-success">৳ {s.paid.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-destructive font-semibold">৳ {s.due.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-none shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>রসিদ নং</TableHead>
                      <TableHead>তারিখ</TableHead>
                      <TableHead>শিক্ষার্থী</TableHead>
                      <TableHead>ফি ধরন</TableHead>
                      <TableHead>মাস</TableHead>
                      <TableHead className="text-right">পরিমাণ</TableHead>
                      <TableHead className="text-right">জরিমানা</TableHead>
                      <TableHead className="text-right">পরিশোধিত</TableHead>
                      <TableHead>পদ্ধতি</TableHead>
                      <TableHead>নোট</TableHead>
                      <TableHead className="text-right">অ্যাকশন</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-8">কোনো পেমেন্ট নেই</TableCell>
                      </TableRow>
                    ) : (
                      [...payments].sort((a, b) => b.date.localeCompare(a.date)).map((p) => {
                        const student = students.find((s) => s.id === p.studentId);
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{p.receiptNo}</TableCell>
                            <TableCell>{p.date}</TableCell>
                            <TableCell className="font-medium">{student?.name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{p.feeType}</Badge>
                            </TableCell>
                            <TableCell>{p.month || "—"}</TableCell>
                            <TableCell className="text-right">৳ {p.amount.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{p.fine > 0 ? `৳ ${p.fine.toLocaleString()}` : "—"}</TableCell>
                            <TableCell className="text-right font-semibold text-success">৳ {p.paidAmount.toLocaleString()}</TableCell>
                            <TableCell>{p.method}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{p.note || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" onClick={() => setReceiptPayment(p)}>
                                <ReceiptIcon className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          students={students}
          addPayment={addPayment}
          onSuccess={(p) => { setReceiptPayment(p); refreshStudents(); }}
        />
        <ReceiptDialog
          payment={receiptPayment}
          students={students}
          institution={institution}
          onOpenChange={(open) => !open && setReceiptPayment(null)}
        />
      </div>
    </DashboardLayout>
  );
};

function PaymentDialog({
  open,
  onOpenChange,
  students,
  addPayment,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  students: Student[];
  addPayment: (p: Omit<Payment, "id" | "receiptNo"> & { idempotencyKey?: string }) => Promise<Payment>;
  onSuccess?: (p: Payment) => void;
}) {
  const { batches } = useBatches();
  const { activePaymentMethods } = useAcademic();
  const [studentId, setStudentId] = useState("");
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [feeType, setFeeType] = useState<string>("এককালীন");
  const [amount, setAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [fine, setFine] = useState(0);
  const [method, setMethod] = useState("নগদ");
  const [month, setMonth] = useState("");
  const [note, setNote] = useState("");
  const [payDate, setPayDate] = useState<Date>(new Date());
  const [submitting, setSubmitting] = useState(false);

  // One key per submission *attempt* — reused across a retry of that same
  // attempt (double-click, network retry) so the backend can recognize it as
  // the same logical payment instead of creating a second one; regenerated
  // whenever the dialog (re)opens or a payment succeeds, so the next
  // genuinely new payment gets its own key. A plain ref, not state — a
  // double-click must see the *same* value synchronously, before React has
  // any chance to re-render.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const submittingRef = useRef(false);
  useEffect(() => {
    if (open) idempotencyKeyRef.current = crypto.randomUUID();
  }, [open]);

  const paidAmount = amount - discount + fine;
  const selectedStudent = students.find((s) => s.id === studentId);

  const handleSubmit = async () => {
    // Synchronous guard: React's `submitting` state won't disable the
    // button until the next render, which two clicks inside the same tick
    // (or a browser that fires both before repainting) can both slip past.
    if (submittingRef.current) return;
    if (!studentId || amount <= 0) {
      toast.error("শিক্ষার্থী ও পরিমাণ নির্বাচন করুন");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const created = await addPayment({
        studentId,
        date: format(payDate, "yyyy-MM-dd"),
        amount,
        discount,
        fine,
        paidAmount,
        method,
        feeType: feeType as import("@/types/student").FeeType,
        month: month || undefined,
        note: note || undefined,
        idempotencyKey: idempotencyKeyRef.current,
      });
      toast.success(`পেমেন্ট সফল। রসিদ নং: ${created.receiptNo}`);
      onOpenChange(false);
      onSuccess?.(created);
      // Reset
      setStudentId("");
      setAmount(0);
      setDiscount(0);
      setFine(0);
      setNote("");
      setMonth("");
      idempotencyKeyRef.current = crypto.randomUUID();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পেমেন্ট ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* p-0 + flex flex-col so the header/footer can stay put (shrink-0)
          while only the middle form section scrolls — the shared
          DialogContent's own max-h-[90dvh]/overflow-y-auto still bounds the
          whole thing on very short viewports, this just keeps the action
          buttons reachable without hunting through a scrolled body first. */}
      <DialogContent className="max-w-lg p-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle>পেমেন্ট গ্রহণ</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4 min-h-0">
          <div className="space-y-1.5">
            <Label>শিক্ষার্থী *</Label>
            <Popover open={studentPickerOpen} onOpenChange={setStudentPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedStudent
                      ? `${selectedStudent.name} (${selectedStudent.studentId})`
                      : "শিক্ষার্থী খুঁজুন বা নির্বাচন করুন"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)] p-0 bg-popover" align="start">
                <Command
                  filter={(value, search) => {
                    const s = students.find((st) => st.id === value);
                    if (!s) return 0;
                    const q = search.toLowerCase();
                    const hay = `${s.name} ${s.studentId} ${s.mobile}`.toLowerCase();
                    return hay.includes(q) ? 1 : 0;
                  }}
                >
                  <CommandInput placeholder="আইডি, নাম বা মোবাইল দিয়ে খুঁজুন..." />
                  <CommandList className="max-h-[40vh]">
                    <CommandEmpty>কোনো শিক্ষার্থী পাওয়া যায়নি</CommandEmpty>
                    <CommandGroup>
                      {students.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.id}
                          onSelect={(v) => {
                            setStudentId(v);
                            const st = students.find((x) => x.id === v);
                            if (st) setFeeType(st.feeType);
                            setStudentPickerOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4 shrink-0", studentId === s.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">{s.name} <span className="text-xs text-muted-foreground font-mono">({s.studentId})</span></span>
                            <span className="text-xs text-muted-foreground truncate">{s.mobile} • বকেয়া: ৳{s.due.toLocaleString()}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedStudent && (
            <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">নাম:</span>
                <span className="font-medium text-right truncate">{selectedStudent.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">কোর্স:</span>
                <span className="text-right truncate">{selectedStudent.course} • {batches.find((b) => b.id === selectedStudent.batchId)?.name || "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">ফি ধরন:</span>
                <Badge variant="outline">{selectedStudent.feeType}</Badge>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">মোট ফি:</span>
                <span>৳ {selectedStudent.totalFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">পরিশোধিত:</span>
                <span className="text-success">৳ {selectedStudent.paid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">বকেয়া:</span>
                <span className="text-destructive font-semibold">৳ {selectedStudent.due.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ফি ধরন</Label>
              <Select value={feeType} onValueChange={setFeeType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEE_TYPES.map((ft) => (
                    <SelectItem key={ft} value={ft}>{ft}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {feeType === "মাসিক" && (
              <div className="space-y-1.5">
                <Label>মাস</Label>
                <Input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="যেমন: এপ্রিল ২০২৬" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>পরিমাণ (৳) *</Label>
              <Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>ডিসকাউন্ট (৳)</Label>
              <Input type="number" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>জরিমানা (৳)</Label>
              <Input type="number" value={fine || ""} onChange={(e) => setFine(Number(e.target.value))} />
            </div>
          </div>

          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">পরিশোধিত পরিমাণ</p>
            <p className="text-2xl font-bold text-primary">৳ {paidAmount.toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>পেমেন্ট তারিখ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{format(payDate, "dd MMMM yyyy", { locale: bn })}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={payDate}
                    onSelect={(d) => d && setPayDate(d)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>পেমেন্ট পদ্ধতি</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activePaymentMethods.map((m) => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>নোট</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="অতিরিক্ত তথ্য..." />
          </div>
        </div>

        <div className="shrink-0 border-t px-4 py-3 sm:px-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>বাতিল</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "সংরক্ষণ হচ্ছে..." : "পেমেন্ট সম্পন্ন"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Creates (once) or reuses a single <style> tag carrying the @page rule for the receipt's print job — kept in sync with Institution Settings' own print.paperSize rather than a hard-coded page size. */
function applyReceiptPageSize(paperSize: "A4" | "Letter") {
  const styleId = "receipt-print-page-size";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  const margin = paperSize === "A4" ? "12mm" : "0.5in";
  styleEl.textContent = `@page { size: ${paperSize}; margin: ${margin}; }`;
}

function ReceiptDialog({
  payment,
  students,
  institution,
  onOpenChange,
}: {
  payment: Payment | null;
  students: Student[];
  institution: InstitutionSettings | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { batches } = useBatches();
  if (!payment) return null;
  const student = students.find((s) => s.id === payment.studentId);
  const batch = student ? batches.find((b) => b.id === student.batchId) : undefined;

  const showLogo = institution?.print.showLogoOnDocuments !== false && !!institution?.logoUrl;

  // Historical (as-of-this-payment) figures, derived from this payment's own
  // stored snapshot (previousDue) plus the student's totalFee — never from
  // the student's *live* due/paid, which would silently drift for an old
  // receipt once later payments are recorded. totalFee itself only changes
  // if the student's billing plan (fee/discount) is edited, so treating it
  // as stable across a payment's own history matches how payment.service.ts's
  // create() already recomputes and re-saves it on every payment. Payment
  // Transactions remain the sole source of truth — this is pure arithmetic
  // over already-stored fields, never an independent recalculation.
  const totalFee = student?.totalFee;
  const currentDue = payment.previousDue !== undefined ? payment.previousDue - payment.paidAmount : undefined;
  const previousPaid = totalFee !== undefined && payment.previousDue !== undefined ? totalFee - payment.previousDue : undefined;
  const totalPaidToDate = totalFee !== undefined && currentDue !== undefined ? totalFee - currentDue : undefined;
  const courseFeeLabel = student?.feeType === "মাসিক" ? "মাসিক ফি" : "কোর্স ফি";
  const courseFeeValue = student?.feeType === "মাসিক" ? student?.monthlyFee : student?.totalCourseFee;

  const handlePrint = () => {
    applyReceiptPageSize(institution?.print.paperSize || "A4");
    window.print();
  };

  return (
    <Dialog open={!!payment} onOpenChange={onOpenChange}>
      <DialogContent id="receipt-dialog-content" className="max-w-md p-0 flex flex-col overflow-hidden print:shadow-none print:max-w-full">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4 print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="h-5 w-5 text-primary" />
            পেমেন্ট রসিদ
          </DialogTitle>
        </DialogHeader>

        <div id="receipt-scroll-wrapper" className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {/* Everything the printed receipt should contain lives inside this
              one element — index.css's @media print rule hides every other
              element on the page (dialog chrome included) and shows only
              this subtree, so what's on screen here is exactly what prints.
              The dialog itself (id="receipt-dialog-content") and this
              scroll wrapper are both height-clamped/overflow-clipped for
              on-screen display — print must neutralize both, or only
              whatever happened to be scrolled into view at print time
              (usually just the header) ends up on the page. */}
          <div id="receipt-print" className="space-y-4">
            <div className="text-center border-b border-dashed pb-3 space-y-1">
              {showLogo && (
                <img src={institution!.logoUrl} alt="" className="h-12 mx-auto object-contain" />
              )}
              <h2 className="font-bold text-lg">{institution?.name || "কোচিং সেন্টার"}</h2>
              {institution?.address && <p className="text-xs text-muted-foreground">{institution.address}</p>}
              <p className="text-xs text-muted-foreground">
                {[institution?.phone, institution?.email].filter(Boolean).join(" • ")}
              </p>
              {institution?.website && <p className="text-xs text-muted-foreground">{institution.website}</p>}
            </div>

            <div className="bg-primary/5 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">রসিদ নম্বর</p>
              <p className="text-lg font-bold font-mono text-primary">{payment.receiptNo}</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground shrink-0">শিক্ষার্থীর নাম:</span>
                <span className="font-medium text-right">{student?.name || "—"}</span>
              </div>
              {student && (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground shrink-0">রেজিস্ট্রেশন আইডি:</span>
                    <span className="font-mono text-xs">{student.studentId}</span>
                  </div>
                  {student.rollNumber && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground shrink-0">রোল:</span>
                      <span className="font-mono text-xs">{student.rollNumber}</span>
                    </div>
                  )}
                  {student.course && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground shrink-0">কোর্স:</span>
                      <span className="text-right">{student.course}</span>
                    </div>
                  )}
                  {batch && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground shrink-0">ব্যাচ:</span>
                      <span className="text-right">{batch.name}</span>
                    </div>
                  )}
                  {student.guardianName && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground shrink-0">অভিভাবকের নাম:</span>
                      <span className="text-right">{student.guardianName}</span>
                    </div>
                  )}
                </>
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
              {student && courseFeeValue !== undefined && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{courseFeeLabel}:</span>
                  <span>৳ {courseFeeValue.toLocaleString()}</span>
                </div>
              )}
              {student?.admissionFee !== undefined && student.admissionFee > 0 && (
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
                  {institution?.print.signatureLabel || "অনুমোদিতকারী"}
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-muted-foreground pt-2 border-t border-dashed">
              ধন্যবাদ! আপনার পেমেন্ট সফলভাবে গৃহীত হয়েছে।
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t px-4 py-3 sm:px-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>বন্ধ</Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> প্রিন্ট
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FeeManagement;
