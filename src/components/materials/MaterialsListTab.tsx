import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDown, ClipboardEdit, Eye, History, MoreVertical, Package, PackagePlus, Pencil, Plus, Power, Search, Send, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, ListSkeleton } from "@/components/dashboard/DashboardKit";
import { useAcademic } from "@/contexts/AcademicContext";
import { useMaterials } from "@/contexts/MaterialContext";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { stockLevel, type Material, type MaterialDistribution, type StockMovement } from "@/types/material";
import { MaterialFormDialog } from "./MaterialFormDialog";
import { ApiClientError } from "@/contexts/AuthContext";

type StockFilter = "all" | "available" | "low" | "out";
type PaidFilter = "all" | "free" | "paid";
type StatusFilter = "all" | "active" | "inactive";
type Sort = "name" | "stock_asc" | "stock_desc" | "type" | "price_desc";
const PAGE_SIZE = 15;

const MOVEMENT_LABELS: Record<StockMovement["movementType"], string> = { IN: "স্টক যোগ", DISTRIBUTION: "বিতরণ", ADJUSTMENT: "সংশোধন", REVERSAL: "বিতরণ বাতিল" };

/** Stock badge + bar: colour plus text, never colour alone. */
export function StockIndicator({ m, compact }: { m: Material; compact?: boolean }) {
  const level = stockLevel(m);
  const label = level === "out" ? "স্টকে নেই" : level === "low" ? "কম স্টক" : "উপলব্ধ";
  const tone = level === "out" ? "text-destructive" : level === "low" ? "text-warning" : "text-success";
  const bar = level === "out" ? "bg-destructive" : level === "low" ? "bg-warning" : "bg-success";
  const scale = Math.max(m.currentStock, m.minimumStock * 3, 1);
  return (
    <div className={cn("min-w-[110px]", compact && "min-w-0")}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <b className={cn("text-sm tabular-nums", tone)}>{m.currentStock}</b>
        <span className={tone}>{label}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, (m.currentStock / scale) * 100)}%` }} /></div>
      {!compact && <p className="mt-0.5 text-[10px] text-muted-foreground">ন্যূনতম {m.minimumStock}</p>}
    </div>
  );
}

export function MaterialsListTab({ onDistribute, onChanged }: { onDistribute?: (materialId: string) => void; onChanged?: () => void }) {
  const { activeCourses, getSubject } = useAcademic();
  const { materials, materialTypes, addStock, adjustStock, setMaterialStatus, deleteMaterial, loading } = useMaterials();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [courseId, setCourseId] = useState("all");
  const [materialType, setMaterialType] = useState("all");
  const [paidFilter, setPaidFilter] = useState<PaidFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Material | null>(null);
  const [viewing, setViewing] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);

  const [stockDialog, setStockDialog] = useState<{ material: Material; mode: "add" | "adjust" } | null>(null);
  const [stockQty, setStockQty] = useState(1);
  const [stockReason, setStockReason] = useState("");
  const [adjustReason, setAdjustReason] = useState("পরিমাণ গণনা সংশোধন");
  const [savingStock, setSavingStock] = useState(false);

  const [historyDialog, setHistoryDialog] = useState<Material | null>(null);
  const [historyRows, setHistoryRows] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const courseName = (id: string) => activeCourses.find((c) => c.id === id)?.name || "—";

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const list = materials.filter((m) => {
      if (q && !(m.name.toLowerCase().includes(q) || m.materialType.toLowerCase().includes(q))) return false;
      if (courseId !== "all" && m.courseId !== courseId) return false;
      if (materialType !== "all" && m.materialType !== materialType) return false;
      if (paidFilter === "free" && m.isPaid) return false;
      if (paidFilter === "paid" && !m.isPaid) return false;
      const level = stockLevel(m);
      if (stockFilter !== "all" && (stockFilter === "available" ? level !== "ok" : level !== stockFilter)) return false;
      if (statusFilter === "active" && m.status !== "সক্রিয়") return false;
      if (statusFilter === "inactive" && m.status !== "নিষ্ক্রিয়") return false;
      return true;
    });
    const by: Record<Sort, (a: Material, b: Material) => number> = {
      name: (a, b) => a.name.localeCompare(b.name, "bn"),
      stock_asc: (a, b) => a.currentStock - b.currentStock,
      stock_desc: (a, b) => b.currentStock - a.currentStock,
      type: (a, b) => a.materialType.localeCompare(b.materialType, "bn") || a.name.localeCompare(b.name, "bn"),
      price_desc: (a, b) => (b.isPaid ? b.price : 0) - (a.isPaid ? a.price : 0),
    };
    return list.sort(by[sort]);
  }, [materials, debouncedSearch, courseId, materialType, paidFilter, stockFilter, statusFilter, sort]);
  useEffect(() => setPage(1), [debouncedSearch, courseId, materialType, paidFilter, stockFilter, statusFilter, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilters = [courseId !== "all", materialType !== "all", paidFilter !== "all", stockFilter !== "all", statusFilter !== "active", !!search].filter(Boolean).length;
  const resetFilters = () => { setSearch(""); setCourseId("all"); setMaterialType("all"); setPaidFilter("all"); setStockFilter("all"); setStatusFilter("active"); };

  const openAdd = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (m: Material) => { setViewing(null); setEditTarget(m); setFormOpen(true); };

  const openStockDialog = (material: Material, mode: "add" | "adjust") => {
    setStockDialog({ material, mode });
    setStockQty(mode === "add" ? 1 : 0);
    setStockReason("");
    setAdjustReason("পরিমাণ গণনা সংশোধন");
  };

  const submitStock = async () => {
    if (!stockDialog) return;
    if (stockDialog.mode === "add" && stockQty <= 0) { toast.error("পরিমাণ শূন্যের বেশি হতে হবে"); return; }
    if (stockDialog.mode === "adjust" && stockQty === 0) { toast.error("পরিবর্তনের পরিমাণ শূন্য হতে পারবে না"); return; }
    if (stockDialog.mode === "adjust" && stockDialog.material.currentStock + stockQty < 0) { toast.error(`স্টক শূন্যের নিচে যাবে না — সর্বোচ্চ ${stockDialog.material.currentStock} কমানো যায়`); return; }
    setSavingStock(true);
    try {
      if (stockDialog.mode === "add") {
        await addStock(stockDialog.material.id, stockQty, stockReason || undefined);
        toast.success(`${stockDialog.material.name}: ${stockQty}টি স্টক যোগ হয়েছে`);
      } else {
        await adjustStock(stockDialog.material.id, stockQty, adjustReason, stockReason || undefined);
        toast.success("স্টক সংশোধন করা হয়েছে");
      }
      setStockDialog(null);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSavingStock(false);
    }
  };

  const openHistory = async (m: Material) => {
    setHistoryDialog(m);
    setHistoryLoading(true);
    try {
      const res = await api.getWithMeta<{ _id: string; materialId: string; materialName: string; movementType: StockMovement["movementType"]; quantity: number; previousStock: number; newStock: number; reason?: string; createdAt: string }[]>(`/materials/${m.id}/stock/movements?limit=50`);
      setHistoryRows(res.data.map((d) => ({ id: d._id, materialId: d.materialId, materialName: d.materialName, movementType: d.movementType, quantity: d.quantity, previousStock: d.previousStock, newStock: d.newStock, reason: d.reason, createdAt: d.createdAt })));
    } catch {
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleActive = async (m: Material) => {
    try {
      await setMaterialStatus(m.id, m.status === "সক্রিয়" ? "নিষ্ক্রিয়" : "সক্রিয়");
      toast.success(m.status === "সক্রিয়" ? `${m.name} নিষ্ক্রিয় করা হয়েছে` : `${m.name} সক্রিয় করা হয়েছে`);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পরিবর্তন ব্যর্থ হয়েছে");
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMaterial(deleting.id);
      toast.success(`${deleting.name} মুছে ফেলা হয়েছে`);
      setViewing(null);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "মুছে ফেলা যায়নি");
    } finally {
      setDeleting(null);
    }
  };

  const menu = (m: Material) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`${m.name} — অ্যাকশন`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewing(m)}><Eye className="mr-2 h-4 w-4" />বিস্তারিত</DropdownMenuItem>
        {onDistribute && m.status === "সক্রিয়" && <DropdownMenuItem disabled={m.currentStock <= 0} onClick={() => onDistribute(m.id)}><Send className="mr-2 h-4 w-4" />বিতরণ করুন</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => openEdit(m)}><Pencil className="mr-2 h-4 w-4" />সম্পাদনা</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openStockDialog(m, "add")}><PackagePlus className="mr-2 h-4 w-4" />স্টক যোগ</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openStockDialog(m, "adjust")}><ClipboardEdit className="mr-2 h-4 w-4" />স্টক সংশোধন</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openHistory(m)}><History className="mr-2 h-4 w-4" />স্টক হিস্ট্রি</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => toggleActive(m)}><Power className="mr-2 h-4 w-4" />{m.status === "সক্রিয়" ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(m)}><Trash2 className="mr-2 h-4 w-4" />মুছে ফেলুন</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম বা টাইপ দিয়ে খুঁজুন..." className="pl-9" aria-label="ম্যাটেরিয়াল খুঁজুন" />
          </div>
          <div className="flex gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="w-full lg:w-44" aria-label="সাজান"><ArrowUpDown className="mr-1 h-3.5 w-3.5 opacity-60" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">নাম অনুযায়ী</SelectItem>
                <SelectItem value="stock_asc">স্টক (কম → বেশি)</SelectItem>
                <SelectItem value="stock_desc">স্টক (বেশি → কম)</SelectItem>
                <SelectItem value="type">টাইপ অনুযায়ী</SelectItem>
                <SelectItem value="price_desc">মূল্য (বেশি → কম)</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openAdd} className="shrink-0"><Plus className="h-4 w-4" />নতুন ম্যাটেরিয়াল</Button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger aria-label="কোর্স"><SelectValue placeholder="কোর্স" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল কোর্স</SelectItem>{activeCourses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={materialType} onValueChange={setMaterialType}>
            <SelectTrigger aria-label="টাইপ"><SelectValue placeholder="টাইপ" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল টাইপ</SelectItem>{materialTypes.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
            <SelectTrigger aria-label="স্টক"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল স্টক</SelectItem><SelectItem value="available">উপলব্ধ</SelectItem><SelectItem value="low">কম স্টক</SelectItem><SelectItem value="out">স্টকে নেই</SelectItem></SelectContent>
          </Select>
          <Select value={paidFilter} onValueChange={(v) => setPaidFilter(v as PaidFilter)}>
            <SelectTrigger aria-label="ফ্রি / পেইড"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">ফ্রি ও পেইড</SelectItem><SelectItem value="free">ফ্রি</SelectItem><SelectItem value="paid">পেইড</SelectItem></SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger aria-label="অবস্থা"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="active">সক্রিয়</SelectItem><SelectItem value="inactive">নিষ্ক্রিয়</SelectItem><SelectItem value="all">সকল অবস্থা</SelectItem></SelectContent>
          </Select>
        </div>
        {activeFilters > 0 && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length}টি ম্যাটেরিয়াল মিলেছে</span>
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 hover:text-foreground"><X className="h-3.5 w-3.5" />ফিল্টার মুছুন</button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {loading ? <div className="p-4"><ListSkeleton rows={6} /></div> : filtered.length === 0 ? (
          <EmptyState icon={Package} title={materials.length ? "এই ফিল্টারে কোনো ম্যাটেরিয়াল নেই" : "এখনো কোনো ম্যাটেরিয়াল যোগ করা হয়নি"} description={materials.length ? "ফিল্টার বদলে দেখুন।" : "নতুন ম্যাটেরিয়াল যোগ করে প্রারম্ভিক স্টক দিন — তারপর বিতরণ করা যাবে।"} action={materials.length ? <Button variant="outline" size="sm" onClick={resetFilters}>ফিল্টার মুছুন</Button> : <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" />নতুন ম্যাটেরিয়াল</Button>} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ম্যাটেরিয়াল</TableHead>
                    <TableHead>কোর্স / সাবজেক্ট</TableHead>
                    <TableHead>মূল্য</TableHead>
                    <TableHead>স্টক</TableHead>
                    <TableHead>অবস্থা</TableHead>
                    <TableHead className="w-12"><span className="sr-only">অ্যাকশন</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((m) => (
                    <TableRow key={m.id} className="cursor-pointer" onClick={() => setViewing(m)}>
                      <TableCell><span className="block font-medium">{m.name}</span><Badge variant="outline" className="mt-1 text-[11px]">{m.materialType}</Badge></TableCell>
                      <TableCell className="text-sm">{courseName(m.courseId)}{m.subjectId && <span className="block text-xs text-muted-foreground">{getSubject(m.subjectId)?.name}</span>}</TableCell>
                      <TableCell>{m.isPaid ? <span className="font-medium tabular-nums">৳ {m.price.toLocaleString()}</span> : <Badge variant="outline" className="border-info/20 bg-info/10 text-info">ফ্রি</Badge>}</TableCell>
                      <TableCell><StockIndicator m={m} /></TableCell>
                      <TableCell><Badge variant="outline" className={m.status === "সক্রিয়" ? "border-success/20 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>{m.status}</Badge></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>{menu(m)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden">
              {visible.map((m) => (
                <li key={m.id} className="flex items-start gap-3 px-3 py-3">
                  <button type="button" onClick={() => setViewing(m)} className="min-w-0 flex-1 text-left">
                    <p className="font-medium">{m.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.materialType} • {courseName(m.courseId)} • {m.isPaid ? `৳ ${m.price}` : "ফ্রি"}{m.status !== "সক্রিয়" ? " • নিষ্ক্রিয়" : ""}</p>
                    <div className="mt-2 max-w-[220px]"><StockIndicator m={m} compact /></div>
                  </button>
                  {menu(m)}
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <div className="flex items-center justify-between border-t px-3 py-2.5 text-sm sm:px-4">
                <span className="text-muted-foreground">{filtered.length}টির মধ্যে {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span>
                <span className="flex gap-1"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>আগের</Button><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>পরের</Button></span>
              </div>
            )}
          </>
        )}
      </Card>

      <MaterialFormDialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) onChanged?.(); }} editMaterial={editTarget} />
      <MaterialDetailSheet
        material={viewing ? materials.find((x) => x.id === viewing.id) ?? viewing : null}
        courseName={viewing ? courseName(viewing.courseId) : ""}
        subjectName={viewing?.subjectId ? getSubject(viewing.subjectId)?.name : undefined}
        onClose={() => setViewing(null)}
        onEdit={openEdit}
        onAddStock={(m) => openStockDialog(m, "add")}
        onDistribute={onDistribute}
      />

      <Dialog open={!!stockDialog} onOpenChange={(o) => !o && setStockDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{stockDialog?.mode === "add" ? "স্টক যোগ করুন" : "স্টক সংশোধন"}</DialogTitle>
            <DialogDescription>{stockDialog?.material.name} — বর্তমান স্টক: <b className="text-foreground">{stockDialog?.material.currentStock}</b></DialogDescription>
          </DialogHeader>
          {stockDialog && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="stock-qty">{stockDialog.mode === "add" ? "পরিমাণ (+)" : "পরিবর্তন (+/-)"}</Label>
                <Input id="stock-qty" type="number" value={stockQty} onChange={(e) => setStockQty(Number(e.target.value) || 0)} />
                <p className="text-xs text-muted-foreground">
                  {stockDialog.mode === "adjust" ? "যেমন: গণনায় ৩টি কম পাওয়া গেলে -3 লিখুন। " : ""}
                  সংরক্ষণের পর স্টক হবে <b className={cn(stockDialog.material.currentStock + (stockDialog.mode === "add" ? Math.max(0, stockQty) : stockQty) < 0 ? "text-destructive" : "text-foreground")}>{stockDialog.material.currentStock + (stockDialog.mode === "add" ? Math.max(0, stockQty) : stockQty)}</b>
                </p>
              </div>
              {stockDialog.mode === "adjust" && (
                <div className="space-y-1.5">
                  <Label>কারণ *</Label>
                  <Select value={adjustReason} onValueChange={setAdjustReason}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="পরিমাণ গণনা সংশোধন">গণনা সংশোধন</SelectItem>
                      <SelectItem value="ক্ষতিগ্রস্ত">ক্ষতিগ্রস্ত</SelectItem>
                      <SelectItem value="হারিয়ে গেছে">হারিয়ে গেছে</SelectItem>
                      <SelectItem value="অন্যান্য">অন্যান্য</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5"><Label htmlFor="stock-note">নোট (ঐচ্ছিক)</Label><Input id="stock-note" value={stockReason} onChange={(e) => setStockReason(e.target.value)} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setStockDialog(null)}>বাতিল</Button>
                <Button onClick={submitStock} disabled={savingStock}>{savingStock ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyDialog} onOpenChange={(o) => !o && setHistoryDialog(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>স্টক হিস্ট্রি — {historyDialog?.name}</DialogTitle></DialogHeader>
          {historyLoading ? <ListSkeleton rows={4} /> : historyRows.length === 0 ? <EmptyState compact icon={History} title="কোনো স্টক মুভমেন্ট নেই" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>তারিখ</TableHead><TableHead>ধরন</TableHead><TableHead className="text-right">পরিবর্তন</TableHead><TableHead className="text-right">আগে → পরে</TableHead><TableHead>কারণ</TableHead></TableRow></TableHeader>
                <TableBody>
                  {historyRows.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-sm">{new Date(h.createdAt).toLocaleString("bn-BD")}</TableCell>
                      <TableCell><Badge variant="outline">{MOVEMENT_LABELS[h.movementType] ?? h.movementType}</Badge></TableCell>
                      <TableCell className={cn("text-right font-semibold tabular-nums", h.quantity > 0 ? "text-success" : "text-destructive")}>{h.quantity > 0 ? `+${h.quantity}` : h.quantity}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{h.previousStock} → {h.newStock}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.reason || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleting?.name} — মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>শুধু কখনো বিতরণ হয়নি এমন ম্যাটেরিয়াল মোছা যায় (এর স্টক-ইন রেকর্ডসহ)। আগে বিতরণ হয়ে থাকলে মোছা যাবে না — সেক্ষেত্রে নিষ্ক্রিয় করুন, ইতিহাস অক্ষত থাকবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete}>মুছে ফেলুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MaterialDetailSheet({ material: m, courseName, subjectName, onClose, onEdit, onAddStock, onDistribute }: {
  material: Material | null; courseName: string; subjectName?: string; onClose: () => void;
  onEdit: (m: Material) => void; onAddStock: (m: Material) => void; onDistribute?: (id: string) => void;
}) {
  const recipients = useQuery({
    queryKey: ["materials", "recipients", m?.id],
    queryFn: () => api.getWithMeta<(MaterialDistribution & { _id: string })[]>(`/materials/distributions?materialId=${m!.id}&status=ACTIVE&limit=8`),
    enabled: !!m,
    staleTime: 30_000,
  });
  const rows = recipients.data?.data ?? [];
  const total = (recipients.data?.meta as { total?: number } | undefined)?.total ?? 0;
  return (
    <Sheet open={!!m} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {m && (
          <div className="space-y-5">
            <SheetHeader className="text-left">
              <SheetTitle>{m.name}</SheetTitle>
              <SheetDescription className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{m.materialType}</Badge>
                <Badge variant="outline" className={m.status === "সক্রিয়" ? "border-success/20 text-success" : ""}>{m.status}</Badge>
                {m.isPaid ? <Badge variant="outline">৳ {m.price}</Badge> : <Badge variant="outline" className="border-info/20 text-info">ফ্রি</Badge>}
              </SheetDescription>
            </SheetHeader>
            <div className="rounded-lg border p-4"><StockIndicator m={m} /><p className="mt-2 text-xs text-muted-foreground">প্রারম্ভিক স্টক {m.openingStock}</p></div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">কোর্স</dt><dd className="font-medium">{courseName}</dd></div>
              <div><dt className="text-xs text-muted-foreground">সাবজেক্ট</dt><dd className="font-medium">{subjectName ?? "—"}</dd></div>
              {m.description && <div className="col-span-2"><dt className="text-xs text-muted-foreground">বিবরণ</dt><dd>{m.description}</dd></div>}
            </dl>
            <section>
              <h3 className="mb-2 text-sm font-semibold">যারা পেয়েছে <span className="font-normal text-muted-foreground">({total} টি বিতরণ)</span></h3>
              {recipients.isLoading ? <ListSkeleton rows={3} /> : rows.length === 0 ? <p className="text-sm text-muted-foreground">এখনো কাউকে দেওয়া হয়নি</p> : (
                <ul className="divide-y rounded-lg border">
                  {rows.map((d) => {
                    const qty = d.items.find((i) => i.materialId === m.id)?.quantity ?? 0;
                    return <li key={d._id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm"><span className="min-w-0"><span className="block truncate font-medium">{d.studentName}</span><span className="text-xs text-muted-foreground">{d.studentRoll || d.registrationId || ""}{d.batchName ? ` • ${d.batchName}` : ""}</span></span><span className="shrink-0 text-right text-xs"><b className="tabular-nums">×{qty}</b><span className="block text-muted-foreground">{d.distributionDate}</span></span></li>;
                  })}
                </ul>
              )}
            </section>
            <div className="grid grid-cols-2 gap-2">
              {onDistribute && m.status === "সক্রিয়" && <Button className="col-span-2" disabled={m.currentStock <= 0} onClick={() => { onClose(); onDistribute(m.id); }}><Send className="h-4 w-4" />বিতরণ করুন</Button>}
              <Button variant="outline" onClick={() => onAddStock(m)}><PackagePlus className="h-4 w-4" />স্টক যোগ</Button>
              <Button variant="outline" onClick={() => onEdit(m)}><Pencil className="h-4 w-4" />সম্পাদনা</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
