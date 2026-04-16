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
import { CalendarIcon, Plus, Search, DollarSign, AlertCircle, TrendingUp, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import { toast } from "sonner";
import { PAYMENT_METHODS, FEE_TYPES } from "@/types/student";
import type { Student } from "@/types/student";
import { StatCard } from "@/components/StatCard";

const FeeManagement = () => {
  const { students, payments, addPayment, getPayments } = useStudents();
  const [paymentOpen, setPaymentOpen] = useState(false);
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
                      <TableHead>তারিখ</TableHead>
                      <TableHead>শিক্ষার্থী</TableHead>
                      <TableHead>ফি ধরন</TableHead>
                      <TableHead>মাস</TableHead>
                      <TableHead className="text-right">পরিমাণ</TableHead>
                      <TableHead className="text-right">জরিমানা</TableHead>
                      <TableHead className="text-right">পরিশোধিত</TableHead>
                      <TableHead>পদ্ধতি</TableHead>
                      <TableHead>নোট</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">কোনো পেমেন্ট নেই</TableCell>
                      </TableRow>
                    ) : (
                      [...payments].sort((a, b) => b.date.localeCompare(a.date)).map((p) => {
                        const student = students.find((s) => s.id === p.studentId);
                        return (
                          <TableRow key={p.id}>
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

        <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} students={students} addPayment={addPayment} />
      </div>
    </DashboardLayout>
  );
};

function PaymentDialog({
  open,
  onOpenChange,
  students,
  addPayment,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  students: Student[];
  addPayment: (p: Omit<import("@/types/student").Payment, "id">) => void;
}) {
  const [studentId, setStudentId] = useState("");
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
    addPayment({
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
    toast.success("পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে");
    onOpenChange(false);
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
            <Select value={studentId} onValueChange={(v) => {
              setStudentId(v);
              const s = students.find((st) => st.id === v);
              if (s) setFeeType(s.feeType);
            }}>
              <SelectTrigger><SelectValue placeholder="শিক্ষার্থী নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.studentId}) — বকেয়া: ৳{s.due.toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStudent && (
            <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
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

export default FeeManagement;
