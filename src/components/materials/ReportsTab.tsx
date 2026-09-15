import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { api } from "@/lib/apiClient";
import { exportExcel, printReport } from "@/lib/exporters";
import type {
  DistributionReportRow, MaterialWiseReportRow, StockReportRow, StudentWiseReportRow,
} from "@/types/material";

interface CommonFilters {
  dateFrom: string;
  dateTo: string;
  courseId: string;
  batchId: string;
}

const DEFAULT_FILTERS: CommonFilters = { dateFrom: "", dateTo: "", courseId: "all", batchId: "all" };

function buildQuery(f: CommonFilters, extra?: Record<string, string>): URLSearchParams {
  const qs = new URLSearchParams(extra);
  if (f.dateFrom) qs.set("dateFrom", f.dateFrom);
  if (f.dateTo) qs.set("dateTo", f.dateTo);
  if (f.courseId !== "all") qs.set("courseId", f.courseId);
  if (f.batchId !== "all") qs.set("batchId", f.batchId);
  return qs;
}

export function ReportsTab() {
  const { activeCourses } = useAcademic();
  const { batches } = useBatches();
  const [filters, setFilters] = useState<CommonFilters>(DEFAULT_FILTERS);
  const [reportTab, setReportTab] = useState("stock");

  const set = <K extends keyof CommonFilters>(k: K, v: CommonFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1"><label className="text-xs text-muted-foreground">শুরুর তারিখ</label><Input type="date" value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} /></div>
          <div className="space-y-1"><label className="text-xs text-muted-foreground">শেষ তারিখ</label><Input type="date" value={filters.dateTo} onChange={(e) => set("dateTo", e.target.value)} /></div>
          <Select value={filters.courseId} onValueChange={(v) => set("courseId", v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="কোর্স" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল কোর্স</SelectItem>{activeCourses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
          </Select>
          <Select value={filters.batchId} onValueChange={(v) => set("batchId", v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="ব্যাচ" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল ব্যাচ</SelectItem>{batches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs value={reportTab} onValueChange={setReportTab}>
        <TabsList className="bg-card border flex-wrap h-auto">
          <TabsTrigger value="stock">স্টক রিপোর্ট</TabsTrigger>
          <TabsTrigger value="distribution">বিতরণ রিপোর্ট</TabsTrigger>
          <TabsTrigger value="student">শিক্ষার্থী-ভিত্তিক</TabsTrigger>
          <TabsTrigger value="material">ম্যাটেরিয়াল-ভিত্তিক</TabsTrigger>
        </TabsList>
        <TabsContent value="stock" className="pt-4"><StockReportView filters={filters} /></TabsContent>
        <TabsContent value="distribution" className="pt-4"><DistributionReportView filters={filters} /></TabsContent>
        <TabsContent value="student" className="pt-4"><StudentWiseReportView filters={filters} /></TabsContent>
        <TabsContent value="material" className="pt-4"><MaterialWiseReportView filters={filters} /></TabsContent>
      </Tabs>
    </div>
  );
}

function StockReportView({ filters }: { filters: CommonFilters }) {
  const [rows, setRows] = useState<StockReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<StockReportRow[]>(`/materials/reports/stock?${buildQuery(filters).toString()}`)
      .then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [filters]);

  const headers = ["ম্যাটেরিয়াল", "টাইপ", "কোর্স", "বর্তমান স্টক", "মিনিমাম স্টক", "অবস্থা"];
  const dataRows = rows.map((r) => [r.name, r.materialType, r.courseName || "—", r.currentStock, r.minimumStock, r.outOfStock ? "স্টকে নেই" : r.lowStock ? "লো স্টক" : "ঠিক আছে"]);

  return (
    <ReportCard title="স্টক রিপোর্ট" filename="stock-report" headers={headers} rows={dataRows} loading={loading}>
      <Table>
        <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.materialId}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell><Badge variant="outline">{r.materialType}</Badge></TableCell>
              <TableCell>{r.courseName || "—"}</TableCell>
              <TableCell>{r.currentStock}</TableCell>
              <TableCell>{r.minimumStock}</TableCell>
              <TableCell>
                {r.outOfStock ? <Badge className="bg-destructive/10 text-destructive border-destructive/20">স্টকে নেই</Badge>
                  : r.lowStock ? <Badge className="bg-warning/10 text-warning border-warning/20">লো স্টক</Badge>
                  : <Badge className="bg-success/10 text-success border-success/20">ঠিক আছে</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ReportCard>
  );
}

function DistributionReportView({ filters }: { filters: CommonFilters }) {
  const [rows, setRows] = useState<DistributionReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getWithMeta<DistributionReportRow[]>(`/materials/reports/distribution?${buildQuery(filters, { limit: "500" }).toString()}`)
      .then((res) => setRows(res.data)).catch(() => setRows([])).finally(() => setLoading(false));
  }, [filters]);

  const headers = ["তারিখ", "শিক্ষার্থী", "রোল", "রেজিস্ট্রেশন", "কোর্স", "ব্যাচ", "ম্যাটেরিয়াল", "পরিমাণ", "Free/Paid", "মূল্য", "বিতরণকারী"];
  const dataRows = rows.map((r) => [r.date, r.studentName, r.studentRoll || "—", r.registrationId || "—", r.courseName || "—", r.batchName || "—", r.materialName, r.quantity, r.isPaid ? "Paid" : "Free", r.price, r.distributedBy]);

  return (
    <ReportCard title="বিতরণ রিপোর্ট" filename="distribution-report" headers={headers} rows={dataRows} loading={loading}>
      <Table>
        <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="text-sm">{r.date}</TableCell>
              <TableCell>{r.studentName}</TableCell>
              <TableCell className="text-sm">{r.studentRoll || "—"}</TableCell>
              <TableCell className="text-sm">{r.registrationId || "—"}</TableCell>
              <TableCell className="text-sm">{r.courseName || "—"}</TableCell>
              <TableCell className="text-sm">{r.batchName || "—"}</TableCell>
              <TableCell>{r.materialName}</TableCell>
              <TableCell>{r.quantity}</TableCell>
              <TableCell>{r.isPaid ? <Badge variant="outline">Paid</Badge> : <Badge variant="outline" className="bg-info/10 text-info border-info/20">Free</Badge>}</TableCell>
              <TableCell>{r.price > 0 ? `৳ ${r.price}` : "—"}</TableCell>
              <TableCell className="text-sm">{r.distributedBy}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ReportCard>
  );
}

function StudentWiseReportView({ filters }: { filters: CommonFilters }) {
  const [rows, setRows] = useState<StudentWiseReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<StudentWiseReportRow[]>(`/materials/reports/student-wise?${buildQuery(filters).toString()}`)
      .then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [filters]);

  const headers = ["শিক্ষার্থী", "রোল", "কোর্স", "ব্যাচ", "মোট ম্যাটেরিয়াল", "মোট পরিমাণ", "মোট পেইড মূল্য"];
  const dataRows = rows.map((r) => [r.studentName, r.studentRoll || "—", r.courseName || "—", r.batchName || "—", r.totalMaterials, r.totalQuantity, r.totalPaidValue]);

  return (
    <ReportCard title="শিক্ষার্থী-ভিত্তিক রিপোর্ট" filename="student-wise-report" headers={headers} rows={dataRows} loading={loading}>
      <Table>
        <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.studentId}>
              <TableCell className="font-medium">{r.studentName}</TableCell>
              <TableCell className="text-sm">{r.studentRoll || "—"}</TableCell>
              <TableCell className="text-sm">{r.courseName || "—"}</TableCell>
              <TableCell className="text-sm">{r.batchName || "—"}</TableCell>
              <TableCell>{r.totalMaterials}</TableCell>
              <TableCell>{r.totalQuantity}</TableCell>
              <TableCell>৳ {r.totalPaidValue.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ReportCard>
  );
}

function MaterialWiseReportView({ filters }: { filters: CommonFilters }) {
  const [rows, setRows] = useState<MaterialWiseReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<MaterialWiseReportRow[]>(`/materials/reports/material-wise?${buildQuery(filters).toString()}`)
      .then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [filters]);

  const headers = ["ম্যাটেরিয়াল", "মোট স্টক", "মোট বিতরণ", "বাকি স্টক"];
  const dataRows = rows.map((r) => [r.name, r.totalStock, r.totalDistributed, r.remainingStock]);

  return (
    <ReportCard title="ম্যাটেরিয়াল-ভিত্তিক রিপোর্ট" filename="material-wise-report" headers={headers} rows={dataRows} loading={loading}>
      <Table>
        <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.materialId}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>{r.totalStock}</TableCell>
              <TableCell>{r.totalDistributed}</TableCell>
              <TableCell>{r.remainingStock}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ReportCard>
  );
}

function ReportCard({ title, filename, headers, rows, loading, children }: {
  title: string; filename: string; headers: string[]; rows: (string | number)[][]; loading: boolean; children: React.ReactNode;
}) {
  return (
    <Card className="border-none shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <p className="text-sm text-muted-foreground">{rows.length.toLocaleString("bn-BD")}টি সারি</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportExcel({ filename, title, headers, rows })} disabled={rows.length === 0}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => printReport(title, headers, rows)} disabled={rows.length === 0}>
            <Printer className="h-3.5 w-3.5 mr-1.5" /> প্রিন্ট
          </Button>
        </div>
      </div>
      {loading ? (
        <CardContent className="py-12 text-center text-muted-foreground">লোড হচ্ছে...</CardContent>
      ) : rows.length === 0 ? (
        <CardContent className="py-12 text-center text-muted-foreground">কোনো তথ্য পাওয়া যায়নি।</CardContent>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </Card>
  );
}
