import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Pencil, PackagePlus, ClipboardEdit, History, Power } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import { useMaterials } from "@/contexts/MaterialContext";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/apiClient";
import type { Material, StockMovement } from "@/types/material";
import { MaterialFormDialog } from "./MaterialFormDialog";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

type StockFilter = "all" | "low" | "out";
type PaidFilter = "all" | "free" | "paid";
type StatusFilter = "all" | "active" | "inactive";

export function MaterialsListTab() {
  const { activeCourses, getSubject } = useAcademic();
  const { materials, materialTypes, addStock, adjustStock, setMaterialStatus, loading } = useMaterials();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [courseId, setCourseId] = useState("all");
  const [materialType, setMaterialType] = useState("all");
  const [paidFilter, setPaidFilter] = useState<PaidFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Material | null>(null);

  const [stockDialog, setStockDialog] = useState<{ material: Material; mode: "add" | "adjust" } | null>(null);
  const [stockQty, setStockQty] = useState(1);
  const [stockReason, setStockReason] = useState("");
  const [adjustReason, setAdjustReason] = useState("পরিমাণ গণনা সংশোধন");
  const [savingStock, setSavingStock] = useState(false);

  const [historyDialog, setHistoryDialog] = useState<Material | null>(null);
  const [historyRows, setHistoryRows] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return materials.filter((m) => {
      if (q && !(m.name.toLowerCase().includes(q) || m.materialType.toLowerCase().includes(q))) return false;
      if (courseId !== "all" && m.courseId !== courseId) return false;
      if (materialType !== "all" && m.materialType !== materialType) return false;
      if (paidFilter === "free" && m.isPaid) return false;
      if (paidFilter === "paid" && !m.isPaid) return false;
      if (stockFilter === "low" && !(m.currentStock > 0 && m.currentStock <= m.minimumStock)) return false;
      if (stockFilter === "out" && m.currentStock !== 0) return false;
      if (statusFilter === "active" && m.status !== "সক্রিয়") return false;
      if (statusFilter === "inactive" && m.status !== "নিষ্ক্রিয়") return false;
      return true;
    });
  }, [materials, debouncedSearch, courseId, materialType, paidFilter, stockFilter, statusFilter]);

  const courseName = (id: string) => activeCourses.find((c) => c.id === id)?.name || "—";

  const openAdd = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (m: Material) => { setEditTarget(m); setFormOpen(true); };

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
    setSavingStock(true);
    try {
      if (stockDialog.mode === "add") {
        await addStock(stockDialog.material.id, stockQty, stockReason || undefined);
        toast.success("স্টক যোগ করা হয়েছে");
      } else {
        await adjustStock(stockDialog.material.id, stockQty, adjustReason, stockReason || undefined);
        toast.success("স্টক সংশোধন করা হয়েছে");
      }
      setStockDialog(null);
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
      toast.success(m.status === "সক্রিয়" ? "নিষ্ক্রিয় করা হয়েছে" : "সক্রিয় করা হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পরিবর্তন ব্যর্থ হয়েছে");
    }
  };

  const stockBadge = (m: Material) => {
    if (m.currentStock === 0) return <Badge className="bg-destructive/10 text-destructive border-destructive/20">স্টকে নেই</Badge>;
    if (m.currentStock <= m.minimumStock) return <Badge className="bg-warning/10 text-warning border-warning/20">⚠️ লো স্টক</Badge>;
    return <Badge className="bg-success/10 text-success border-success/20">{m.currentStock}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম বা টাইপ দিয়ে খুঁজুন..." className="pl-9" />
          </div>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="কোর্স" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল কোর্স</SelectItem>{activeCourses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
          </Select>
          <Select value={materialType} onValueChange={setMaterialType}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="টাইপ" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল টাইপ</SelectItem>{materialTypes.map((t) => (<SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>))}</SelectContent>
          </Select>
          <Select value={paidFilter} onValueChange={(v) => setPaidFilter(v as PaidFilter)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Free/Paid</SelectItem><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল স্টক</SelectItem><SelectItem value="low">Low Stock</SelectItem><SelectItem value="out">Out of Stock</SelectItem></SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল অবস্থা</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
          </Select>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> নতুন ম্যাটেরিয়াল</Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        {loading ? (
          <CardContent className="py-12 text-center text-muted-foreground">লোড হচ্ছে...</CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">কোনো ম্যাটেরিয়াল পাওয়া যায়নি।</CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>নাম</TableHead>
                  <TableHead>টাইপ</TableHead>
                  <TableHead>কোর্স / সাবজেক্ট</TableHead>
                  <TableHead>মূল্য</TableHead>
                  <TableHead>স্টক</TableHead>
                  <TableHead>অবস্থা</TableHead>
                  <TableHead className="text-right">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell><Badge variant="outline">{m.materialType}</Badge></TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>{courseName(m.courseId)}</span>
                        {m.subjectId && <span className="text-xs text-muted-foreground">{getSubject(m.subjectId)?.name}</span>}
                      </div>
                    </TableCell>
                    <TableCell>{m.isPaid ? `৳ ${m.price.toLocaleString()}` : <Badge variant="outline" className="bg-info/10 text-info border-info/20">Free</Badge>}</TableCell>
                    <TableCell>{stockBadge(m)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={m.status === "সক্রিয়" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>{m.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap space-x-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="সম্পাদনা" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="স্টক যোগ" onClick={() => openStockDialog(m, "add")}><PackagePlus className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="স্টক সংশোধন" onClick={() => openStockDialog(m, "adjust")}><ClipboardEdit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="স্টক হিস্ট্রি" onClick={() => openHistory(m)}><History className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title={m.status === "সক্রিয়" ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"} onClick={() => toggleActive(m)}><Power className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <MaterialFormDialog open={formOpen} onOpenChange={setFormOpen} editMaterial={editTarget} />

      <Dialog open={!!stockDialog} onOpenChange={(o) => !o && setStockDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{stockDialog?.mode === "add" ? "স্টক যোগ করুন" : "স্টক সংশোধন"}</DialogTitle></DialogHeader>
          {stockDialog && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">{stockDialog.material.name} — বর্তমান স্টক: <span className="font-semibold text-foreground">{stockDialog.material.currentStock}</span></p>
              <div className="space-y-1.5">
                <Label>{stockDialog.mode === "add" ? "পরিমাণ (+)" : "পরিবর্তন (+/-)"}</Label>
                <Input type="number" value={stockQty} onChange={(e) => setStockQty(Number(e.target.value) || 0)} />
                {stockDialog.mode === "adjust" && <p className="text-xs text-muted-foreground">যেমন: গণনায় ৩টি কম পাওয়া গেলে -3 লিখুন</p>}
              </div>
              {stockDialog.mode === "adjust" && (
                <div className="space-y-1.5">
                  <Label>কারণ *</Label>
                  <Select value={adjustReason} onValueChange={setAdjustReason}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="পরিমাণ গণনা সংশোধন">Physical Count Correction</SelectItem>
                      <SelectItem value="ক্ষতিগ্রস্ত">Damaged</SelectItem>
                      <SelectItem value="হারিয়ে গেছে">Lost</SelectItem>
                      <SelectItem value="অন্যান্য">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>নোট (ঐচ্ছিক)</Label>
                <Input value={stockReason} onChange={(e) => setStockReason(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setStockDialog(null)}>বাতিল</Button>
                <Button onClick={submitStock} disabled={savingStock}>{savingStock ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyDialog} onOpenChange={(o) => !o && setHistoryDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>স্টক হিস্ট্রি — {historyDialog?.name}</DialogTitle></DialogHeader>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">লোড হচ্ছে...</p>
          ) : historyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">কোনো স্টক মুভমেন্ট নেই</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>তারিখ</TableHead>
                  <TableHead>ধরন</TableHead>
                  <TableHead className="text-right">পরিবর্তন</TableHead>
                  <TableHead className="text-right">আগে → পরে</TableHead>
                  <TableHead>কারণ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm">{new Date(h.createdAt).toLocaleString("bn-BD")}</TableCell>
                    <TableCell><Badge variant="outline">{h.movementType}</Badge></TableCell>
                    <TableCell className={`text-right font-semibold ${h.quantity > 0 ? "text-success" : "text-destructive"}`}>{h.quantity > 0 ? `+${h.quantity}` : h.quantity}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{h.previousStock} → {h.newStock}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{h.reason || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
