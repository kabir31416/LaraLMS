import React, { useMemo, useState } from "react";
import { format, isToday, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { bn } from "date-fns/locale";
import { CalendarIcon, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, Calculator } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { StatCard } from "@/components/StatCard";
import { useAccounts, ACCOUNT_BRANCHES } from "@/contexts/AccountsContext";
import { useBranchLedger } from "@/contexts/BranchLedgerContext";
import { useStudents } from "@/contexts/StudentContext";
import { PAYMENT_METHODS_LIST, PaymentMethod, IncomeEntry, ExpenseEntry } from "@/types/accounts";
import { BranchLedgerEntry, BranchItemType } from "@/types/branchLedger";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";

const fmtBDT = (n: number) => `৳${n.toLocaleString("bn-BD")}`;
const fmtDate = (iso: string) => format(parseISO(iso), "dd MMM yyyy", { locale: bn });

export default function Accounts() {
  const [tab, setTab] = useState("summary");

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">হিসাব ব্যবস্থাপনা</h1>
          <p className="text-sm text-muted-foreground">আয়, ব্যয়, ক্যাশবুক এবং রিপোর্ট</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 md:grid-cols-7 h-auto">
          <TabsTrigger value="summary">সারসংক্ষেপ</TabsTrigger>
          <TabsTrigger value="income">আয়</TabsTrigger>
          <TabsTrigger value="expense">ব্যয়</TabsTrigger>
          <TabsTrigger value="branch-ledger">শাখা হিসাব</TabsTrigger>
          <TabsTrigger value="cashbook">ক্যাশবুক</TabsTrigger>
          <TabsTrigger value="categories">ক্যাটাগরি</TabsTrigger>
          <TabsTrigger value="reports">রিপোর্ট</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6"><SummaryTab /></TabsContent>
        <TabsContent value="income" className="mt-6"><IncomeTab /></TabsContent>
        <TabsContent value="expense" className="mt-6"><ExpenseTab /></TabsContent>
        <TabsContent value="branch-ledger" className="mt-6"><BranchLedgerTab /></TabsContent>
        <TabsContent value="cashbook" className="mt-6"><CashbookTab /></TabsContent>
        <TabsContent value="categories" className="mt-6"><CategoriesTab /></TabsContent>
        <TabsContent value="reports" className="mt-6"><ReportsTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

/* -------------------- Summary -------------------- */
function SummaryTab() {
  const { incomes, expenses } = useAccounts();

  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;
  const todayIncome = incomes.filter((i) => isToday(parseISO(i.date))).reduce((s, i) => s + i.amount, 0);
  const todayExpense = expenses.filter((e) => isToday(parseISO(e.date))).reduce((s, e) => s + e.amount, 0);
  const opening = balance - (todayIncome - todayExpense);
  const closing = opening + todayIncome - todayExpense;

  // Branch-wise
  const branchRows = ACCOUNT_BRANCHES.map((b) => {
    const inc = incomes.filter((i) => i.branchId === b.id).reduce((s, i) => s + i.amount, 0);
    const exp = expenses.filter((e) => e.branchId === b.id).reduce((s, e) => s + e.amount, 0);
    return { ...b, income: inc, expense: exp, profit: inc - exp, balance: inc - exp };
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="মোট আয়" value={fmtBDT(totalIncome)} icon={TrendingUp} variant="success" />
        <StatCard title="মোট ব্যয়" value={fmtBDT(totalExpense)} icon={TrendingDown} variant="warning" />
        <StatCard title="বর্তমান ব্যালেন্স" value={fmtBDT(balance)} icon={Wallet} variant="primary" />
        <StatCard title="আজকের কালেকশন" value={fmtBDT(todayIncome)} icon={Calculator} variant="info" />
      </div>

      <Card>
        <CardHeader><CardTitle>দৈনিক ক্লোজিং</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Stat label="ওপেনিং ব্যালেন্স" value={fmtBDT(opening)} />
          <Stat label="আজকের আয়" value={fmtBDT(todayIncome)} tone="income" />
          <Stat label="আজকের ব্যয়" value={fmtBDT(todayExpense)} tone="expense" />
          <Stat label="ক্লোজিং ব্যালেন্স" value={fmtBDT(closing)} tone="balance" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>শাখাভিত্তিক ব্যালেন্স</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>শাখা</TableHead>
                <TableHead className="text-right">আয়</TableHead>
                <TableHead className="text-right">ব্যয়</TableHead>
                <TableHead className="text-right">লাভ</TableHead>
                <TableHead className="text-right">ব্যালেন্স</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branchRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right text-success-foreground">{fmtBDT(r.income)}</TableCell>
                  <TableCell className="text-right text-destructive">{fmtBDT(r.expense)}</TableCell>
                  <TableCell className={cn("text-right font-medium", r.profit >= 0 ? "text-primary" : "text-destructive")}>
                    {fmtBDT(r.profit)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmtBDT(r.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" | "balance" }) {
  const color =
    tone === "income" ? "text-primary" : tone === "expense" ? "text-destructive" : tone === "balance" ? "text-foreground" : "text-foreground";
  return (
    <div className="rounded-lg border p-4 bg-muted/30">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-bold mt-1", color)}>{value}</div>
    </div>
  );
}

/* -------------------- Income -------------------- */
function IncomeTab() {
  const { incomes, deleteIncome } = useAccounts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeEntry | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");

  const filtered = incomes.filter(
    (i) => (branchFilter === "all" || i.branchId === branchFilter) && (methodFilter === "all" || i.method === methodFilter)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle>আয়ের তালিকা</CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="শাখা" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব শাখা</SelectItem>
              {ACCOUNT_BRANCHES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="পদ্ধতি" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব পদ্ধতি</SelectItem>
              {PAYMENT_METHODS_LIST.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> নতুন আয়
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>তারিখ</TableHead>
              <TableHead>ক্যাটাগরি</TableHead>
              <TableHead>শাখা</TableHead>
              <TableHead>পদ্ধতি</TableHead>
              <TableHead>শিক্ষার্থী</TableHead>
              <TableHead>উৎস</TableHead>
              <TableHead className="text-right">পরিমাণ</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">কোনো আয় নেই</TableCell></TableRow>
            )}
            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{fmtDate(i.date)}</TableCell>
                <TableCell>{i.category}</TableCell>
                <TableCell>{i.branchName}</TableCell>
                <TableCell>{i.method}</TableCell>
                <TableCell>{i.studentName || "-"}</TableCell>
                <TableCell>
                  <Badge variant={i.source === "manual" ? "secondary" : "outline"}>
                    {i.source === "manual" ? "ম্যানুয়াল" : "অটো"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold text-primary">{fmtBDT(i.amount)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }} disabled={i.source !== "manual"}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { deleteIncome(i.id); toast.success("মুছে ফেলা হয়েছে"); }} disabled={i.source !== "manual"}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <IncomeDialog open={open} onOpenChange={setOpen} editing={editing} />
    </Card>
  );
}

function IncomeDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: IncomeEntry | null }) {
  const { addIncome, updateIncome, incomeCategories } = useAccounts();
  const { students } = useStudents();
  const [date, setDate] = useState<Date>(editing ? parseISO(editing.date) : new Date());
  const [category, setCategory] = useState(editing?.category || incomeCategories[0]);
  const [amount, setAmount] = useState(String(editing?.amount || ""));
  const [branchId, setBranchId] = useState(editing?.branchId || ACCOUNT_BRANCHES[0].id);
  const [method, setMethod] = useState<PaymentMethod>(editing?.method || "নগদ");
  const [studentId, setStudentId] = useState(editing?.studentId || "");
  const [note, setNote] = useState(editing?.note || "");

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ লিখুন"); return; }
    const branch = ACCOUNT_BRANCHES.find((b) => b.id === branchId)!;
    const student = students.find((s) => s.id === studentId);
    const payload = {
      date: date.toISOString(),
      category, amount: amt, branchId, branchName: branch.name, method,
      studentId: student?.id, studentName: student?.name, note,
      source: "manual" as const,
    };
    if (editing) { updateIncome(editing.id, payload); toast.success("আপডেট হয়েছে"); }
    else { addIncome(payload); toast.success("আয় যুক্ত হয়েছে"); }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "আয় সম্পাদনা" : "নতুন আয়"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="তারিখ"><DateField value={date} onChange={setDate} /></Field>
          <Field label="ক্যাটাগরি">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{incomeCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="পরিমাণ"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="শাখা">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACCOUNT_BRANCHES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="পেমেন্ট পদ্ধতি">
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS_LIST.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="শিক্ষার্থী (ঐচ্ছিক)">
            <Select value={studentId || "none"} onValueChange={(v) => setStudentId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">কেউ নয়</SelectItem>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.studentId})</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-2"><Field label="নোট"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button onClick={submit}>সংরক্ষণ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Expense -------------------- */
function ExpenseTab() {
  const { expenses, deleteExpense } = useAccounts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseEntry | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");

  const filtered = expenses.filter(
    (e) => (branchFilter === "all" || e.branchId === branchFilter) && (methodFilter === "all" || e.method === methodFilter)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle>ব্যয়ের তালিকা</CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="শাখা" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব শাখা</SelectItem>
              {ACCOUNT_BRANCHES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="পদ্ধতি" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব পদ্ধতি</SelectItem>
              {PAYMENT_METHODS_LIST.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> নতুন ব্যয়
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>তারিখ</TableHead>
              <TableHead>ক্যাটাগরি</TableHead>
              <TableHead>শাখা</TableHead>
              <TableHead>পদ্ধতি</TableHead>
              <TableHead>নোট</TableHead>
              <TableHead className="text-right">পরিমাণ</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">কোনো ব্যয় নেই</TableCell></TableRow>
            )}
            {filtered.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{fmtDate(e.date)}</TableCell>
                <TableCell>{e.category}</TableCell>
                <TableCell>{e.branchName}</TableCell>
                <TableCell>{e.method}</TableCell>
                <TableCell className="max-w-xs truncate">{e.note || "-"}</TableCell>
                <TableCell className="text-right font-semibold text-destructive">{fmtBDT(e.amount)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { deleteExpense(e.id); toast.success("মুছে ফেলা হয়েছে"); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <ExpenseDialog open={open} onOpenChange={setOpen} editing={editing} />
    </Card>
  );
}

function ExpenseDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: ExpenseEntry | null }) {
  const { addExpense, updateExpense, expenseCategories } = useAccounts();
  const [date, setDate] = useState<Date>(editing ? parseISO(editing.date) : new Date());
  const [category, setCategory] = useState(editing?.category || expenseCategories[0]);
  const [amount, setAmount] = useState(String(editing?.amount || ""));
  const [branchId, setBranchId] = useState(editing?.branchId || ACCOUNT_BRANCHES[0].id);
  const [method, setMethod] = useState<PaymentMethod>(editing?.method || "নগদ");
  const [note, setNote] = useState(editing?.note || "");

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ লিখুন"); return; }
    const branch = ACCOUNT_BRANCHES.find((b) => b.id === branchId)!;
    const payload = { date: date.toISOString(), category, amount: amt, branchId, branchName: branch.name, method, note };
    if (editing) { updateExpense(editing.id, payload); toast.success("আপডেট হয়েছে"); }
    else { addExpense(payload); toast.success("ব্যয় যুক্ত হয়েছে"); }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "ব্যয় সম্পাদনা" : "নতুন ব্যয়"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="তারিখ"><DateField value={date} onChange={setDate} /></Field>
          <Field label="ক্যাটাগরি">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="পরিমাণ"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="শাখা">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACCOUNT_BRANCHES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="পেমেন্ট পদ্ধতি">
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS_LIST.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-2"><Field label="নোট"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button onClick={submit}>সংরক্ষণ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Cashbook -------------------- */
function CashbookTab() {
  const { incomes, expenses } = useAccounts();

  const rows = useMemo(() => {
    type Row = { id: string; date: string; description: string; income: number; expense: number };
    const all: Row[] = [
      ...incomes.map((i) => ({ id: i.id, date: i.date, description: `${i.category}${i.studentName ? " - " + i.studentName : ""}`, income: i.amount, expense: 0 })),
      ...expenses.map((e) => ({ id: e.id, date: e.date, description: `${e.category}${e.note ? " - " + e.note : ""}`, income: 0, expense: e.amount })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    return all.map((r) => { bal += r.income - r.expense; return { ...r, balance: bal }; }).reverse();
  }, [incomes, expenses]);

  return (
    <Card>
      <CardHeader><CardTitle>ক্যাশবুক (চলমান ব্যালেন্স)</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>তারিখ</TableHead>
              <TableHead>বিবরণ</TableHead>
              <TableHead className="text-right">আয়</TableHead>
              <TableHead className="text-right">ব্যয়</TableHead>
              <TableHead className="text-right">ব্যালেন্স</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">কোনো লেনদেন নেই</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{fmtDate(r.date)}</TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell className="text-right text-primary">{r.income ? fmtBDT(r.income) : "-"}</TableCell>
                <TableCell className="text-right text-destructive">{r.expense ? fmtBDT(r.expense) : "-"}</TableCell>
                <TableCell className="text-right font-semibold">{fmtBDT(r.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* -------------------- Categories -------------------- */
function CategoriesTab() {
  const { incomeCategories, expenseCategories, addIncomeCategory, removeIncomeCategory, addExpenseCategory, removeExpenseCategory } = useAccounts();
  const [newIncome, setNewIncome] = useState("");
  const [newExpense, setNewExpense] = useState("");

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>আয়ের ক্যাটাগরি</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="নতুন ক্যাটাগরি" value={newIncome} onChange={(e) => setNewIncome(e.target.value)} />
            <Button onClick={() => { if (newIncome.trim()) { addIncomeCategory(newIncome.trim()); setNewIncome(""); } }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {incomeCategories.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1 py-1.5 px-3">
                {c}
                <button onClick={() => removeIncomeCategory(c)} className="ml-1 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ব্যয়ের ক্যাটাগরি</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="নতুন ক্যাটাগরি" value={newExpense} onChange={(e) => setNewExpense(e.target.value)} />
            <Button onClick={() => { if (newExpense.trim()) { addExpenseCategory(newExpense.trim()); setNewExpense(""); } }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {expenseCategories.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1 py-1.5 px-3">
                {c}
                <button onClick={() => removeExpenseCategory(c)} className="ml-1 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- Reports -------------------- */
function ReportsTab() {
  const { incomes, expenses, incomeCategories, expenseCategories } = useAccounts();
  const [from, setFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [to, setTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [branch, setBranch] = useState("all");
  const [category, setCategory] = useState("all");
  const [reportType, setReportType] = useState<"daily" | "monthly" | "branch" | "income" | "expense">("monthly");

  const inRange = (iso: string) => {
    if (!from || !to) return true;
    return isWithinInterval(parseISO(iso), { start: from, end: to });
  };
  const matches = (branchId: string, cat: string) =>
    (branch === "all" || branchId === branch) && (category === "all" || cat === category);

  const fIncomes = incomes.filter((i) => inRange(i.date) && matches(i.branchId, i.category));
  const fExpenses = expenses.filter((e) => inRange(e.date) && matches(e.branchId, e.category));
  const totalI = fIncomes.reduce((s, i) => s + i.amount, 0);
  const totalE = fExpenses.reduce((s, e) => s + e.amount, 0);

  const allCategories = reportType === "expense" ? expenseCategories : incomeCategories;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>রিপোর্ট ফিল্টার</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <Field label="রিপোর্ট ধরন">
            <Select value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">দৈনিক</SelectItem>
                <SelectItem value="monthly">মাসিক</SelectItem>
                <SelectItem value="branch">শাখা</SelectItem>
                <SelectItem value="income">আয়</SelectItem>
                <SelectItem value="expense">ব্যয়</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="শুরু তারিখ"><DateField value={from} onChange={setFrom} /></Field>
          <Field label="শেষ তারিখ"><DateField value={to} onChange={setTo} /></Field>
          <Field label="শাখা">
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব</SelectItem>
                {ACCOUNT_BRANCHES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ক্যাটাগরি">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব</SelectItem>
                {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="মোট আয়" value={fmtBDT(totalI)} icon={TrendingUp} variant="success" />
        <StatCard title="মোট ব্যয়" value={fmtBDT(totalE)} icon={TrendingDown} variant="warning" />
        <StatCard title="নিট লাভ" value={fmtBDT(totalI - totalE)} icon={Wallet} variant="primary" />
      </div>

      <Card>
        <CardHeader><CardTitle>বিস্তারিত</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>তারিখ</TableHead>
                <TableHead>ধরন</TableHead>
                <TableHead>ক্যাটাগরি</TableHead>
                <TableHead>শাখা</TableHead>
                <TableHead className="text-right">পরিমাণ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportType !== "expense" && fIncomes.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{fmtDate(i.date)}</TableCell>
                  <TableCell><Badge variant="secondary">আয়</Badge></TableCell>
                  <TableCell>{i.category}</TableCell>
                  <TableCell>{i.branchName}</TableCell>
                  <TableCell className="text-right text-primary">{fmtBDT(i.amount)}</TableCell>
                </TableRow>
              ))}
              {reportType !== "income" && fExpenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{fmtDate(e.date)}</TableCell>
                  <TableCell><Badge variant="destructive">ব্যয়</Badge></TableCell>
                  <TableCell>{e.category}</TableCell>
                  <TableCell>{e.branchName}</TableCell>
                  <TableCell className="text-right text-destructive">{fmtBDT(e.amount)}</TableCell>
                </TableRow>
              ))}
              {fIncomes.length === 0 && fExpenses.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">কোনো ডেটা নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- Branch Ledger -------------------- */
const ITEM_TYPES: BranchItemType[] = ["বই", "ভর্তি ফর্ম", "অন্যান্য"];

function BranchLedgerTab() {
  const { entries, deleteEntry } = useBranchLedger();
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BranchLedgerEntry | null>(null);
  const [defaultType, setDefaultType] = useState<"expense" | "income">("expense");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (branchFilter !== "all" && e.branchId !== branchFilter) return false;
      if (dateFilter && format(parseISO(e.date), "yyyy-MM-dd") !== format(dateFilter, "yyyy-MM-dd")) return false;
      return true;
    });
  }, [entries, branchFilter, dateFilter]);

  // Build running balance per branch (chronological)
  const rowsWithBalance = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
    const branchBal: Record<string, number> = {};
    const out = sorted.map((e) => {
      const prev = branchBal[e.branchId] || 0;
      const next = prev + (e.type === "expense" ? e.amount : -e.amount);
      branchBal[e.branchId] = next;
      return { ...e, balance: next };
    });
    return out.reverse();
  }, [filtered]);

  // Branch summary across all entries (not filtered) — for accurate due
  const branchSummary = useMemo(() => {
    return ACCOUNT_BRANCHES.map((b) => {
      const list = entries.filter((e) => e.branchId === b.id);
      const totalExpense = list.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
      const totalIncome = list.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
      return { ...b, totalExpense, totalIncome, due: totalExpense - totalIncome };
    });
  }, [entries]);

  const openAdd = (type: "expense" | "income") => {
    setEditing(null);
    setDefaultType(type);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle>শাখা হিসাব (লেজার)</CardTitle>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="শাখা" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব শাখা</SelectItem>
                {ACCOUNT_BRANCHES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <DateField value={dateFilter} onChange={setDateFilter} />
            {dateFilter && (
              <Button variant="ghost" size="sm" onClick={() => setDateFilter(undefined)}>তারিখ মুছুন</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openAdd("income")} variant="outline">
              <Plus className="h-4 w-4" /> আয় যোগ
            </Button>
            <Button onClick={() => openAdd("expense")}>
              <Plus className="h-4 w-4" /> ব্যয় যোগ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>তারিখ</TableHead>
                <TableHead>শাখা</TableHead>
                <TableHead>ধরন</TableHead>
                <TableHead>বিবরণ</TableHead>
                <TableHead className="text-right">পরিমাণ</TableHead>
                <TableHead className="text-right">ব্যালেন্স</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsWithBalance.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">কোনো লেনদেন নেই</TableCell></TableRow>
              )}
              {rowsWithBalance.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{fmtDate(r.date)}</TableCell>
                  <TableCell>{r.branchName}</TableCell>
                  <TableCell>
                    {r.type === "expense"
                      ? <Badge variant="destructive">ব্যয়</Badge>
                      : <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">আয়</Badge>}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {r.type === "expense"
                      ? `${r.itemType || "-"}${r.description ? " — " + r.description : ""}${r.quantity ? ` (${r.quantity})` : ""}`
                      : `${r.method || "-"}${r.note ? " — " + r.note : ""}`}
                  </TableCell>
                  <TableCell className={cn("text-right font-semibold", r.type === "expense" ? "text-destructive" : "text-primary")}>
                    {fmtBDT(r.amount)}
                  </TableCell>
                  <TableCell className={cn("text-right font-semibold", r.balance > 0 ? "text-destructive" : r.balance < 0 ? "text-primary" : "")}>
                    {fmtBDT(r.balance)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setDefaultType(r.type); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { deleteEntry(r.id); toast.success("মুছে ফেলা হয়েছে"); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>শাখাভিত্তিক সারসংক্ষেপ</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>শাখা</TableHead>
                <TableHead className="text-right">মোট ব্যয়</TableHead>
                <TableHead className="text-right">মোট আয়</TableHead>
                <TableHead className="text-right">বাকি পাওনা</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branchSummary.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {b.name}
                  </TableCell>
                  <TableCell className="text-right text-destructive">{fmtBDT(b.totalExpense)}</TableCell>
                  <TableCell className="text-right text-primary">{fmtBDT(b.totalIncome)}</TableCell>
                  <TableCell className={cn("text-right font-semibold", b.due > 0 ? "text-destructive" : b.due < 0 ? "text-primary" : "")}>
                    {fmtBDT(b.due)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BranchLedgerDialog open={open} onOpenChange={setOpen} editing={editing} defaultType={defaultType} />
    </div>
  );
}

function BranchLedgerDialog({
  open, onOpenChange, editing, defaultType,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: BranchLedgerEntry | null;
  defaultType: "expense" | "income";
}) {
  const { addEntry, updateEntry } = useBranchLedger();
  const initial = editing;
  const [type, setType] = useState<"expense" | "income">(initial?.type || defaultType);
  const [date, setDate] = useState<Date>(initial ? parseISO(initial.date) : new Date());
  const [branchId, setBranchId] = useState(initial?.branchId || ACCOUNT_BRANCHES[0].id);
  const [amount, setAmount] = useState(String(initial?.amount || ""));
  const [itemType, setItemType] = useState<BranchItemType>(initial?.itemType || "বই");
  const [description, setDescription] = useState(initial?.description || "");
  const [quantity, setQuantity] = useState(String(initial?.quantity || ""));
  const [method, setMethod] = useState<PaymentMethod>(initial?.method || "নগদ");
  const [note, setNote] = useState(initial?.note || "");

  // Reset on open change
  React.useEffect(() => {
    if (open) {
      setType(initial?.type || defaultType);
      setDate(initial ? parseISO(initial.date) : new Date());
      setBranchId(initial?.branchId || ACCOUNT_BRANCHES[0].id);
      setAmount(String(initial?.amount || ""));
      setItemType(initial?.itemType || "বই");
      setDescription(initial?.description || "");
      setQuantity(String(initial?.quantity || ""));
      setMethod(initial?.method || "নগদ");
      setNote(initial?.note || "");
    }
  }, [open, initial, defaultType]);

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ লিখুন"); return; }
    const branch = ACCOUNT_BRANCHES.find((b) => b.id === branchId)!;
    const payload: Omit<BranchLedgerEntry, "id"> = {
      date: date.toISOString(),
      branchId,
      branchName: branch.name,
      type,
      amount: amt,
      note,
      ...(type === "expense"
        ? { itemType, description, quantity: quantity ? Number(quantity) : undefined }
        : { method }),
    };
    if (editing) { updateEntry(editing.id, payload); toast.success("আপডেট হয়েছে"); }
    else { addEntry(payload); toast.success(type === "expense" ? "ব্যয় যুক্ত হয়েছে" : "আয় যুক্ত হয়েছে"); }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "শাখা হিসাব সম্পাদনা" : type === "expense" ? "শাখায় প্রেরণ (ব্যয়)" : "শাখা থেকে প্রাপ্তি (আয়)"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="ধরন">
            <Select value={type} onValueChange={(v) => setType(v as "expense" | "income")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">ব্যয় (শাখায় প্রেরণ)</SelectItem>
                <SelectItem value="income">আয় (শাখা থেকে প্রাপ্তি)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="শাখা">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACCOUNT_BRANCHES.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="তারিখ"><DateField value={date} onChange={(d) => d && setDate(d)} /></Field>
          <Field label="পরিমাণ (৳)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>

          {type === "expense" ? (
            <>
              <Field label="ধরন (আইটেম)">
                <Select value={itemType} onValueChange={(v) => setItemType(v as BranchItemType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ITEM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="পরিমাণ (সংখ্যা, ঐচ্ছিক)">
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </Field>
              <div className="md:col-span-2">
                <Field label="বিবরণ">
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="যেমন: গণিত বই" />
                </Field>
              </div>
            </>
          ) : (
            <Field label="পেমেন্ট পদ্ধতি">
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS_LIST.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}

          <div className="md:col-span-2"><Field label="নোট"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button onClick={submit}>সংরক্ষণ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Helpers -------------------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function DateField({ value, onChange }: { value: Date | undefined; onChange: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}>
          <CalendarIcon className="h-4 w-4" />
          {value ? format(value, "dd MMM yyyy", { locale: bn }) : "তারিখ"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  );
}
