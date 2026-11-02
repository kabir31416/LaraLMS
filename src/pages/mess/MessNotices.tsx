import { useEffect, useState } from "react";
import { Plus, Archive, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessPage, MessSelect, useMessScope } from "@/components/mess/MessShell";
import { SuperDeleteButton } from "@/components/mess/SuperDelete";
import { Pager } from "@/components/mess/MessCommon";
import { api } from "@/lib/apiClient";
import { errMsg, NOTICE_TYPE_LABELS, qs, refName, todayISO, usePagedList, type Membership, type MessNotice, type NoticeType } from "@/lib/mess";

export default function MessNotices() {
  const { messId } = useMessScope();
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId, type, status]);
  const list = usePagedList<MessNotice>(`/mess/notices${qs({ messId, type, status, page, limit: 20 })}`);
  const [open, setOpen] = useState(false);
  const archive = async (n: MessNotice) => {
    try { await api.patch(`/mess/notices/${n._id}`, { status: n.status === "active" ? "archived" : "active" }); toast.success("আপডেট হয়েছে"); await list.reload(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <MessPage title="মেস নোটিশ" subtitle="মেস-ভিত্তিক বা নির্দিষ্ট সদস্যের জন্য নোটিশ — স্টুডেন্ট পোর্টালে দেখা যায়, চাইলে SMS-ও যায়" actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />নতুন নোটিশ</Button>}>
      <div className="flex flex-wrap gap-2">
        <Select value={type} onValueChange={setType}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব ধরন</SelectItem>{Object.entries(NOTICE_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">সক্রিয়</SelectItem><SelectItem value="archived">আর্কাইভ</SelectItem><SelectItem value="all">সব</SelectItem></SelectContent></Select>
      </div>
      {list.loading ? <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p> : list.error ? <p className="text-sm text-destructive">{list.error}</p> : list.items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">কোনো নোটিশ নেই</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.items.map((n) => (
            <Card key={n._id} className={n.status === "archived" ? "opacity-60" : n.type === "emergency" ? "border-destructive/40" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{n.title}</CardTitle>
                  <span className="flex shrink-0 items-center gap-1"><Badge variant="outline">{NOTICE_TYPE_LABELS[n.type]}</Badge><SuperDeleteButton entity="notice" id={n._id} what={`নোটিশ: ${n.title}`} onDeleted={list.reload} /></span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{refName(n.messId)}</span>
                  <span>{n.audience === "member" ? `সদস্য: ${n.studentId?.name ?? ""}` : "সব সদস্য"}</span>
                  <span>প্রকাশ: {n.publishDate}</span>
                  {n.expiryDate && <span>মেয়াদ: {n.expiryDate}</span>}
                  <span>পড়েছেন: {n.readCount ?? 0}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                {n.sms?.requested && <p className="text-xs text-muted-foreground"><MessageSquare className="h-3 w-3 inline mr-1" />SMS: {n.sms.sent}/{n.sms.recipients} পাঠানো{n.sms.failed ? `, ${n.sms.failed} ব্যর্থ` : ""}</p>}
                <Button size="sm" variant="outline" onClick={() => archive(n)}><Archive className="h-3.5 w-3.5 mr-1" />{n.status === "active" ? "আর্কাইভ" : "পুনরায় সক্রিয়"}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pager meta={list.meta} page={page} onPage={setPage} />
      <NoticeDialog open={open} onOpenChange={setOpen} onSaved={list.reload} />
    </MessPage>
  );
}

function NoticeDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => Promise<void> }) {
  const { messId: scopeMess } = useMessScope();
  const [f, setF] = useState({ messId: "", audience: "mess" as "mess" | "member", membershipId: "", type: "general" as NoticeType, title: "", body: "", publishDate: todayISO(), expiryDate: "", sendSms: false });
  const [busy, setBusy] = useState(false);
  const members = usePagedList<Membership>(open && f.messId && f.audience === "member" ? `/mess/memberships${qs({ messId: f.messId, status: "approved,active,on_leave,notice_given", limit: 100 })}` : null);
  useEffect(() => { if (open) setF({ messId: scopeMess !== "all" ? scopeMess : "", audience: "mess", membershipId: "", type: "general", title: "", body: "", publishDate: todayISO(), expiryDate: "", sendSms: false }); }, [open, scopeMess]);
  const save = async () => {
    if (!f.messId || !f.title.trim() || !f.body.trim()) { toast.error("মেস, শিরোনাম ও বিবরণ দিন"); return; }
    if (f.audience === "member" && !f.membershipId) { toast.error("সদস্য নির্বাচন করুন"); return; }
    setBusy(true);
    try {
      const n = await api.post<MessNotice>("/mess/notices", { ...f, membershipId: f.audience === "member" ? f.membershipId : undefined, expiryDate: f.expiryDate || undefined });
      toast.success(n.sms?.requested ? `নোটিশ প্রকাশিত — SMS ${n.sms.sent}/${n.sms.recipients}` : "নোটিশ প্রকাশিত হয়েছে");
      onOpenChange(false);
      await onSaved();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>নতুন মেস নোটিশ</DialogTitle><DialogDescription>SMS বর্তমান SMS সেটিংসের প্রোভাইডার দিয়ে যাবে; SMS ব্যর্থ হলেও নোটিশ প্রকাশিত থাকবে।</DialogDescription></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>মেস *</Label><MessSelect value={f.messId} onChange={(v) => setF({ ...f, messId: v, membershipId: "" })} /></div>
          <div className="space-y-1.5"><Label>ধরন</Label><Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as NoticeType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(NOTICE_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>প্রাপক</Label><Select value={f.audience} onValueChange={(v) => setF({ ...f, audience: v as "mess" | "member" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mess">মেসের সব সদস্য</SelectItem><SelectItem value="member">নির্দিষ্ট সদস্য</SelectItem></SelectContent></Select></div>
          {f.audience === "member" && (
            <div className="space-y-1.5"><Label>সদস্য *</Label>
              <Select value={f.membershipId} onValueChange={(v) => setF({ ...f, membershipId: v })}>
                <SelectTrigger><SelectValue placeholder={members.loading ? "লোড হচ্ছে..." : "নির্বাচন করুন"} /></SelectTrigger>
                <SelectContent>{members.items.map((m) => <SelectItem key={m._id} value={m._id}>{m.studentId?.name} ({m.studentId?.registrationId})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="sm:col-span-2 space-y-1.5"><Label>শিরোনাম *</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="sm:col-span-2 space-y-1.5"><Label>বিবরণ *</Label><Textarea rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>প্রকাশের তারিখ</Label><Input type="date" value={f.publishDate} onChange={(e) => setF({ ...f, publishDate: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>মেয়াদ শেষ</Label><Input type="date" value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} /></div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm"><Checkbox checked={f.sendSms} onCheckedChange={(v) => setF({ ...f, sendSms: v === true })} />শিক্ষার্থীর মোবাইলে SMS পাঠান</label>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button disabled={busy} onClick={save}>{busy ? (f.sendSms ? "SMS পাঠানো হচ্ছে..." : "প্রকাশ হচ্ছে...") : "প্রকাশ করুন"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
