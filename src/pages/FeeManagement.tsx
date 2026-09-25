import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { formatStudentLabel, studentIdentifierLabel } from "@/lib/studentDisplay";
import { useStudents, fromApi, type ApiStudent } from "@/contexts/StudentContext";
import { usePayments, fromApi as paymentFromApi, type ApiPayment } from "@/contexts/PaymentContext";
import { useBatches } from "@/contexts/BatchContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { useAuth, ApiClientError, hasPermission } from "@/contexts/AuthContext";
import { PAYMENTS_DELETE } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { CalendarIcon, Plus, Search, DollarSign, AlertCircle, TrendingUp, Package, Check, ChevronsUpDown, Receipt as ReceiptIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import { toast } from "sonner";
import { FEE_TYPES } from "@/types/student";
import type { Student, Payment } from "@/types/student";
import { StatCard } from "@/components/StatCard";
import { api } from "@/lib/apiClient";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const DUE_PAGE_SIZE = 20;

interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const FeeManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCancelPayments = hasPermission(user, PAYMENTS_DELETE);
  const { refreshStudents } = useStudents();
  const { courses, activePaymentMethods } = useAcademic();
  const { batches } = useBatches();
  const { payments, addPayment, cancelPayment } = usePayments();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [filterFeeType, setFilterFeeType] = useState("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterBatch, setFilterBatch] = useState("all");
  const [filterDueStatus, setFilterDueStatus] = useState<"has" | "none" | "all">("has");
  const [duePage, setDuePage] = useState(1);

  // Server-computed (dashboard.service.ts already excludes cancelled
  // payments) — never summed here from PaymentContext's own capped
  // ≤100-row list, which would both under-count past that cap AND
  // double-count a cancelled payment still sitting in that cache
  // (Fees/Payment audit §5/§12).
  const [todayCollection, setTodayCollection] = useState(0);
  useEffect(() => {
    api.get<{ todayCollection: number }>("/dashboard/admin").then((s) => setTodayCollection(s.todayCollection)).catch(() => {});
  }, []);

  // Due-list summary cards — a global aggregate over EVERY due student
  // (not just the current page), computed server-side in one query
  // (GET /students/stats/due) instead of summing StudentContext's own
  // capped ≤100-row list, which would silently under-report totalDue/
  // packageDue/monthlyDue once total students exceed that cap.
  const [dueStats, setDueStats] = useState({ totalDue: 0, packageDue: 0, monthlyDue: 0 });
  const buildDueParams = useCallback(() => {
    const qs = new URLSearchParams();
    if (filterDueStatus !== "all") qs.set("dueStatus", filterDueStatus);
    if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
    if (filterFeeType !== "all") qs.set("feeType", filterFeeType);
    if (filterCourse !== "all") qs.set("courseId", filterCourse);
    if (filterBatch !== "all") qs.set("batchId", filterBatch);
    return qs;
  }, [debouncedSearch, filterFeeType, filterCourse, filterBatch, filterDueStatus]);

  useEffect(() => {
    const qs = buildDueParams();
    api.get<typeof dueStats>(`/students/stats/due?${qs.toString()}`).then(setDueStats).catch(() => {});
  }, [buildDueParams]);

  // Due-list table — server-paginated, same filter the stats call above uses.
  const [dueStudents, setDueStudents] = useState<Student[]>([]);
  const [dueMeta, setDueMeta] = useState<ListMeta | null>(null);
  const [dueLoading, setDueLoading] = useState(true);
  const loadDueStudents = useCallback(() => {
    setDueLoading(true);
    const qs = buildDueParams();
    qs.set("page", String(duePage));
    qs.set("limit", String(DUE_PAGE_SIZE));
    api.getWithMeta<ApiStudent[]>(`/students?${qs.toString()}`)
      .then((res) => { setDueStudents(res.data.map(fromApi)); setDueMeta((res.meta as unknown as ListMeta) ?? null); })
      .catch(() => { setDueStudents([]); setDueMeta(null); })
      .finally(() => setDueLoading(false));
  }, [buildDueParams, duePage]);
  useEffect(() => { loadDueStudents(); }, [loadDueStudents]);
  useEffect(() => { setDuePage(1); }, [debouncedSearch, filterFeeType, filterCourse, filterBatch, filterDueStatus]);

  // Payment History tab — real server-side pagination + filters (Fees/Payment
  // audit §6/§12), independent of PaymentContext's own most-recent-100 cache
  // (which also always excludes cancelled payments — History needs to show
  // them, badged). includeCancelled=true is the one place in the whole app
  // that asks for it.
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState("");
  const debouncedHistorySearch = useDebouncedValue(historySearch, 350);
  const [historyMethod, setHistoryMethod] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyItems, setHistoryItems] = useState<Payment[]>([]);
  const [historyMeta, setHistoryMeta] = useState<ListMeta | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const buildHistoryParams = useCallback(() => {
    const qs = new URLSearchParams({ includeCancelled: "true", sortBy: "date", sortOrder: "desc" });
    if (debouncedHistorySearch.trim()) qs.set("search", debouncedHistorySearch.trim());
    if (historyMethod !== "all") qs.set("method", historyMethod);
    if (historyFrom) qs.set("dateFrom", historyFrom);
    if (historyTo) qs.set("dateTo", historyTo);
    return qs;
  }, [debouncedHistorySearch, historyMethod, historyFrom, historyTo]);
  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    const qs = buildHistoryParams();
    qs.set("page", String(historyPage));
    qs.set("limit", "20");
    api.getWithMeta<ApiPayment[]>(`/payments?${qs.toString()}`)
      .then((res) => { setHistoryItems(res.data.map(paymentFromApi)); setHistoryMeta((res.meta as unknown as ListMeta) ?? null); })
      .catch(() => { setHistoryItems([]); setHistoryMeta(null); })
      .finally(() => setHistoryLoading(false));
  }, [buildHistoryParams, historyPage]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { setHistoryPage(1); }, [debouncedHistorySearch, historyMethod, historyFrom, historyTo]);

  // Payment History tab's per-row student name — one batched lookup for
  // every distinct studentId on the CURRENT page of `historyItems`, instead
  // of one `students.find()` per row against StudentContext's separately-
  // capped list.
  const [paymentStudents, setPaymentStudents] = useState<Record<string, Student>>({});
  useEffect(() => {
    const ids = Array.from(new Set(historyItems.map((p) => p.studentId))).filter(Boolean);
    if (ids.length === 0) { setPaymentStudents({}); return; }
    let cancelled = false;
    api.get<ApiStudent[]>(`/students?ids=${ids.join(",")}&limit=${ids.length}`)
      .then((docs) => {
        if (cancelled) return;
        const map: Record<string, Student> = {};
        for (const doc of docs) map[doc._id] = fromApi(doc);
        setPaymentStudents(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [historyItems]);

  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const handleCancelPayment = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelPayment(cancelTarget.id);
      toast.success("পেমেন্ট বাতিল করা হয়েছে");
      setCancelTarget(null);
      loadHistory();
      loadDueStudents();
      refreshStudents();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "বাতিল করা যায়নি");
    } finally {
      setCancelling(false);
    }
  };

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
          <StatCard title="মোট বকেয়া" value={`৳ ${dueStats.totalDue.toLocaleString()}`} icon={AlertCircle} variant="warning" />
          <StatCard title="প্যাকেজ বকেয়া" value={`৳ ${dueStats.packageDue.toLocaleString()}`} icon={Package} variant="info" />
          <StatCard title="মাসিক বকেয়া" value={`৳ ${dueStats.monthlyDue.toLocaleString()}`} icon={TrendingUp} variant="primary" />
          <StatCard title="আজকের আদায়" value={`৳ ${todayCollection.toLocaleString()}`} icon={DollarSign} variant="success" />
        </div>

        <Tabs defaultValue="due" className="space-y-4">
          <TabsList className="bg-card border">
            <TabsTrigger value="due">বকেয়া তালিকা</TabsTrigger>
            <TabsTrigger value="history">পেমেন্ট ইতিহাস</TabsTrigger>
          </TabsList>

          <TabsContent value="due">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="নাম, রেজিস্ট্রেশন নম্বর, আইডি বা মোবাইল দিয়ে খুঁজুন..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={filterCourse} onValueChange={setFilterCourse}>
                    <SelectTrigger className="sm:w-[180px]"><SelectValue placeholder="কোর্স" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">সব কোর্স</SelectItem>
                      {courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={filterBatch} onValueChange={setFilterBatch}>
                    <SelectTrigger className="sm:w-[180px]"><SelectValue placeholder="ব্যাচ" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">সব ব্যাচ</SelectItem>
                      {batches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={filterFeeType} onValueChange={setFilterFeeType}>
                    <SelectTrigger className="sm:w-[160px]">
                      <SelectValue placeholder="ফি ধরন" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">সব ধরন</SelectItem>
                      <SelectItem value="এককালীন">এককালীন</SelectItem>
                      <SelectItem value="মাসিক">মাসিক</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterDueStatus} onValueChange={(v) => setFilterDueStatus(v as typeof filterDueStatus)}>
                    <SelectTrigger className="sm:w-[160px]"><SelectValue placeholder="বকেয়া অবস্থা" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="has">শুধু বকেয়া আছে</SelectItem>
                      <SelectItem value="none">সম্পূর্ণ পরিশোধিত</SelectItem>
                      <SelectItem value="all">সব শিক্ষার্থী</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Registration ID</TableHead>
                      <TableHead>রেজিস্ট্রেশন নম্বর</TableHead>
                      <TableHead>নাম</TableHead>
                      <TableHead>কোর্স</TableHead>
                      <TableHead>ফি ধরন</TableHead>
                      <TableHead className="text-right">কোর্স ফি</TableHead>
                      <TableHead className="text-right">ছাড়</TableHead>
                      <TableHead className="text-right">মোট ফি</TableHead>
                      <TableHead className="text-right">পরিশোধিত</TableHead>
                      <TableHead className="text-right">বকেয়া</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                      ))
                    ) : dueStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          কোনো শিক্ষার্থী পাওয়া যায়নি
                        </TableCell>
                      </TableRow>
                    ) : (
                      dueStudents.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">{s.studentId}</TableCell>
                          <TableCell className="font-mono text-xs">{s.rollNumber || "—"}</TableCell>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>{s.course}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={s.feeType === "এককালীন" ? "bg-info/10 text-info border-info/20" : "bg-primary/10 text-primary border-primary/20"}>
                              {s.feeType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">৳ {s.totalCourseFee.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{s.discount > 0 ? `৳ ${s.discount.toLocaleString()}` : "—"}</TableCell>
                          <TableCell className="text-right">৳ {s.totalFee.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-success">৳ {s.paid.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-destructive font-semibold">৳ {s.due.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {dueMeta && dueMeta.totalPages > 1 && (
                  <div className="flex items-center justify-end p-4 border-t">
                    <Pagination className="mx-0 w-auto">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            className={dueMeta.page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            onClick={() => dueMeta.page > 1 && setDuePage(dueMeta.page - 1)}
                          />
                        </PaginationItem>
                        {Array.from({ length: dueMeta.totalPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === dueMeta.totalPages || Math.abs(p - dueMeta.page) <= 1)
                          .map((p, idx, arr) => (
                            <PaginationItem key={p}>
                              {idx > 0 && arr[idx - 1] !== p - 1 ? <span className="px-2 text-muted-foreground">…</span> : null}
                              <PaginationLink isActive={p === dueMeta.page} className="cursor-pointer" onClick={() => setDuePage(p)}>
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                        <PaginationItem>
                          <PaginationNext
                            className={dueMeta.page >= dueMeta.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            onClick={() => dueMeta.page < dueMeta.totalPages && setDuePage(dueMeta.page + 1)}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="রসিদ নং, নাম, রেজিস্ট্রেশন নম্বর বা মোবাইল দিয়ে খুঁজুন..."
                    className="pl-9"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={historyMethod} onValueChange={setHistoryMethod}>
                    <SelectTrigger className="sm:w-[160px]"><SelectValue placeholder="পদ্ধতি" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">সব পদ্ধতি</SelectItem>
                      {activePaymentMethods.map((m) => (<SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Input type="date" className="sm:w-[160px]" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} placeholder="তারিখ থেকে" />
                  <Input type="date" className="sm:w-[160px]" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} placeholder="তারিখ পর্যন্ত" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>রসিদ নং</TableHead>
                      <TableHead>তারিখ</TableHead>
                      <TableHead>শিক্ষার্থী</TableHead>
                      <TableHead>রেজি. আইডি</TableHead>
                      <TableHead>রেজিস্ট্রেশন নম্বর</TableHead>
                      <TableHead>কোর্স</TableHead>
                      <TableHead>ব্যাচ</TableHead>
                      <TableHead>ফি ধরন</TableHead>
                      <TableHead>মাস</TableHead>
                      <TableHead className="text-right">পরিমাণ</TableHead>
                      <TableHead className="text-right">ছাড়</TableHead>
                      <TableHead className="text-right">জরিমানা</TableHead>
                      <TableHead className="text-right">পরিশোধিত</TableHead>
                      <TableHead>পদ্ধতি</TableHead>
                      <TableHead>উৎস</TableHead>
                      <TableHead>স্ট্যাটাস</TableHead>
                      <TableHead className="text-right">অ্যাকশন</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={17}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                      ))
                    ) : historyItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={17} className="text-center text-muted-foreground py-8">কোনো পেমেন্ট নেই</TableCell>
                      </TableRow>
                    ) : (
                      historyItems.map((p) => {
                        const student = paymentStudents[p.studentId];
                        const isCancelled = p.status === "cancelled";
                        return (
                          <TableRow key={p.id} className={isCancelled ? "opacity-60" : undefined}>
                            <TableCell className="font-mono text-xs">{p.receiptNo}</TableCell>
                            <TableCell>{p.date}</TableCell>
                            <TableCell className={cn("font-medium", isCancelled && "line-through")}>
                              {student ? student.name : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{student?.studentId || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{student?.rollNumber || "—"}</TableCell>
                            <TableCell>{student?.course || "—"}</TableCell>
                            <TableCell>{batches.find((b) => b.id === student?.batchId)?.name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{p.feeType}</Badge>
                            </TableCell>
                            <TableCell>{p.month || "—"}</TableCell>
                            <TableCell className="text-right">৳ {p.amount.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{p.discount > 0 ? `৳ ${p.discount.toLocaleString()}` : "—"}</TableCell>
                            <TableCell className="text-right">{p.fine > 0 ? `৳ ${p.fine.toLocaleString()}` : "—"}</TableCell>
                            <TableCell className={cn("text-right font-semibold", isCancelled ? "text-muted-foreground line-through" : "text-success")}>৳ {p.paidAmount.toLocaleString()}</TableCell>
                            <TableCell>{p.method}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{p.source === "admission" ? "ভর্তি" : p.source === "material" ? "ম্যাটেরিয়াল" : "নিয়মিত"}</TableCell>
                            <TableCell>
                              {isCancelled ? (
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">বাতিল</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">সক্রিয়</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={() => navigate(`/payments/${p.id}/receipt`)}>
                                  <ReceiptIcon className="h-4 w-4" />
                                </Button>
                                {canCancelPayments && !isCancelled && (
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setCancelTarget(p)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                </div>
                {historyMeta && historyMeta.totalPages > 1 && (
                  <div className="flex items-center justify-end p-4 border-t">
                    <Pagination className="mx-0 w-auto">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            className={historyMeta.page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            onClick={() => historyMeta.page > 1 && setHistoryPage(historyMeta.page - 1)}
                          />
                        </PaginationItem>
                        {Array.from({ length: historyMeta.totalPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === historyMeta.totalPages || Math.abs(p - historyMeta.page) <= 1)
                          .map((p, idx, arr) => (
                            <PaginationItem key={p}>
                              {idx > 0 && arr[idx - 1] !== p - 1 ? <span className="px-2 text-muted-foreground">…</span> : null}
                              <PaginationLink isActive={p === historyMeta.page} className="cursor-pointer" onClick={() => setHistoryPage(p)}>
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                        <PaginationItem>
                          <PaginationNext
                            className={historyMeta.page >= historyMeta.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            onClick={() => historyMeta.page < historyMeta.totalPages && setHistoryPage(historyMeta.page + 1)}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <AlertDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>আপনি কি এই payment transaction টি delete/cancel করতে চান?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">রসিদ নং:</span><span className="font-mono">{cancelTarget?.receiptNo}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">শিক্ষার্থী:</span><span>{cancelTarget ? paymentStudents[cancelTarget.studentId]?.name || "—" : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">পরিমাণ:</span><span className="font-semibold">৳ {cancelTarget?.paidAmount.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">তারিখ:</span><span>{cancelTarget?.date}</span></div>
                  <p className="pt-2 text-xs">বাতিল করলে শিক্ষার্থীর পরিশোধিত পরিমাণ ও বকেয়া স্বয়ংক্রিয়ভাবে সংশোধন হবে। এই কাজটি পূর্বাবস্থায় ফেরানো যায় না।</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>না</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelPayment} disabled={cancelling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {cancelling ? "বাতিল হচ্ছে..." : "হ্যাঁ, বাতিল করুন"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          addPayment={addPayment}
          onSuccess={(p) => { refreshStudents(); navigate(`/payments/${p.id}/receipt`); }}
        />
      </div>
    </DashboardLayout>
  );
};

function PaymentDialog({
  open,
  onOpenChange,
  addPayment,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  addPayment: (p: Omit<Payment, "id" | "receiptNo"> & { idempotencyKey?: string }) => Promise<Payment>;
  onSuccess?: (p: Payment) => void;
}) {
  const { batches } = useBatches();
  const { activePaymentMethods } = useAcademic();
  const [studentId, setStudentId] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  // Searched directly against the server (GET /students?search=), never
  // filtered from StudentContext's own capped ≤100-row global list — a
  // student outside that cap would otherwise be impossible to select here
  // at all, which is a hard block on collecting their payment, not just slow.
  const [pickerSearch, setPickerSearch] = useState("");
  const debouncedPickerSearch = useDebouncedValue(pickerSearch, 300);
  const [pickerOptions, setPickerOptions] = useState<Student[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  useEffect(() => {
    if (!studentPickerOpen) return;
    let cancelled = false;
    setPickerLoading(true);
    const qs = new URLSearchParams({ limit: "20" });
    if (debouncedPickerSearch.trim()) qs.set("search", debouncedPickerSearch.trim());
    api.get<ApiStudent[]>(`/students?${qs.toString()}`)
      .then((docs) => { if (!cancelled) setPickerOptions(docs.map(fromApi)); })
      .catch(() => { if (!cancelled) setPickerOptions([]); })
      .finally(() => { if (!cancelled) setPickerLoading(false); });
    return () => { cancelled = true; };
  }, [studentPickerOpen, debouncedPickerSearch]);
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
      setSelectedStudent(null);
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
                      ? formatStudentLabel({ name: selectedStudent.name, rollNumber: selectedStudent.rollNumber, systemId: selectedStudent.studentId })
                      : "শিক্ষার্থী খুঁজুন বা নির্বাচন করুন"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)] p-0 bg-popover" align="start">
                {/* shouldFilter=false — the list below is already exactly the
                    server's own search result (GET /students?search=), so
                    cmdk must not re-filter it client-side against whatever
                    partial/older set happens to be in `pickerOptions`. */}
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="আইডি, রেজিস্ট্রেশন নম্বর, নাম বা মোবাইল দিয়ে খুঁজুন..."
                    value={pickerSearch}
                    onValueChange={setPickerSearch}
                  />
                  <CommandList className="max-h-[40vh]">
                    {pickerLoading ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">খোঁজা হচ্ছে...</p>
                    ) : (
                      <>
                        <CommandEmpty>কোনো শিক্ষার্থী পাওয়া যায়নি</CommandEmpty>
                        <CommandGroup>
                          {pickerOptions.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={s.id}
                              onSelect={(v) => {
                                setStudentId(v);
                                const st = pickerOptions.find((x) => x.id === v);
                                if (st) { setSelectedStudent(st); setFeeType(st.feeType); }
                                setStudentPickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", studentId === s.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium truncate">{s.name} <span className="text-xs text-muted-foreground font-mono">({studentIdentifierLabel({ rollNumber: s.rollNumber, systemId: s.studentId })})</span></span>
                                <span className="text-xs text-muted-foreground truncate">{s.mobile} • বকেয়া: ৳{s.due.toLocaleString()}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
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
                <span className="text-muted-foreground shrink-0">কোর্স ফি:</span>
                <span>৳ {selectedStudent.totalCourseFee.toLocaleString()}</span>
              </div>
              {selectedStudent.discount > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">ছাড়:</span>
                  <span>৳ {selectedStudent.discount.toLocaleString()}</span>
                </div>
              )}
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
          {selectedStudent && paidAmount > selectedStudent.due && (
            <p className="text-xs text-destructive text-center">
              এই পরিমাণ বর্তমান বকেয়ার (৳ {selectedStudent.due.toLocaleString()}) চেয়ে বেশি — সার্ভার এটি গ্রহণ করবে না।
            </p>
          )}

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

export default FeeManagement;
