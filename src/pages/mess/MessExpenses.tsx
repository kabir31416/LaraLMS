import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Edit, Check, X, Ban, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessPage, MessSelect, useMessScope } from "@/components/mess/MessShell";
import { SuperDeleteButton } from "@/components/mess/SuperDelete";
import { AttachmentInput, MethodSelect, Pager, ReasonDialog, SearchInput, StatusBadge, TableState } from "@/components/mess/MessCommon";
import { api } from "@/lib/apiClient";
import { errMsg, EXPENSE_STATUS_LABELS, qs, refName, tk, todayISO, usePagedList, type Expense } from "@/lib/mess";
import { MESS_EXPENSES_APPROVE, MESS_EXPENSES_MANAGE } from "@/lib/permissions";
import { exportExcel } from "@/lib/exporters";

export default function MessExpenses() {
  const [params] = useSearchParams();
  const { messId, can, settings } = useMessScope();
  const [status, setStatus] = useState(params.get("status") || "all");
  const [category, setCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId, status, category, dateFrom, dateTo, search]);
  const list = usePagedList<Expense>(`/mess/expenses${qs({ messId, status, category, dateFrom, dateTo, search, page, limit: 25 })}`);
  const byCategory = (list.meta?.byCategory ?? []) as { _id: string; total: number; count: number }[];
  const approvedTotal = Number(list.meta?.approvedTotal ?? 0);
  const [form, setForm] = useState<{ open: boolean; editing: Expense | null }>({ open: false, editing: null });
  const [rejecting, setRejecting] = useState<Expense | null>(null);
  const [cancelling, setCancelling] = useState<Expense | null>(null);
  const isApprover = can(MESS_EXPENSES_APPROVE);

  const approve = async (e: Expense) => {
    try { await api.post(`/mess/expenses/${e._id}/approve`, {}); toast.success("খরচ অনুমোদিত"); await list.reload(); } catch (err) { toast.error(errMsg(err)); }
  };
  const exportRows = () => exportExcel({
    filename: "mess-expenses",
    title: "Mess Expenses",
    headers: ["No", "Date", "Mess", "Category", "Description", "Vendor", "Method", "Paid By", "Amount", "Status"],
    rows: list.items.map((e) => [e.expenseNo, e.date, refName(e.messId), e.category, e.description ?? "", e.vendor ?? "", e.method, e.paidBy ?? "", e.amount, EXPENSE_STATUS_LABELS[e.status]]),
  });

  return (
    <MessPage
      title="মেস খরচ"
      subtitle={settings?.expenseApprovalRequired ? "খরচ অনুমোদনের পরই রিপোর্টে গণ্য হয়" : "খরচ সরাসরি অনুমোদিত হয় (মেস সেটিংস)"}
      actions={can(MESS_EXPENSES_MANAGE) && <Button onClick={() => setForm({ open: true, editing: null })}><Plus className="h-4 w-4 mr-1" />নতুন খরচ</Button>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
              <SearchInput value={search} onChange={setSearch} placeholder="বিবরণ / ভেন্ডর / নং" className="col-span-2" />
              <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব খাত</SelectItem>{(settings?.expenseCategories ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব (বাতিল ছাড়া)</SelectItem>{Object.entries(EXPENSE_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="flex justify-end"><Button size="sm" variant="outline" onClick={exportRows} disabled={list.items.length === 0}>এক্সেল (এই পৃষ্ঠা)</Button></div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>নং / তারিখ</TableHead><TableHead>মেস</TableHead><TableHead>খাত</TableHead><TableHead>বিবরণ</TableHead><TableHead>পদ্ধতি</TableHead>
                <TableHead className="text-right">পরিমাণ</TableHead><TableHead>অবস্থা</TableHead><TableHead className="text-right">কাজ</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                <TableState colSpan={8} loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText="কোনো খরচ নেই" />
                {!list.loading && list.items.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell><p className="font-mono text-xs">{e.expenseNo}</p><p className="text-xs">{e.date}</p></TableCell>
                    <TableCell className="text-sm">{refName(e.messId)}</TableCell>
                    <TableCell className="text-sm">{e.category}</TableCell>
                    <TableCell className="text-sm max-w-[240px]">
                      <p className="truncate">{e.description || "—"}</p>
                      <p className="text-xs text-muted-foreground">{[e.vendor, e.paidBy && `পরিশোধক: ${e.paidBy}`, e.invoiceNo && `ইনভয়েস: ${e.invoiceNo}`].filter(Boolean).join(" • ")}</p>
                      {typeof e.complaintId === "object" && e.complaintId && <p className="text-xs text-info">টিকিট: {e.complaintId.ticketNo}</p>}
                      {e.attachment?.url && <a href={e.attachment.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline"><Paperclip className="h-3 w-3 inline" /> সংযুক্তি</a>}
                    </TableCell>
                    <TableCell className="text-sm">{e.method}</TableCell>
                    <TableCell className="text-right font-medium">{tk(e.amount)}</TableCell>
                    <TableCell><StatusBadge status={e.status} label={EXPENSE_STATUS_LABELS[e.status]} />{e.rejectedReason && <p className="text-xs text-destructive">{e.rejectedReason}</p>}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {e.status === "pending" && isApprover && <>
                        <Button size="sm" variant="outline" className="mr-1" onClick={() => approve(e)} title="অনুমোদন"><Check className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="outline" className="mr-1" onClick={() => setRejecting(e)} title="প্রত্যাখ্যান"><X className="h-3.5 w-3.5" /></Button>
                      </>}
                      {(e.status === "pending" || (e.status === "approved" && isApprover)) && can(MESS_EXPENSES_MANAGE) && <Button size="sm" variant="outline" className="mr-1" onClick={() => setForm({ open: true, editing: e })}><Edit className="h-3.5 w-3.5" /></Button>}
                      {(e.status === "pending" || (e.status === "approved" && isApprover)) && <Button size="sm" variant="outline" onClick={() => setCancelling(e)} title="বাতিল"><Ban className="h-3.5 w-3.5" /></Button>}
                      <SuperDeleteButton entity="expense" id={e._id} what={`খরচ ${e.expenseNo} — ${e.category} (${tk(e.amount)})`} onDeleted={list.reload} className="ml-1" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-3"><Pager meta={list.meta} page={page} onPage={setPage} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">খাতভিত্তিক (অনুমোদিত)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {byCategory.length === 0 ? <p className="text-muted-foreground">নেই</p> : byCategory.map((c) => (
              <div key={c._id} className="flex justify-between border-b pb-1"><span>{c._id} <span className="text-xs text-muted-foreground">({c.count})</span></span><span className="font-medium">{tk(c.total)}</span></div>
            ))}
            <div className="flex justify-between pt-1 font-semibold"><span>মোট</span><span>{tk(approvedTotal)}</span></div>
          </CardContent>
        </Card>
      </div>
      <ExpenseFormDialog open={form.open} editing={form.editing} onOpenChange={(v) => setForm({ open: v, editing: v ? form.editing : null })} onSaved={list.reload} />
      <ReasonDialog open={!!rejecting} onOpenChange={(v) => !v && setRejecting(null)} title="খরচ প্রত্যাখ্যান" destructive onConfirm={async (reason) => { await api.post(`/mess/expenses/${rejecting!._id}/reject`, { reason }); toast.success("প্রত্যাখ্যাত"); await list.reload(); }} />
      <ReasonDialog open={!!cancelling} onOpenChange={(v) => !v && setCancelling(null)} title="খরচ বাতিল" required={false} destructive onConfirm={async (reason) => { await api.post(`/mess/expenses/${cancelling!._id}/cancel`, { reason: reason || undefined }); toast.success("খরচ বাতিল হয়েছে"); await list.reload(); }} />
    </MessPage>
  );
}

function ExpenseFormDialog({ open, editing, onOpenChange, onSaved }: { open: boolean; editing: Expense | null; onOpenChange: (v: boolean) => void; onSaved: () => Promise<void> }) {
  const { messId: scopeMess, settings } = useMessScope();
  const [f, setF] = useState({ messId: "", date: todayISO(), category: "", description: "", amount: "", method: "", paidBy: "", vendor: "", invoiceNo: "" });
  const [attachment, setAttachment] = useState<{ url: string; publicId?: string; resourceType?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF({ messId: editing ? refName(editing.messId, "_id") : scopeMess !== "all" ? scopeMess : "", date: editing?.date ?? todayISO(), category: editing?.category ?? "", description: editing?.description ?? "", amount: editing ? String(editing.amount) : "", method: editing?.method ?? "", paidBy: editing?.paidBy ?? "", vendor: editing?.vendor ?? "", invoiceNo: editing?.invoiceNo ?? "" });
    setAttachment(editing?.attachment ?? null);
  }, [open, editing, scopeMess]);
  const save = async () => {
    if (!f.messId || !f.category || !f.method || !(Number(f.amount) > 0)) { toast.error("মেস, খাত, পরিমাণ ও পদ্ধতি দিন"); return; }
    setBusy(true);
    try {
      const body = { date: f.date, category: f.category, description: f.description || undefined, amount: Number(f.amount), method: f.method, paidBy: f.paidBy || undefined, vendor: f.vendor || undefined, invoiceNo: f.invoiceNo || undefined, attachment: attachment ?? undefined };
      if (editing) await api.patch(`/mess/expenses/${editing._id}`, body);
      else {
        const created = await api.post<{ status: string }>("/mess/expenses", { ...body, messId: f.messId });
        toast.success(created.status === "pending" ? "খরচ যোগ হয়েছে — অনুমোদনের অপেক্ষায়" : "খরচ যোগ হয়েছে");
      }
      if (editing) toast.success("খরচ আপডেট হয়েছে");
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? `খরচ সম্পাদনা — ${editing.expenseNo}` : "নতুন খরচ"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>মেস *</Label>{editing ? <Input disabled value={refName(editing.messId)} /> : <MessSelect value={f.messId} onChange={(v) => setF({ ...f, messId: v })} />}</div>
          <div className="space-y-1.5"><Label>তারিখ *</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>খাত *</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger><SelectContent>{(settings?.expenseCategories ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>পরিমাণ (৳) *</Label><Input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>পেমেন্ট পদ্ধতি *</Label><MethodSelect value={f.method} onChange={(v) => setF({ ...f, method: v })} /></div>
          <div className="space-y-1.5"><Label>পরিশোধ করেছেন</Label><Input value={f.paidBy} onChange={(e) => setF({ ...f, paidBy: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>ভেন্ডর / প্রাপক</Label><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>ইনভয়েস নং</Label><Input value={f.invoiceNo} onChange={(e) => setF({ ...f, invoiceNo: e.target.value })} /></div>
          <div className="sm:col-span-2 space-y-1.5"><Label>বিবরণ</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="sm:col-span-2 space-y-1.5"><Label>ইনভয়েস / সংযুক্তি</Label><AttachmentInput value={attachment} onChange={setAttachment} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={save}>{busy ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
