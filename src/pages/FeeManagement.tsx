import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useStudents } from "@/contexts/StudentContext";
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
import { PAYMENT_METHODS, FEE_TYPES } from "@/types/student";
import type { Student, Payment } from "@/types/student";
import { StatCard } from "@/components/StatCard";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const FeeManagement = () => {
  const { students, payments, addPayment, getPayments } = useStudents();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");
  const [filterFeeType, setFilterFeeType] = useState("all");

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
          onSuccess={(p) => setReceiptPayment(p)}
        />
        <ReceiptDialog
          payment={receiptPayment}
          students={students}
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
  addPayment: (p: Omit<Payment, "id" | "receiptNo">) => Payment;
  onSuccess?: (p: Payment) => void;
}) {
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

  const paidAmount = amount - discount + fine;
  const selectedStudent = students.find((s) => s.id === studentId);

  const handleSubmit = () => {
    if (!studentId || amount <= 0) {
      toast.error("শিক্ষার্থী ও পরিমাণ নির্বাচন করুন");
      return;
    }
    const created = addPayment({
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>পেমেন্ট গ্রহণ</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>শিক্ষার্থী *</Label>
            <Popover open={studentPickerOpen} onOpenChange={setStudentPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {selectedStudent
                    ? `${selectedStudent.name} (${selectedStudent.studentId})`
                    : "শিক্ষার্থী খুঁজুন বা নির্বাচন করুন"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
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
                  <CommandList>
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
                          <Check className={cn("mr-2 h-4 w-4", studentId === s.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col">
                            <span className="font-medium">{s.name} <span className="text-xs text-muted-foreground font-mono">({s.studentId})</span></span>
                            <span className="text-xs text-muted-foreground">{s.mobile} • বকেয়া: ৳{s.due.toLocaleString()}</span>
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">নাম:</span>
                <span className="font-medium">{selectedStudent.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">কোর্স:</span>
                <span>{selectedStudent.course} • {selectedStudent.batch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ফি ধরন:</span>
                <Badge variant="outline">{selectedStudent.feeType}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">মোট ফি:</span>
                <span>৳ {selectedStudent.totalFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">পরিশোধিত:</span>
                <span className="text-success">৳ {selectedStudent.paid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">বকেয়া:</span>
                <span className="text-destructive font-semibold">৳ {selectedStudent.due.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-3 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>পেমেন্ট তারিখ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(payDate, "dd MMMM yyyy", { locale: bn })}
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
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>নোট</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="অতিরিক্ত তথ্য..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
            <Button onClick={handleSubmit}>পেমেন্ট সম্পন্ন</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({
  payment,
  students,
  onOpenChange,
}: {
  payment: Payment | null;
  students: Student[];
  onOpenChange: (open: boolean) => void;
}) {
  if (!payment) return null;
  const student = students.find((s) => s.id === payment.studentId);

  const handlePrint = () => window.print();

  return (
    <Dialog open={!!payment} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md print:shadow-none print:max-w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="h-5 w-5 text-primary" />
            পেমেন্ট রসিদ
          </DialogTitle>
        </DialogHeader>

        <div id="receipt-print" className="space-y-4 pt-2">
          <div className="text-center border-b border-dashed pb-3">
            <h2 className="font-bold text-lg">লারা এলএমএস</h2>
            <p className="text-xs text-muted-foreground">কোচিং ম্যানেজমেন্ট সিস্টেম</p>
          </div>

          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">রসিদ নম্বর</p>
            <p className="text-lg font-bold font-mono text-primary">{payment.receiptNo}</p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">শিক্ষার্থীর নাম:</span>
              <span className="font-medium">{student?.name || "—"}</span>
            </div>
            {student && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">শিক্ষার্থী আইডি:</span>
                <span className="font-mono text-xs">{student.studentId}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">তারিখ:</span>
              <span>{payment.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ফি ধরন:</span>
              <Badge variant="outline">{payment.feeType}</Badge>
            </div>
            {payment.month && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">মাস:</span>
                <span>{payment.month}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">পেমেন্ট পদ্ধতি:</span>
              <span>{payment.method}</span>
            </div>
          </div>

          <div className="border-t border-dashed pt-3 space-y-1.5 text-sm">
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
              <span className="font-semibold">মোট পরিশোধিত:</span>
              <span className="font-bold text-lg text-primary">৳ {payment.paidAmount.toLocaleString()}</span>
            </div>
          </div>

          {payment.note && (
            <div className="text-xs text-muted-foreground border-t border-dashed pt-2">
              <span className="font-medium">নোট: </span>{payment.note}
            </div>
          )}

          <div className="text-center text-xs text-muted-foreground pt-2 border-t border-dashed">
            ধন্যবাদ! আপনার পেমেন্ট সফলভাবে গৃহীত হয়েছে।
          </div>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
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
