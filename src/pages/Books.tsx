import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useBooks } from "@/contexts/BookContext";
import { useStudents } from "@/contexts/StudentContext";
import { useBatches } from "@/contexts/BatchContext";
import { CLASSES, SUBJECTS } from "@/types/student";
import { Plus, Minus, AlertTriangle, ArrowRightLeft, BookPlus, Undo2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Books() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">বই ও ব্রাঞ্চ ম্যানেজমেন্ট</h1>
          <p className="text-muted-foreground">বই, স্টক, ব্রাঞ্চ ও বিতরণ পরিচালনা করুন</p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="all">সব বই</TabsTrigger>
            <TabsTrigger value="stock">স্টক</TabsTrigger>
            <TabsTrigger value="branch">ব্রাঞ্চ স্টক</TabsTrigger>
            <TabsTrigger value="distribute">শিক্ষার্থী বিতরণ</TabsTrigger>
            <TabsTrigger value="history">ইতিহাস</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6"><AllBooksTab /></TabsContent>
          <TabsContent value="stock" className="mt-6"><StockTab /></TabsContent>
          <TabsContent value="branch" className="mt-6"><BranchStockTab /></TabsContent>
          <TabsContent value="distribute" className="mt-6"><DistributeTab /></TabsContent>
          <TabsContent value="history" className="mt-6"><HistoryTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ---------------- All Books ---------------- */
function AllBooksTab() {
  const { books, addBook, deleteBook } = useBooks();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", subject: SUBJECTS[0], class: CLASSES[0], author: "", price: 0,
    totalStock: 0, lowStockThreshold: 20,
  });

  const submit = () => {
    if (!form.name.trim()) return toast.error("বইয়ের নাম দিন");
    addBook(form);
    toast.success("বই যোগ হয়েছে");
    setOpen(false);
    setForm({ name: "", subject: SUBJECTS[0], class: CLASSES[0], author: "", price: 0, totalStock: 0, lowStockThreshold: 20 });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>সব বই ({books.length})</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><BookPlus className="w-4 h-4 mr-2" />নতুন বই</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>নতুন বই যোগ করুন</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div><Label>বইয়ের নাম</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>বিষয়</Label>
                  <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>শ্রেণি</Label>
                  <Select value={form.class} onValueChange={(v) => setForm({ ...form, class: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>লেখক</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>মূল্য</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} /></div>
                <div><Label>প্রাথমিক স্টক</Label><Input type="number" value={form.totalStock} onChange={(e) => setForm({ ...form, totalStock: +e.target.value })} /></div>
                <div><Label>লো-স্টক লিমিট</Label><Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: +e.target.value })} /></div>
              </div>
              <Button onClick={submit}>সংরক্ষণ করুন</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>বই কোড</TableHead><TableHead>নাম</TableHead><TableHead>বিষয়</TableHead>
              <TableHead>শ্রেণি</TableHead><TableHead>লেখক</TableHead><TableHead>মূল্য</TableHead>
              <TableHead>স্টক</TableHead><TableHead>একশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {books.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono">{b.bookCode}</TableCell>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{b.subject}</TableCell>
                <TableCell>{b.class}</TableCell>
                <TableCell>{b.author || "-"}</TableCell>
                <TableCell>৳{b.price}</TableCell>
                <TableCell>
                  <Badge variant={b.totalStock <= b.lowStockThreshold ? "destructive" : "secondary"}>
                    {b.totalStock}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => deleteBook(b.id)}>মুছুন</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- Stock Tab ---------------- */
function StockTab() {
  const { books, addStock, reduceStock } = useBooks();
  const [dialog, setDialog] = useState<{ type: "add" | "reduce"; bookId: string } | null>(null);
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState("");

  const lowStock = books.filter((b) => b.totalStock <= b.lowStockThreshold);

  const submit = () => {
    if (!dialog || qty <= 0) return toast.error("পরিমাণ দিন");
    if (dialog.type === "add") addStock(dialog.bookId, qty, note);
    else reduceStock(dialog.bookId, qty, note);
    toast.success("স্টক আপডেট হয়েছে");
    setDialog(null); setQty(0); setNote("");
  };

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">লো-স্টক সতর্কতা</p>
              <p className="text-sm text-muted-foreground">
                {lowStock.map((b) => `${b.name} (${b.totalStock})`).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>মেইন স্টক ব্যবস্থাপনা</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>বই কোড</TableHead><TableHead>নাম</TableHead>
                <TableHead>বর্তমান স্টক</TableHead><TableHead>স্ট্যাটাস</TableHead>
                <TableHead>একশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {books.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono">{b.bookCode}</TableCell>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="font-bold">{b.totalStock}</TableCell>
                  <TableCell>
                    {b.totalStock <= b.lowStockThreshold ? (
                      <Badge variant="destructive">লো-স্টক</Badge>
                    ) : (
                      <Badge variant="secondary">সঠিক</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" onClick={() => setDialog({ type: "add", bookId: b.id })}>
                      <Plus className="w-3 h-3 mr-1" />যোগ
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDialog({ type: "reduce", bookId: b.id })}>
                      <Minus className="w-3 h-3 mr-1" />কমান
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.type === "add" ? "স্টক যোগ করুন" : "স্টক কমান"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>পরিমাণ</Label><Input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} /></div>
            <div><Label>নোট (ঐচ্ছিক)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <Button onClick={submit}>সংরক্ষণ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Branch Stock (Multi-book transfer) ---------------- */
type Row = { bookId: string; quantity: number };

function BranchStockTab() {
  const { books, branches, branchStock, transferMultipleToBranch } = useBooks();
  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState<Row[]>([{ bookId: "", quantity: 1 }]);
  const [filterBranch, setFilterBranch] = useState<string>("all");

  const addRow = () => setRows([...rows, { bookId: "", quantity: 1 }]);
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = () => {
    if (!branchId) return toast.error("ব্রাঞ্চ নির্বাচন করুন");
    const items = rows.filter((r) => r.bookId && r.quantity > 0);
    if (items.length === 0) return toast.error("কমপক্ষে একটি বই যোগ করুন");
    const res = transferMultipleToBranch(branchId, items);
    if (!res.ok) return toast.error("স্থানান্তর ব্যর্থ — যথেষ্ট স্টক নেই");
    if (res.failed?.length) toast.warning(`কিছু বই স্থানান্তর হয়নি: ${res.failed.join(", ")}`);
    else toast.success("স্থানান্তর সফল");
    setOpen(false); setBranchId(""); setRows([{ bookId: "", quantity: 1 }]);
  };

  const branchRows = useMemo(() => {
    return branchStock
      .filter((bs) => filterBranch === "all" || bs.branchId === filterBranch)
      .map((bs) => ({
        ...bs,
        book: books.find((b) => b.id === bs.bookId),
        branch: branches.find((b) => b.id === bs.branchId),
      }));
  }, [branchStock, books, branches, filterBranch]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>ব্রাঞ্চ স্টক</CardTitle>
            <div className="flex gap-2 items-center">
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="ব্রাঞ্চ ফিল্টার" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব ব্রাঞ্চ</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button><ArrowRightLeft className="w-4 h-4 mr-2" />স্থানান্তর</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>ব্রাঞ্চে বই স্থানান্তর (একাধিক বই)</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div>
                      <Label>ব্রাঞ্চ</Label>
                      <Select value={branchId} onValueChange={setBranchId}>
                        <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                        <SelectContent>
                          {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>বইসমূহ</Label>
                      {rows.map((row, i) => {
                        const selected = books.find((b) => b.id === row.bookId);
                        return (
                          <div key={i} className="flex gap-2 items-end">
                            <div className="flex-1">
                              <Select value={row.bookId} onValueChange={(v) => updateRow(i, { bookId: v })}>
                                <SelectTrigger><SelectValue placeholder="বই নির্বাচন করুন" /></SelectTrigger>
                                <SelectContent>
                                  {books.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                      {b.name} (স্টক: {b.totalStock})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {selected && (
                                <p className="text-xs text-muted-foreground mt-1">মেইন স্টক: {selected.totalStock}</p>
                              )}
                            </div>
                            <div className="w-24">
                              <Input
                                type="number"
                                min={1}
                                value={row.quantity}
                                onChange={(e) => updateRow(i, { quantity: +e.target.value })}
                              />
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeRow(i)}
                              disabled={rows.length === 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                      <Button variant="outline" size="sm" onClick={addRow}>
                        <Plus className="w-3 h-3 mr-1" />আরও বই যোগ করুন
                      </Button>
                    </div>

                    <Button onClick={submit}>স্থানান্তর করুন</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {branchRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">কোনো স্টক নেই</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ব্রাঞ্চ</TableHead><TableHead>পরিচালক</TableHead>
                  <TableHead>বই কোড</TableHead><TableHead>বইয়ের নাম</TableHead>
                  <TableHead>পরিমাণ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.branch?.name}</TableCell>
                    <TableCell>{r.branch?.director}</TableCell>
                    <TableCell className="font-mono">{r.book?.bookCode}</TableCell>
                    <TableCell>{r.book?.name}</TableCell>
                    <TableCell><Badge>{r.quantity}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>সব ব্রাঞ্চ ({branches.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>নাম</TableHead><TableHead>ঠিকানা</TableHead>
                <TableHead>পরিচালক</TableHead><TableHead>ফোন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.address}</TableCell>
                  <TableCell>{b.director}</TableCell>
                  <TableCell>{b.phone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Distribute / Issue (Multi-book, MAIN stock) ---------------- */
function DistributeTab() {
  const { books, issues, issueMultipleToStudent, returnFromStudent } = useBooks();
  const { students } = useStudents();
  const { batches } = useBatches();

  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [rows, setRows] = useState<Row[]>([{ bookId: "", quantity: 1 }]);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students.slice(0, 10);
    const q = search.toLowerCase();
    return students.filter(
      (s) => s.studentId.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.mobile.includes(q)
    );
  }, [search, students]);

  const selectedStudent = students.find((s) => s.id === studentId);

  const addRow = () => setRows([...rows, { bookId: "", quantity: 1 }]);
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = () => {
    if (!selectedStudent) return toast.error("শিক্ষার্থী নির্বাচন করুন");
    const items = rows.filter((r) => r.bookId && r.quantity > 0);
    if (items.length === 0) return toast.error("কমপক্ষে একটি বই যোগ করুন");
    const res = issueMultipleToStudent({
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      issueDate,
      items,
    });
    if (!res.ok) return toast.error("বিতরণ ব্যর্থ — মেইন স্টকে যথেষ্ট বই নেই");
    if (res.failed?.length) toast.warning(`কিছু বই বিতরণ হয়নি: ${res.failed.join(", ")}`);
    else toast.success("বই বিতরণ সফল");
    setRows([{ bookId: "", quantity: 1 }]);
  };

  const handleReturn = (issueId: string, max: number) => {
    const input = prompt(`কত পরিমাণ ফেরত (সর্বোচ্চ ${max})?`, String(max));
    if (!input) return;
    const n = parseInt(input);
    if (isNaN(n) || n <= 0) return toast.error("সঠিক পরিমাণ দিন");
    const ok = returnFromStudent(issueId, n);
    if (!ok) return toast.error("ফেরত ব্যর্থ");
    toast.success("ফেরত সম্পন্ন");
  };

  const studentIssues = selectedStudent ? issues.filter((i) => i.studentId === selectedStudent.id) : [];

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle>শিক্ষার্থীকে বই বিতরণ (মেইন স্টক থেকে)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>শিক্ষার্থী খুঁজুন (ID/নাম/মোবাইল)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="খুঁজুন..." />
          </div>
          <div>
            <Label>শিক্ষার্থী নির্বাচন</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                {filteredStudents.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.studentId} - {s.name} ({s.mobile})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedStudent && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div><span className="text-muted-foreground">নাম:</span> {selectedStudent.name}</div>
              <div><span className="text-muted-foreground">কোর্স:</span> {selectedStudent.course}</div>
              <div><span className="text-muted-foreground">ব্যাচ:</span> {batches.find((b) => b.id === selectedStudent.batchId)?.name || "—"}</div>
            </div>
          )}

          <div>
            <Label>ইস্যু তারিখ</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>বইসমূহ (একাধিক)</Label>
            {rows.map((row, i) => {
              const selected = books.find((b) => b.id === row.bookId);
              return (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={row.bookId} onValueChange={(v) => updateRow(i, { bookId: v })}>
                      <SelectTrigger><SelectValue placeholder="বই নির্বাচন করুন" /></SelectTrigger>
                      <SelectContent>
                        {books.map((b) => (
                          <SelectItem key={b.id} value={b.id} disabled={b.totalStock <= 0}>
                            {b.name} (স্টক: {b.totalStock})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selected && (
                      <p className="text-xs text-muted-foreground mt-1">
                        অবশিষ্ট স্টক: {selected.totalStock}
                      </p>
                    )}
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => updateRow(i, { quantity: +e.target.value })}
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeRow(i)}
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="w-3 h-3 mr-1" />আরও বই যোগ করুন
            </Button>
          </div>

          <Button className="w-full" onClick={submit}>বিতরণ করুন</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedStudent ? `${selectedStudent.name}-এর ইস্যু ইতিহাস` : "চলমান ইস্যু"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(selectedStudent ? studentIssues : issues).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">কোনো ইস্যু নেই</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {!selectedStudent && <TableHead>শিক্ষার্থী</TableHead>}
                  <TableHead>বই</TableHead>
                  <TableHead>পরি.</TableHead><TableHead>ফেরত</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedStudent ? studentIssues : issues).map((i) => {
                  const student = students.find((s) => s.id === i.studentId);
                  const book = books.find((b) => b.id === i.bookId);
                  const remaining = i.quantity - i.returnedQuantity;
                  return (
                    <TableRow key={i.id}>
                      {!selectedStudent && (
                        <TableCell className="text-xs">{student?.name || i.studentId}</TableCell>
                      )}
                      <TableCell className="text-xs">{book?.name}</TableCell>
                      <TableCell>{i.quantity}</TableCell>
                      <TableCell>{i.returnedQuantity}</TableCell>
                      <TableCell>
                        <Badge variant={i.status === "ফেরত" ? "secondary" : i.status === "আংশিক ফেরত" ? "outline" : "default"}>
                          {i.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {remaining > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => handleReturn(i.id, remaining)}>
                            <Undo2 className="w-3 h-3 mr-1" />ফেরত
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- History ---------------- */
function HistoryTab() {
  const { history } = useBooks();
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? history : history.filter((h) => h.action === filter);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>স্টক ও বিতরণ ইতিহাস</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব</SelectItem>
              <SelectItem value="স্টক যোগ">স্টক যোগ</SelectItem>
              <SelectItem value="স্টক কমানো">স্টক কমানো</SelectItem>
              <SelectItem value="ব্রাঞ্চে স্থানান্তর">ব্রাঞ্চে স্থানান্তর</SelectItem>
              <SelectItem value="শিক্ষার্থীকে বিতরণ">শিক্ষার্থীকে বিতরণ</SelectItem>
              <SelectItem value="শিক্ষার্থী থেকে ফেরত">শিক্ষার্থী থেকে ফেরত</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">কোনো ইতিহাস নেই</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>তারিখ</TableHead><TableHead>একশন</TableHead>
                <TableHead>বই</TableHead><TableHead>ব্রাঞ্চ</TableHead>
                <TableHead>শিক্ষার্থী</TableHead><TableHead>পরিমাণ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-xs">{new Date(h.date).toLocaleString("bn-BD")}</TableCell>
                  <TableCell><Badge variant="outline">{h.action}</Badge></TableCell>
                  <TableCell>{h.bookName}</TableCell>
                  <TableCell>{h.branchName || "-"}</TableCell>
                  <TableCell>{h.studentName || "-"}</TableCell>
                  <TableCell className="font-bold">{h.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
