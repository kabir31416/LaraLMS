import { useEffect, useState } from "react";
import { Plus, Eye } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessPage, MessSelect, useMessScope } from "@/components/mess/MessShell";
import { AttachmentInput, MethodSelect, Pager, SearchInput, StatusBadge, TableState } from "@/components/mess/MessCommon";
import { api } from "@/lib/apiClient";
import {
  COMPLAINT_KIND_LABELS, COMPLAINT_PRIORITY_LABELS, COMPLAINT_STATUS_LABELS, errMsg, EXPENSE_STATUS_LABELS, qs, refName, tk, todayISO,
  useApiData, usePagedList, type Complaint, type Expense, type Mess, type Room,
} from "@/lib/mess";
import { MESS_COMPLAINTS_MANAGE, MESS_EXPENSES_MANAGE } from "@/lib/permissions";

export default function MessComplaints() {
  const { messId, can } = useMessScope();
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId, kind, status, priority, search]);
  const list = usePagedList<Complaint>(`/mess/complaints${qs({ messId, kind, status, priority, search, page, limit: 25 })}`);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Complaint | null>(null);
  return (
    <MessPage
      title="অভিযোগ ও রক্ষণাবেক্ষণ"
      subtitle="শিক্ষার্থীদের অভিযোগ (স্টুডেন্ট পোর্টাল থেকে) এবং রুম/আসবাব/বৈদ্যুতিক/প্লাম্বিং রক্ষণাবেক্ষণ টিকিট"
      actions={can(MESS_COMPLAINTS_MANAGE) && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />নতুন টিকিট</Button>}
    >
      <Card>
        <CardHeader>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="শিরোনাম / টিকিট নং" className="col-span-2" />
            <Select value={kind} onValueChange={setKind}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব ধরন</SelectItem>{Object.entries(COMPLAINT_KIND_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব অবস্থা</SelectItem>{Object.entries(COMPLAINT_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
            <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব অগ্রাধিকার</SelectItem>{Object.entries(COMPLAINT_PRIORITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>টিকিট</TableHead><TableHead>ধরন / ক্যাটাগরি</TableHead><TableHead>শিরোনাম</TableHead><TableHead>মেস / রুম</TableHead><TableHead>জমাদানকারী</TableHead>
              <TableHead>অগ্রাধিকার</TableHead><TableHead>দায়িত্বপ্রাপ্ত</TableHead><TableHead>অবস্থা</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              <TableState colSpan={9} loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText="কোনো অভিযোগ/টিকিট নেই" />
              {!list.loading && list.items.map((c) => (
                <TableRow key={c._id} className="cursor-pointer" onClick={() => setViewing(c)}>
                  <TableCell><p className="font-mono text-xs">{c.ticketNo}</p><p className="text-xs">{c.date}</p></TableCell>
                  <TableCell className="text-sm">{COMPLAINT_KIND_LABELS[c.kind]}<p className="text-xs text-muted-foreground">{c.category}</p></TableCell>
                  <TableCell className="text-sm font-medium max-w-[220px] truncate">{c.title}</TableCell>
                  <TableCell className="text-sm">{refName(c.messId)}<p className="text-xs text-muted-foreground">{c.roomId ? `রুম ${refName(c.roomId)}` : ""}</p></TableCell>
                  <TableCell className="text-sm">{c.studentId ? c.studentId.name : "স্টাফ"}</TableCell>
                  <TableCell><StatusBadge status={c.priority === "urgent" ? "urgent" : c.priority === "high" ? "pending" : "neutral"} label={COMPLAINT_PRIORITY_LABELS[c.priority]} /></TableCell>
                  <TableCell className="text-sm">{c.assignedStaffId?.name ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={c.status} label={COMPLAINT_STATUS_LABELS[c.status]} /></TableCell>
                  <TableCell><Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-3"><Pager meta={list.meta} page={page} onPage={setPage} /></div>
        </CardContent>
      </Card>
      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={list.reload} />
      <TicketDialog complaint={viewing} onOpenChange={(v) => !v && setViewing(null)} onChanged={list.reload} />
    </MessPage>
  );
}

function CreateTicketDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => Promise<void> }) {
  const { messId: scopeMess, settings } = useMessScope();
  const [f, setF] = useState({ kind: "maintenance" as Complaint["kind"], messId: "", roomId: "", category: "", title: "", description: "", priority: "normal" as Complaint["priority"] });
  const [attachment, setAttachment] = useState<{ url: string; publicId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: rooms } = useApiData<Room[]>(f.messId ? `/mess/rooms${qs({ messId: f.messId })}` : null);
  useEffect(() => { if (open) { setF({ kind: "maintenance", messId: scopeMess !== "all" ? scopeMess : "", roomId: "", category: "", title: "", description: "", priority: "normal" }); setAttachment(null); } }, [open, scopeMess]);
  const categories = f.kind === "maintenance" ? settings?.maintenanceCategories ?? [] : settings?.complaintCategories ?? [];
  const save = async () => {
    if (!f.messId || !f.category || !f.title.trim()) { toast.error("মেস, ক্যাটাগরি ও শিরোনাম দিন"); return; }
    setBusy(true);
    try {
      await api.post("/mess/complaints", { ...f, roomId: f.roomId || undefined, description: f.description || undefined, attachment: attachment ?? undefined });
      toast.success("টিকিট তৈরি হয়েছে");
      onOpenChange(false);
      await onSaved();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>নতুন অভিযোগ / রক্ষণাবেক্ষণ টিকিট</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>ধরন</Label><Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v as Complaint["kind"], category: "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(COMPLAINT_KIND_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>ক্যাটাগরি *</Label><Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>মেস *</Label><MessSelect value={f.messId} onChange={(v) => setF({ ...f, messId: v, roomId: "" })} /></div>
          <div className="space-y-1.5"><Label>রুম</Label><Select value={f.roomId || "__none"} onValueChange={(v) => setF({ ...f, roomId: v === "__none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">—</SelectItem>{(rooms ?? []).map((r) => <SelectItem key={r._id} value={r._id}>রুম {r.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="sm:col-span-2 space-y-1.5"><Label>শিরোনাম *</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="sm:col-span-2 space-y-1.5"><Label>বিবরণ</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>অগ্রাধিকার</Label><Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as Complaint["priority"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(COMPLAINT_PRIORITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>সংযুক্তি</Label><AttachmentInput value={attachment} onChange={setAttachment} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={save}>{busy ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketDialog({ complaint, onOpenChange, onChanged }: { complaint: Complaint | null; onOpenChange: (v: boolean) => void; onChanged: () => Promise<void> }) {
  const { can, settings } = useMessScope();
  const { data, reload } = useApiData<{ complaint: Complaint; expenses: Expense[] }>(complaint ? `/mess/complaints/${complaint._id}` : null);
  const { data: mess } = useApiData<Mess>(complaint ? `/mess/messes/${refName(complaint.messId, "_id")}` : null);
  const [status, setStatus] = useState<Complaint["status"]>("open");
  const [assigned, setAssigned] = useState("__none");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState({ category: "", amount: "", method: "", date: todayISO(), description: "" });
  useEffect(() => {
    if (data?.complaint) {
      setStatus(data.complaint.status);
      setAssigned(data.complaint.assignedStaffId?._id ?? "__none");
      setNote("");
    }
  }, [data]);
  const c = data?.complaint ?? complaint;
  const save = async () => {
    if (!c) return;
    setBusy(true);
    try {
      await api.patch(`/mess/complaints/${c._id}`, { status, assignedStaffId: assigned === "__none" ? null : assigned, note: note || undefined });
      toast.success("টিকিট আপডেট হয়েছে");
      await Promise.all([reload(), onChanged()]);
      setNote("");
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  const addExpense = async () => {
    if (!c) return;
    if (!exp.category || !exp.method || !(Number(exp.amount) > 0)) { toast.error("খাত, পরিমাণ ও পদ্ধতি দিন"); return; }
    setBusy(true);
    try {
      await api.post("/mess/expenses", { messId: refName(c.messId, "_id"), complaintId: c._id, date: exp.date, category: exp.category, amount: Number(exp.amount), method: exp.method, description: exp.description || `টিকিট ${c.ticketNo}: ${c.title}` });
      toast.success("রক্ষণাবেক্ষণ খরচ যুক্ত হয়েছে (খরচ তালিকায় একবারই গণ্য হবে)");
      setExp({ category: "", amount: "", method: "", date: todayISO(), description: "" });
      await reload();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  if (!c) return null;
  return (
    <Dialog open={!!complaint} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{c.ticketNo} — {c.title}</DialogTitle>
          <DialogDescription>{COMPLAINT_KIND_LABELS[c.kind]} • {c.category} • {refName(c.messId)}{c.roomId ? ` • রুম ${refName(c.roomId)}` : ""} • {c.studentId ? `শিক্ষার্থী: ${c.studentId.name}` : "স্টাফ কর্তৃক"}</DialogDescription>
        </DialogHeader>
        {c.description && <p className="text-sm whitespace-pre-wrap border rounded-md p-3">{c.description}</p>}
        {c.attachment?.url && <a href={c.attachment.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">সংযুক্তি দেখুন</a>}
        {can(MESS_COMPLAINTS_MANAGE) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>অবস্থা</Label><Select value={status} onValueChange={(v) => setStatus(v as Complaint["status"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(COMPLAINT_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>দায়িত্বপ্রাপ্ত স্টাফ</Label>
              <Select value={assigned} onValueChange={setAssigned}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">কেউ না</SelectItem>
                  {(mess?.staff ?? []).map((s) => typeof s.staffId === "object" && <SelectItem key={s.staffId._id} value={s.staffId._id}>{s.staffId.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Textarea rows={2} placeholder="নোট / আপডেট" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="sm:col-span-2 flex justify-end"><Button disabled={busy} onClick={save}>আপডেট সংরক্ষণ</Button></div>
          </div>
        )}
        <div className="space-y-1">
          <p className="text-sm font-medium">ইতিহাস</p>
          {[...(c.history ?? [])].reverse().map((h, i) => (
            <p key={i} className="text-xs text-muted-foreground border-b pb-1">{new Date(h.at).toLocaleString("bn-BD")} • {COMPLAINT_STATUS_LABELS[h.status as Complaint["status"]] ?? h.status}{h.note ? ` — ${h.note}` : ""}</p>
          ))}
        </div>
        {c.kind === "maintenance" && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">এই টিকিটের খরচ</p>
            {(data?.expenses ?? []).length === 0 ? <p className="text-xs text-muted-foreground">কোনো খরচ যুক্ত নেই</p> : data!.expenses.map((e) => (
              <p key={e._id} className="text-sm">{e.expenseNo} • {e.date} • {e.category} • {tk(e.amount)} • {EXPENSE_STATUS_LABELS[e.status]}</p>
            ))}
            {can(MESS_EXPENSES_MANAGE) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Select value={exp.category} onValueChange={(v) => setExp({ ...exp, category: v })}><SelectTrigger><SelectValue placeholder="খাত" /></SelectTrigger><SelectContent>{(settings?.expenseCategories ?? []).map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
                <Input type="number" min={0} placeholder="৳" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} />
                <MethodSelect value={exp.method} onChange={(v) => setExp({ ...exp, method: v })} />
                <Input type="date" value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value })} />
                <Input className="col-span-2 sm:col-span-3" placeholder="বিবরণ" value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} />
                <Button variant="outline" disabled={busy} onClick={addExpense}>খরচ যুক্ত করুন</Button>
              </div>
            )}
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>বন্ধ করুন</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
