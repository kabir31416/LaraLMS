import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserSearch, Search, AlertTriangle, RotateCcw } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { useMaterials } from "@/contexts/MaterialContext";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { MaterialStudentPicker, PickedStudent } from "./MaterialStudentPicker";
import type { DuplicateWarning, MaterialDistribution } from "@/types/material";
import { toast } from "sonner";

export function DistributionTab() {
  const { activePaymentMethods } = useAcademic();
  const { batches } = useBatches();
  const { materials, getMaterial } = useMaterials();

  const [tab, setTab] = useState("new");

  // ---- New Distribution ----
  const [pickerOpen, setPickerOpen] = useState(false);
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");
  // materialId -> quantity, for every checked material
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [collectPayment, setCollectPayment] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [warnings, setWarnings] = useState<DuplicateWarning[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const visibleMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();
    return materials.filter((m) => m.status === "সক্রিয়" && (!q || m.name.toLowerCase().includes(q) || m.materialType.toLowerCase().includes(q)));
  }, [materials, materialSearch]);

  const toggleMaterial = (materialId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[materialId] = 1;
      else delete next[materialId];
      return next;
    });
  };

  const setQuantity = (materialId: string, quantity: number) => {
    setSelected((prev) => ({ ...prev, [materialId]: quantity }));
  };

  const validItems = useMemo(() => Object.entries(selected).map(([materialId, quantity]) => ({ materialId, quantity })), [selected]);
  const totalPaid = validItems.reduce((sum, i) => {
    const m = getMaterial(i.materialId);
    return sum + (m?.isPaid ? m.price * i.quantity : 0);
  }, 0);

  const materialIdsKey = validItems.map((i) => i.materialId).sort().join(",");
  const debouncedIds = useDebouncedValue(materialIdsKey, 400);

  useEffect(() => {
    if (!student || !debouncedIds) { setWarnings([]); return; }
    const ids = debouncedIds.split(",").filter(Boolean);
    if (ids.length === 0) { setWarnings([]); return; }
    api.post<DuplicateWarning[]>("/materials/distributions/check-duplicate", { studentId: student.id, materialIds: ids })
      .then(setWarnings)
      .catch(() => setWarnings([]));
  }, [student, debouncedIds]);

  const resetForm = () => {
    setStudent(null);
    setMaterialSearch("");
    setSelected({});
    setNote("");
    setCollectPayment(true);
    setPaymentMethod("");
    setWarnings([]);
  };

  const validate = (): string | null => {
    if (!student) return "শিক্ষার্থী নির্বাচন করুন";
    if (validItems.length === 0) return "কমপক্ষে একটি ম্যাটেরিয়াল নির্বাচন করুন";
    for (const i of validItems) {
      const m = getMaterial(i.materialId);
      if (!m) continue;
      if (!i.quantity || i.quantity <= 0) return `"${m.name}" এর পরিমাণ শূন্যের বেশি হতে হবে`;
      if (m.currentStock === 0) return `"${m.name}" স্টকে নেই`;
      if (i.quantity > m.currentStock) return `"${m.name}" এর জন্য পর্যাপ্ত স্টক নেই — উপলব্ধ: ${m.currentStock}, অনুরোধ: ${i.quantity}`;
    }
    if (totalPaid > 0 && collectPayment && !paymentMethod) return "পেমেন্ট পদ্ধতি নির্বাচন করুন";
    return null;
  };

  const handleSubmitClick = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setConfirmOpen(true);
  };

  const doSubmit = async () => {
    if (!student) return;
    setSubmitting(true);
    try {
      await api.post("/materials/distributions", {
        studentId: student.id,
        items: validItems,
        note: note.trim() || undefined,
        collectPayment: totalPaid > 0 && collectPayment ? { method: paymentMethod } : undefined,
      });
      toast.success("ম্যাটেরিয়াল সফলভাবে বিতরণ করা হয়েছে");
      resetForm();
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "বিতরণ ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = validItems.length;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card border">
          <TabsTrigger value="new">নতুন বিতরণ</TabsTrigger>
          <TabsTrigger value="history">বিতরণ হিস্ট্রি</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="pt-4 space-y-4">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-base">১. শিক্ষার্থী নির্বাচন করুন</CardTitle></CardHeader>
            <CardContent>
              {student ? (
                <div className="flex items-center justify-between bg-muted/40 rounded-lg p-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">নাম</p><p className="font-medium">{student.name}</p></div>
                    <div><p className="text-xs text-muted-foreground">রোল</p><p className="font-medium">{student.currentRollNumber || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">রেজিস্ট্রেশন</p><p className="font-medium">{student.registrationId || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">মোবাইল</p><p className="font-medium">{student.phone}</p></div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>পরিবর্তন</Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setPickerOpen(true)}><UserSearch className="h-4 w-4 mr-2" /> শিক্ষার্থী খুঁজুন</Button>
              )}
            </CardContent>
          </Card>

          {student && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">২. ম্যাটেরিয়াল বেছে নিন</CardTitle>
                <div className="relative pt-2">
                  <Search className="absolute left-3 top-1/2 translate-y-[3px] -translate-x-0 h-4 w-4 text-muted-foreground" />
                  <Input value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} placeholder="নাম বা টাইপ দিয়ে খুঁজুন..." className="pl-9 max-w-sm" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="border rounded-lg divide-y max-h-[420px] overflow-y-auto">
                  {visibleMaterials.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">কোনো ম্যাটেরিয়াল পাওয়া যায়নি</p>
                  ) : (
                    visibleMaterials.map((m) => {
                      const checked = m.id in selected;
                      const outOfStock = m.currentStock === 0;
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-3 p-3 transition-colors ${outOfStock ? "opacity-50" : "hover:bg-muted/40 cursor-pointer"}`}
                        >
                          <Checkbox checked={checked} disabled={outOfStock} onCheckedChange={(v) => toggleMaterial(m.id, !!v)} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{m.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs">{m.materialType}</Badge>
                              {m.isPaid ? <Badge variant="outline" className="text-xs">৳ {m.price}</Badge> : <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/20">Free</Badge>}
                              <span className={`text-xs ${outOfStock ? "text-destructive" : "text-muted-foreground"}`}>
                                {outOfStock ? "স্টকে নেই" : `স্টক: ${m.currentStock}`}
                              </span>
                            </div>
                          </div>
                          {checked && (
                            <Input
                              type="number"
                              min={1}
                              max={m.currentStock}
                              value={selected[m.id]}
                              onClick={(e) => e.preventDefault()}
                              onChange={(e) => setQuantity(m.id, Number(e.target.value) || 1)}
                              className="w-20 shrink-0"
                            />
                          )}
                        </label>
                      );
                    })
                  )}
                </div>

                {selectedCount > 0 && (
                  <p className="text-sm text-muted-foreground">{selectedCount}টি ম্যাটেরিয়াল নির্বাচিত হয়েছে</p>
                )}

                {warnings.length > 0 && (
                  <Alert className="bg-warning/10 border-warning/20">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertDescription>
                      <p className="font-medium text-warning mb-1">এই শিক্ষার্থীকে নিচের ম্যাটেরিয়াল(গুলো) আগে দেওয়া হয়েছে:</p>
                      <ul className="space-y-1 text-sm">
                        {warnings.map((w) => (
                          <li key={w.materialId}>
                            <span className="font-medium">{w.materialName}</span> — {w.previousDistributions.map((p) => `${p.date} (${p.quantity} পিস)`).join(", ")}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground mt-1">আবার বিতরণ করতে চাইলে সরাসরি নিশ্চিত করুন — এটি স্বয়ংক্রিয়ভাবে আটকানো হবে না।</p>
                    </AlertDescription>
                  </Alert>
                )}

                {totalPaid > 0 && (
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">মোট পেইড পরিমাণ: <span className="text-primary">৳ {totalPaid.toLocaleString()}</span></p>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={collectPayment} onCheckedChange={(v) => setCollectPayment(!!v)} id="collect-payment" />
                        <Label htmlFor="collect-payment" className="text-sm cursor-pointer">এখনই পেমেন্ট সংগ্রহ করুন</Label>
                      </div>
                    </div>
                    {collectPayment && (
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="max-w-xs"><SelectValue placeholder="পেমেন্ট পদ্ধতি নির্বাচন করুন" /></SelectTrigger>
                        <SelectContent>{activePaymentMethods.map((pm) => (<SelectItem key={pm.id} value={pm.name}>{pm.name}</SelectItem>))}</SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>নোট (ঐচ্ছিক)</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSubmitClick} disabled={submitting || selectedCount === 0}>
                    {selectedCount > 0 ? `${selectedCount}টি ম্যাটেরিয়াল বিতরণ করুন` : "বিতরণ করুন"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <DistributionHistory batches={batches} />
        </TabsContent>
      </Tabs>

      <MaterialStudentPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => { setStudent(s); setPickerOpen(false); }} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>বিতরণ নিশ্চিত করুন</AlertDialogTitle>
            <AlertDialogDescription>
              {student?.name}-কে {validItems.length} ধরনের ম্যাটেরিয়াল বিতরণ করা হবে{totalPaid > 0 ? ` (মোট ৳ ${totalPaid.toLocaleString()})` : ""}। নিশ্চিত করবেন?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={doSubmit} disabled={submitting}>{submitting ? "প্রসেস হচ্ছে..." : "নিশ্চিত করুন"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DistributionHistory({ batches }: { batches: { id: string; name: string }[] }) {
  const [items, setItems] = useState<MaterialDistribution[]>([]);
  const [meta, setMeta] = useState<{ page: number; totalPages: number; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [loading, setLoading] = useState(true);
  const [reverseTarget, setReverseTarget] = useState<MaterialDistribution | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "20" });
      if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
      const res = await api.getWithMeta<{ _id: string }[]>(`/materials/distributions?${qs.toString()}`);
      setItems(res.data.map((d) => ({ ...(d as unknown as MaterialDistribution), id: d._id })));
      setMeta(res.meta as unknown as { page: number; totalPages: number; total: number });
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const doReverse = async () => {
    if (!reverseTarget || !reverseReason.trim()) { toast.error("কারণ লিখুন"); return; }
    setReversing(true);
    try {
      await api.post(`/materials/distributions/${reverseTarget.id}/reverse`, { reason: reverseReason.trim() });
      toast.success("বিতরণ বাতিল করা হয়েছে — স্টক ফেরত যোগ হয়েছে");
      setReverseTarget(null);
      setReverseReason("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "বাতিল করা যায়নি");
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="শিক্ষার্থীর নাম, রেজিস্ট্রেশন নম্বর বা আইডি দিয়ে খুঁজুন..." className="max-w-md" />
      <Card className="border-none shadow-sm">
        {loading ? (
          <CardContent className="py-12 text-center text-muted-foreground">লোড হচ্ছে...</CardContent>
        ) : items.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">কোনো বিতরণ পাওয়া যায়নি।</CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>তারিখ</TableHead>
                <TableHead>শিক্ষার্থী</TableHead>
                <TableHead>ম্যাটেরিয়াল</TableHead>
                <TableHead className="text-center">পরিমাণ</TableHead>
                <TableHead className="text-right">মূল্য</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm">{d.distributionDate}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span className="font-medium">{d.studentName}</span>
                      <span className="text-xs text-muted-foreground">{d.studentRoll || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{d.items.map((i) => `${i.materialName} ×${i.quantity}`).join(", ")}</TableCell>
                  <TableCell className="text-center">{d.totalQuantity}</TableCell>
                  <TableCell className="text-right">{d.totalPaidAmount > 0 ? `৳ ${d.totalPaidAmount.toLocaleString()}` : "Free"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={d.status === "ACTIVE" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                      {d.status === "ACTIVE" ? "সক্রিয়" : "বাতিল"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {d.status === "ACTIVE" && (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setReverseTarget(d)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> বাতিল
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 p-4 border-t">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>পূর্ববর্তী</Button>
            <span className="text-sm text-muted-foreground">পৃষ্ঠা {meta.page} / {meta.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>পরবর্তী</Button>
          </div>
        )}
      </Card>

      <AlertDialog open={!!reverseTarget} onOpenChange={(o) => !o && setReverseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>বিতরণ বাতিল করুন</AlertDialogTitle>
            <AlertDialogDescription>
              {reverseTarget?.studentName}-কে দেওয়া এই বিতরণ বাতিল করা হবে এবং স্টক ফেরত যোগ হবে। এই কাজটি ফিরিয়ে নেওয়া যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 px-1">
            <Label>বাতিলের কারণ *</Label>
            <Input value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="যেমন: ভুল শিক্ষার্থীকে দেওয়া হয়েছে" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reversing}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={doReverse} disabled={reversing} className="bg-destructive hover:bg-destructive/90">
              {reversing ? "প্রসেস হচ্ছে..." : "নিশ্চিত করে বাতিল করুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
