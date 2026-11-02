import { useEffect, useMemo, useState } from "react";
import { Plus, Edit, Trash2, Users, History, BedDouble } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MessPage, MessSelect, useMessScope } from "@/components/mess/MessShell";
import { Pager, SearchInput, StatusBadge, TableState } from "@/components/mess/MessCommon";
import { api } from "@/lib/apiClient";
import {
  errMsg, MEMBERSHIP_STATUS_LABELS, MESS_STATUS_LABELS, qs, refName, RESERVATION_STATUS_LABELS, RESPONSIBILITY_LABELS, ROOM_STATUS_LABELS,
  SEAT_STATUS_LABELS, tk, useApiData, usePagedList, type Mess, type MessStaffRow, type Room, type Seat, type SeatStatus,
} from "@/lib/mess";
import { MESS_MANAGE } from "@/lib/permissions";

export default function MessSetup() {
  const { can } = useMessScope();
  const [tab, setTab] = useState("messes");
  return (
    <MessPage title="মেস ও রুম/সিট ব্যবস্থাপনা" subtitle="মেস/হোস্টেল, ম্যানেজার ও স্টাফ, রুম এবং সিট">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="messes">মেস / হোস্টেল</TabsTrigger>
          <TabsTrigger value="rooms">রুম ও সিট</TabsTrigger>
        </TabsList>
        <TabsContent value="messes"><MessesTab canManage={can(MESS_MANAGE)} /></TabsContent>
        <TabsContent value="rooms"><RoomsTab canManage={can(MESS_MANAGE)} /></TabsContent>
      </Tabs>
    </MessPage>
  );
}

// -------------------- Messes --------------------

function MessesTab({ canManage }: { canManage: boolean }) {
  const { messes, messesLoading, reloadMesses } = useMessScope();
  const [editing, setEditing] = useState<Mess | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [staffFor, setStaffFor] = useState<Mess | null>(null);
  const [deleting, setDeleting] = useState<Mess | null>(null);

  const toggleStatus = async (m: Mess) => {
    try {
      await api.patch(`/mess/messes/${m._id}`, { status: m.status === "active" ? "inactive" : "active" });
      toast.success(m.status === "active" ? "মেস নিষ্ক্রিয় করা হয়েছে" : "মেস সক্রিয় করা হয়েছে");
      await reloadMesses();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  const remove = async () => {
    if (!deleting) return;
    try {
      await api.del(`/mess/messes/${deleting._id}`);
      toast.success("মেস মুছে ফেলা হয়েছে");
      await reloadMesses();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">মেস / হোস্টেল তালিকা</CardTitle>
        {canManage && <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />নতুন মেস</Button>}
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>কোড</TableHead><TableHead>নাম</TableHead><TableHead>যোগাযোগ</TableHead><TableHead>ম্যানেজার / স্টাফ</TableHead>
            <TableHead>রুম / সিট</TableHead><TableHead>সক্রিয় সদস্য</TableHead><TableHead>অবস্থা</TableHead>{canManage && <TableHead className="text-right">কাজ</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            <TableState colSpan={8} loading={messesLoading} error={null} empty={messes.length === 0} emptyText="কোনো মেস নেই" />
            {!messesLoading && messes.map((m) => {
              const managers = m.staff.filter((s) => s.responsibility === "manager").map((s) => refName(s.staffId));
              return (
                <TableRow key={m._id}>
                  <TableCell className="font-mono text-xs">{m.code}</TableCell>
                  <TableCell><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.address || "—"}</p></TableCell>
                  <TableCell className="text-sm">{m.contactNumber || "—"}</TableCell>
                  <TableCell className="text-sm">{managers.length ? managers.join(", ") : "—"}<p className="text-xs text-muted-foreground">মোট স্টাফ: {m.staff.length}</p></TableCell>
                  <TableCell className="text-sm">{m.roomCount ?? 0} / {m.totalSeats ?? 0}<p className="text-xs text-muted-foreground">খালি: {m.seatCounts?.available ?? 0}</p></TableCell>
                  <TableCell>{m.activeMembers ?? 0}</TableCell>
                  <TableCell><StatusBadge status={m.status} label={MESS_STATUS_LABELS[m.status]} /></TableCell>
                  {canManage && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" className="mr-1" onClick={() => setStaffFor(m)} title="স্টাফ"><Users className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" className="mr-1" onClick={() => { setEditing(m); setFormOpen(true); }} title="সম্পাদনা"><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" className="mr-1" onClick={() => toggleStatus(m)}>{m.status === "active" ? "নিষ্ক্রিয়" : "সক্রিয়"}</Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleting(m)} title="মুছুন"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      <MessFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} onSaved={reloadMesses} />
      <StaffDialog mess={staffFor} onOpenChange={(v) => !v && setStaffFor(null)} onSaved={reloadMesses} />
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>মেস মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>শুধু ভুলবশত তৈরি, কোনো রুম/সদস্য/আর্থিক রেকর্ডবিহীন মেস মুছে ফেলা যায়। অন্যথায় নিষ্ক্রিয় করুন।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>বাতিল</AlertDialogCancel><AlertDialogAction onClick={remove}>নিশ্চিত করুন</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function MessFormDialog({ open, onOpenChange, editing, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Mess | null; onSaved: () => Promise<void> }) {
  const { settings } = useMessScope();
  const blank = { name: "", address: "", contactNumber: "", openingDate: "", notes: "", defaultDiningCharge: "", defaultDeposit: "", billingDay: "", dueDay: "" };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const str = (n?: number) => (n == null ? "" : String(n));
  useEffect(() => {
    if (open) setForm({ name: editing?.name ?? "", address: editing?.address ?? "", contactNumber: editing?.contactNumber ?? "", openingDate: editing?.openingDate ?? "", notes: editing?.notes ?? "", defaultDiningCharge: str(editing?.defaultDiningCharge), defaultDeposit: str(editing?.defaultDeposit), billingDay: str(editing?.billingDay), dueDay: str(editing?.dueDay) });
  }, [open, editing]);
  // Blank = use the global Mess Settings value (sent as null so an existing override is cleared).
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const save = async () => {
    if (!form.name.trim()) { toast.error("মেসের নাম দিন"); return; }
    setBusy(true);
    try {
      const day = (v: string) => { const n = num(v); return n == null ? null : Math.min(28, Math.max(1, Math.round(n))); };
      const body = { ...form, openingDate: form.openingDate || undefined, defaultDiningCharge: num(form.defaultDiningCharge), defaultDeposit: num(form.defaultDeposit), billingDay: day(form.billingDay), dueDay: day(form.dueDay) };
      if (editing) await api.patch(`/mess/messes/${editing._id}`, body);
      else await api.post("/mess/messes", body);
      toast.success(editing ? "মেস আপডেট হয়েছে" : "মেস তৈরি হয়েছে");
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
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? `মেস সম্পাদনা — ${editing.code}` : "নতুন মেস / হোস্টেল"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1.5"><Label>মেসের নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="sm:col-span-2 space-y-1.5"><Label>ঠিকানা</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>যোগাযোগ নম্বর</Label><Input value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>চালুর তারিখ</Label><Input type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} /></div>
          <div className="sm:col-span-2 space-y-1.5"><Label>নোট</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <p className="sm:col-span-2 text-sm font-semibold pt-1">এই মেসের বিলিং ডিফল্ট <span className="font-normal text-xs text-muted-foreground">(ফাঁকা = মেস সেটিংসের মান)</span></p>
          <div className="space-y-1.5"><Label>ডিফল্ট মাসিক ডাইনিং চার্জ (৳)</Label><Input type="number" min={0} value={form.defaultDiningCharge} placeholder={String(settings?.defaultRent ?? "")} onChange={(e) => setForm({ ...form, defaultDiningCharge: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>ডিফল্ট এক মাসের অগ্রিম / জামানত (৳)</Label><Input type="number" min={0} value={form.defaultDeposit} placeholder={String(settings?.defaultDeposit ?? "")} onChange={(e) => setForm({ ...form, defaultDeposit: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>বিল তৈরির দিন (১-২৮)</Label><Input type="number" min={1} max={28} value={form.billingDay} placeholder={String(settings?.billingDay ?? 1)} onChange={(e) => setForm({ ...form, billingDay: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>পরিশোধের শেষ দিন (১-২৮)</Label><Input type="number" min={1} max={28} value={form.dueDay} placeholder={String(settings?.dueDay ?? 10)} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} /></div>
          <p className="sm:col-span-2 text-xs text-muted-foreground">পরিবর্তন শুধু ভবিষ্যতের ভর্তি ও বিলে প্রযোজ্য। সিটের নিজস্ব চার্জ থাকলে সেটিই আগে ব্যবহৃত হয়।</p>
          {!editing && <p className="sm:col-span-2 text-xs text-muted-foreground">মেস কোড স্বয়ংক্রিয়ভাবে তৈরি হবে।</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={save}>{busy ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StaffOption { _id: string; name: string; phone: string; staffType: string; staffId?: string }

function StaffDialog({ mess, onOpenChange, onSaved }: { mess: Mess | null; onOpenChange: (v: boolean) => void; onSaved: () => Promise<void> }) {
  const { data: options } = useApiData<StaffOption[]>(mess ? "/mess/staff-options" : null);
  const [rows, setRows] = useState<{ staffId: string; responsibility: MessStaffRow["responsibility"] }[]>([]);
  const [pick, setPick] = useState("");
  const [pickRole, setPickRole] = useState<MessStaffRow["responsibility"]>("manager");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (mess) setRows(mess.staff.map((s) => ({ staffId: typeof s.staffId === "string" ? s.staffId : s.staffId._id, responsibility: s.responsibility })));
  }, [mess]);
  const nameOf = (id: string) => {
    const o = options?.find((x) => x._id === id);
    if (o) return `${o.name} (${o.staffType})`;
    const s = mess?.staff.find((x) => (typeof x.staffId === "string" ? x.staffId : x.staffId._id) === id);
    return s && typeof s.staffId !== "string" ? `${s.staffId.name} (${s.staffId.staffType})` : id;
  };
  const save = async () => {
    if (!mess) return;
    setBusy(true);
    try {
      await api.patch(`/mess/messes/${mess._id}/staff`, { staff: rows });
      toast.success("স্টাফ তালিকা আপডেট হয়েছে");
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!mess} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>মেস স্টাফ — {mess?.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">বিদ্যমান স্টাফ রেকর্ড থেকে নির্বাচন করুন। মেস ম্যানেজার/হিসাবরক্ষক/কেয়ারটেকার টাইপের স্টাফ মোবাইল ও স্টাফ আইডি দিয়ে লগইন করে শুধু এখানে যুক্ত মেসের তথ্য দেখতে পারবেন।</p>
        <div className="space-y-2">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">কোনো স্টাফ যুক্ত নেই</p> : rows.map((r) => (
            <div key={r.staffId} className="flex items-center gap-2 border rounded-md p-2">
              <span className="flex-1 text-sm">{nameOf(r.staffId)}</span>
              <Select value={r.responsibility} onValueChange={(v) => setRows(rows.map((x) => (x.staffId === r.staffId ? { ...x, responsibility: v as MessStaffRow["responsibility"] } : x)))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(RESPONSIBILITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => setRows(rows.filter((x) => x.staffId !== r.staffId))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="স্টাফ নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>
              {(options ?? []).filter((o) => !rows.some((r) => r.staffId === o._id)).map((o) => <SelectItem key={o._id} value={o._id}>{o.name} — {o.staffType} ({o.phone})</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={pickRole} onValueChange={(v) => setPickRole(v as MessStaffRow["responsibility"])}>
            <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(RESPONSIBILITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" disabled={!pick} onClick={() => { setRows([...rows, { staffId: pick, responsibility: pickRole }]); setPick(""); }}>যুক্ত করুন</Button>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={save}>{busy ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Rooms & seats --------------------

function RoomsTab({ canManage }: { canManage: boolean }) {
  const { messId, messes, settings } = useMessScope();
  const [localMess, setLocalMess] = useState("");
  const effectiveMess = messId !== "all" ? messId : localMess;
  const { data: rooms, loading: roomsLoading, error: roomsError, reload: reloadRooms } = useApiData<Room[]>(effectiveMess ? `/mess/rooms${qs({ messId: effectiveMess })}` : null);
  const [roomId, setRoomId] = useState("all");
  const [seatStatus, setSeatStatus] = useState("all");
  const [seatSearch, setSeatSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { setRoomId("all"); setPage(1); }, [effectiveMess]);
  useEffect(() => setPage(1), [roomId, seatStatus, seatSearch]);
  const seatPath = effectiveMess ? `/mess/seats${qs({ messId: effectiveMess, roomId, status: seatStatus, search: seatSearch, page, limit: 50 })}` : null;
  const seats = usePagedList<Seat>(seatPath);
  const [roomForm, setRoomForm] = useState<{ open: boolean; editing: Room | null }>({ open: false, editing: null });
  const [seatForm, setSeatForm] = useState<{ open: boolean; editing: Seat | null }>({ open: false, editing: null });
  const [historyFor, setHistoryFor] = useState<Seat | null>(null);

  const reloadAll = async () => { await Promise.all([reloadRooms(), seats.reload()]); };
  const removeRoom = async (r: Room) => {
    try { await api.del(`/mess/rooms/${r._id}`); toast.success("রুম মুছে ফেলা হয়েছে"); await reloadAll(); } catch (err) { toast.error(errMsg(err)); }
  };
  const removeSeat = async (s: Seat) => {
    try { await api.del(`/mess/seats/${s._id}`); toast.success("সিট মুছে ফেলা হয়েছে"); await reloadAll(); } catch (err) { toast.error(errMsg(err)); }
  };

  if (!effectiveMess) {
    return (
      <Card><CardContent className="py-8 space-y-3 max-w-sm mx-auto text-center">
        <p className="text-sm text-muted-foreground">রুম ও সিট দেখতে একটি মেস নির্বাচন করুন</p>
        <MessSelect value={localMess} onChange={setLocalMess} />
        {messes.length === 0 && <p className="text-xs text-muted-foreground">আগে একটি মেস তৈরি করুন</p>}
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {messId === "all" && <div className="max-w-xs"><MessSelect value={localMess} onChange={setLocalMess} /></div>}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">রুম ({rooms?.length ?? 0})</CardTitle>
          {canManage && <Button size="sm" onClick={() => setRoomForm({ open: true, editing: null })}><Plus className="h-4 w-4 mr-1" />নতুন রুম</Button>}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>রুম</TableHead><TableHead>তলা</TableHead><TableHead>ধরন</TableHead><TableHead>ধারণক্ষমতা</TableHead>
              <TableHead>সিট (খালি/সংরক্ষিত/দখল)</TableHead><TableHead>সুবিধা</TableHead><TableHead>অবস্থা</TableHead>{canManage && <TableHead className="text-right">কাজ</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              <TableState colSpan={8} loading={roomsLoading} error={roomsError} empty={(rooms ?? []).length === 0} emptyText="কোনো রুম নেই" />
              {!roomsLoading && (rooms ?? []).map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.floor || "—"}</TableCell>
                  <TableCell>{r.roomType || "—"}</TableCell>
                  <TableCell>{r.seatCount ?? 0} / {r.totalSeats}</TableCell>
                  <TableCell className="text-sm">{r.seatCounts?.available ?? 0} / {r.seatCounts?.reserved ?? 0} / {r.seatCounts?.occupied ?? 0}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{r.facilities.join(", ") || "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} label={ROOM_STATUS_LABELS[r.status]} /></TableCell>
                  {canManage && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" className="mr-1" onClick={() => setSeatForm({ open: true, editing: null })} title="সিট যোগ"><BedDouble className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" className="mr-1" onClick={() => setRoomForm({ open: true, editing: r })}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" onClick={() => removeRoom(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">সিট</CardTitle>
            {canManage && (rooms ?? []).length > 0 && <Button size="sm" onClick={() => setSeatForm({ open: true, editing: null })}><Plus className="h-4 w-4 mr-1" />নতুন সিট</Button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue placeholder="রুম" /></SelectTrigger>
              <SelectContent><SelectItem value="all">সব রুম</SelectItem>{(rooms ?? []).map((r) => <SelectItem key={r._id} value={r._id}>রুম {r.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={seatStatus} onValueChange={setSeatStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">সব অবস্থা</SelectItem>{Object.entries(SEAT_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <SearchInput value={seatSearch} onChange={setSeatSearch} placeholder="সিট নম্বর" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>রুম</TableHead><TableHead>সিট</TableHead><TableHead>ধরন</TableHead><TableHead>মাসিক ডাইনিং চার্জ</TableHead>
              <TableHead>বর্তমান সদস্য</TableHead><TableHead>খালি হবে</TableHead><TableHead>অবস্থা</TableHead><TableHead className="text-right">কাজ</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableState colSpan={8} loading={seats.loading} error={seats.error} empty={seats.items.length === 0} emptyText="কোনো সিট নেই" />
              {!seats.loading && seats.items.map((s) => (
                <TableRow key={s._id}>
                  <TableCell>{refName(s.roomId)}</TableCell>
                  <TableCell className="font-medium">{s.seatNumber}</TableCell>
                  <TableCell>{s.seatType || "—"}</TableCell>
                  <TableCell>{tk(s.monthlyRent)}</TableCell>
                  <TableCell className="text-sm">{s.currentStudentId ? `${s.currentStudentId.name} (${s.currentStudentId.registrationId})` : "—"}</TableCell>
                  <TableCell className="text-sm">{s.availableFrom || "—"}</TableCell>
                  <TableCell><StatusBadge status={s.status} label={SEAT_STATUS_LABELS[s.status]} /></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" className="mr-1" onClick={() => setHistoryFor(s)} title="ইতিহাস"><History className="h-3.5 w-3.5" /></Button>
                    {canManage && <Button size="sm" variant="outline" className="mr-1" onClick={() => setSeatForm({ open: true, editing: s })}><Edit className="h-3.5 w-3.5" /></Button>}
                    {canManage && <Button size="sm" variant="outline" onClick={() => removeSeat(s)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-3"><Pager meta={seats.meta} page={page} onPage={setPage} /></div>
        </CardContent>
      </Card>

      <RoomFormDialog open={roomForm.open} editing={roomForm.editing} messId={effectiveMess} roomTypes={settings?.roomTypes ?? []} onOpenChange={(v) => setRoomForm({ open: v, editing: v ? roomForm.editing : null })} onSaved={reloadAll} />
      <SeatFormDialog open={seatForm.open} editing={seatForm.editing} rooms={rooms ?? []} seatTypes={settings?.seatTypes ?? []} defaultRent={settings?.defaultRent ?? 0} onOpenChange={(v) => setSeatForm({ open: v, editing: v ? seatForm.editing : null })} onSaved={reloadAll} />
      <SeatHistoryDialog seat={historyFor} onOpenChange={(v) => !v && setHistoryFor(null)} />
    </div>
  );
}

function RoomFormDialog({ open, editing, messId, roomTypes, onOpenChange, onSaved }: { open: boolean; editing: Room | null; messId: string; roomTypes: string[]; onOpenChange: (v: boolean) => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ name: "", floor: "", roomType: "", totalSeats: "1", facilities: "", status: "active" as Room["status"], notes: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm({ name: editing?.name ?? "", floor: editing?.floor ?? "", roomType: editing?.roomType ?? "", totalSeats: String(editing?.totalSeats ?? 1), facilities: editing?.facilities.join(", ") ?? "", status: editing?.status ?? "active", notes: editing?.notes ?? "" });
  }, [open, editing]);
  const save = async () => {
    if (!form.name.trim()) { toast.error("রুম নম্বর/নাম দিন"); return; }
    const body = { name: form.name, floor: form.floor || undefined, roomType: form.roomType || undefined, totalSeats: Number(form.totalSeats) || 0, facilities: form.facilities.split(",").map((f) => f.trim()).filter(Boolean), status: form.status, notes: form.notes || undefined };
    setBusy(true);
    try {
      if (editing) await api.patch(`/mess/rooms/${editing._id}`, body);
      else await api.post("/mess/rooms", { ...body, messId });
      toast.success(editing ? "রুম আপডেট হয়েছে" : "রুম তৈরি হয়েছে");
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
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "রুম সম্পাদনা" : "নতুন রুম"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>রুম নম্বর / নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>তলা</Label><Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>রুমের ধরন</Label>
            <Select value={form.roomType || "__none"} onValueChange={(v) => setForm({ ...form, roomType: v === "__none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">—</SelectItem>{roomTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>মোট সিট (ধারণক্ষমতা) *</Label><Input type="number" min={0} value={form.totalSeats} onChange={(e) => setForm({ ...form, totalSeats: e.target.value })} /></div>
          <div className="sm:col-span-2 space-y-1.5"><Label>সুবিধা (কমা দিয়ে)</Label><Input value={form.facilities} onChange={(e) => setForm({ ...form, facilities: e.target.value })} placeholder="ফ্যান, এটাচড বাথ, ওয়াইফাই" /></div>
          {editing && (
            <div className="space-y-1.5"><Label>অবস্থা</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Room["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ROOM_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="sm:col-span-2 space-y-1.5"><Label>নোট</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={save}>{busy ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SeatFormDialog({ open, editing, rooms, seatTypes, defaultRent, onOpenChange, onSaved }: { open: boolean; editing: Seat | null; rooms: Room[]; seatTypes: string[]; defaultRent: number; onOpenChange: (v: boolean) => void; onSaved: () => Promise<void> }) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [form, setForm] = useState({ roomId: "", seatNumber: "", count: "2", prefix: "", startNumber: "1", seatType: "", monthlyRent: "0", availableFrom: "", notes: "", status: "available" as SeatStatus });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setMode("single");
      setForm({ roomId: editing ? (typeof editing.roomId === "string" ? editing.roomId : editing.roomId._id) : rooms[0]?._id ?? "", seatNumber: editing?.seatNumber ?? "", count: "2", prefix: "", startNumber: "1", seatType: editing?.seatType ?? "", monthlyRent: String(editing?.monthlyRent ?? defaultRent), availableFrom: editing?.availableFrom ?? "", notes: editing?.notes ?? "", status: editing?.status ?? "available" });
    }
  }, [open, editing, rooms, defaultRent]);
  const manualStatus = !editing || ["available", "maintenance", "inactive"].includes(editing.status);
  const save = async () => {
    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/mess/seats/${editing._id}`, {
          seatNumber: form.seatNumber, seatType: form.seatType || undefined, monthlyRent: Number(form.monthlyRent) || 0,
          availableFrom: form.availableFrom || undefined, notes: form.notes || undefined, ...(manualStatus && form.status !== editing.status ? { status: form.status } : {}),
        });
        toast.success("সিট আপডেট হয়েছে");
      } else {
        if (!form.roomId) { toast.error("রুম নির্বাচন করুন"); setBusy(false); return; }
        await api.post("/mess/seats", {
          roomId: form.roomId,
          ...(mode === "single" ? { seatNumber: form.seatNumber } : { count: Number(form.count) || 1, prefix: form.prefix || undefined, startNumber: Number(form.startNumber) || 1 }),
          seatType: form.seatType || undefined, monthlyRent: Number(form.monthlyRent) || 0, availableFrom: form.availableFrom || undefined, notes: form.notes || undefined,
        });
        toast.success("সিট তৈরি হয়েছে");
      }
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
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? `সিট সম্পাদনা — ${editing.seatNumber}` : "নতুন সিট"}</DialogTitle></DialogHeader>
        {!editing && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "bulk")}>
            <TabsList><TabsTrigger value="single">একটি সিট</TabsTrigger><TabsTrigger value="bulk">একসাথে একাধিক</TabsTrigger></TabsList>
          </Tabs>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!editing && (
            <div className="sm:col-span-2 space-y-1.5"><Label>রুম *</Label>
              <Select value={form.roomId} onValueChange={(v) => setForm({ ...form, roomId: v })}>
                <SelectTrigger><SelectValue placeholder="রুম নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>{rooms.map((r) => <SelectItem key={r._id} value={r._id}>রুম {r.name} ({r.seatCount ?? 0}/{r.totalSeats})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {editing || mode === "single" ? (
            <div className="space-y-1.5"><Label>সিট নম্বর *</Label><Input value={form.seatNumber} onChange={(e) => setForm({ ...form, seatNumber: e.target.value })} placeholder="যেমন: A-1" /></div>
          ) : (
            <>
              <div className="space-y-1.5"><Label>সিট সংখ্যা</Label><Input type="number" min={1} max={100} value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>প্রিফিক্স</Label><Input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} placeholder="যেমন: A-" /></div>
              <div className="space-y-1.5"><Label>শুরুর নম্বর</Label><Input type="number" min={0} value={form.startNumber} onChange={(e) => setForm({ ...form, startNumber: e.target.value })} /></div>
            </>
          )}
          <div className="space-y-1.5"><Label>সিটের ধরন</Label>
            <Select value={form.seatType || "__none"} onValueChange={(v) => setForm({ ...form, seatType: v === "__none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">—</SelectItem>{seatTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>মাসিক ডাইনিং চার্জ (৳) *</Label><Input type="number" min={0} value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>খালি হবে (তারিখ)</Label><Input type="date" value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} /></div>
          {editing && (
            <div className="space-y-1.5"><Label>অবস্থা</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as SeatStatus })} disabled={!manualStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {manualStatus ? (["available", "maintenance", "inactive"] as SeatStatus[]).map((k) => <SelectItem key={k} value={k}>{SEAT_STATUS_LABELS[k]}</SelectItem>)
                    : <SelectItem value={editing.status}>{SEAT_STATUS_LABELS[editing.status]}</SelectItem>}
                </SelectContent>
              </Select>
              {!manualStatus && <p className="text-xs text-muted-foreground">সদস্য/রিজার্ভেশন থাকা অবস্থায় অবস্থা হাতে বদলানো যায় না</p>}
            </div>
          )}
          <div className="sm:col-span-2 space-y-1.5"><Label>নোট</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={save}>{busy ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SeatHistoryResponse {
  history: { membershipNo: string; student: { name: string; registrationId: string } | null; status: keyof typeof MEMBERSHIP_STATUS_LABELS; fromDate: string; toDate?: string; monthlyRent: number; reason?: string }[];
  reservations: { reservationNo: string; studentId: { name: string; registrationId: string } | null; reservationDate: string; expiryDate: string; status: keyof typeof RESERVATION_STATUS_LABELS }[];
}

function SeatHistoryDialog({ seat, onOpenChange }: { seat: Seat | null; onOpenChange: (v: boolean) => void }) {
  const { data, loading, error } = useApiData<SeatHistoryResponse>(seat ? `/mess/seats/${seat._id}/history` : null);
  const rows = useMemo(() => data?.history ?? [], [data]);
  return (
    <Dialog open={!!seat} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>সিটের ইতিহাস — রুম {refName(seat?.roomId)}, সিট {seat?.seatNumber}</DialogTitle></DialogHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>সদস্য</TableHead><TableHead>সদস্যপদ</TableHead><TableHead>থেকে</TableHead><TableHead>পর্যন্ত</TableHead><TableHead>মাসিক চার্জ</TableHead><TableHead>অবস্থা</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableState colSpan={6} loading={loading} error={error} empty={rows.length === 0} emptyText="এই সিটে এখনো কেউ থাকেননি" />
              {!loading && rows.map((h, i) => (
                <TableRow key={i}>
                  <TableCell>{h.student?.name ?? "—"} <span className="text-xs text-muted-foreground">{h.student?.registrationId}</span></TableCell>
                  <TableCell className="font-mono text-xs">{h.membershipNo}</TableCell>
                  <TableCell>{h.fromDate}</TableCell>
                  <TableCell>{h.toDate || "বর্তমান"}</TableCell>
                  <TableCell>{tk(h.monthlyRent)}</TableCell>
                  <TableCell>{MEMBERSHIP_STATUS_LABELS[h.status]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {(data?.reservations?.length ?? 0) > 0 && (
          <div className="text-sm space-y-1">
            <p className="font-medium">রিজার্ভেশন</p>
            {data!.reservations.map((r) => <p key={r.reservationNo} className="text-xs text-muted-foreground">{r.reservationNo} • {r.studentId?.name} • {r.reservationDate} → {r.expiryDate} • {RESERVATION_STATUS_LABELS[r.status]}</p>)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
