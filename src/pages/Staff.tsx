import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BedDouble, Briefcase, CalendarDays, Eye, KeyRound, Layers, Mail, MapPin, MoreVertical, Pencil, Phone, Power, Search, ShieldCheck, Trash2, UserCheck,
  UserPlus, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/dashboard/DashboardKit";
import { useStaff } from "@/contexts/StaffContext";
import { useBatches } from "@/contexts/BatchContext";
import { ApiClientError, hasPermission, useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { MESS_VIEW, SETTINGS_MANAGE } from "@/lib/permissions";
import type { AuditLogEntry } from "@/types/academic";
import { cn } from "@/lib/utils";
import { STAFF_TYPES, STAFF_TYPE_LABELS, type Staff, type StaffType } from "@/types/staff";
import { StaffForm } from "@/components/staff/StaffForm";

/**
 * Staff Management. Same StaffContext / StaffForm / API as before — this is
 * a presentation redesign plus a profile drawer, confirmations and an
 * activate/deactivate shortcut. Admin-type records stay editable only by
 * the Super Admin (enforced server-side; mirrored here).
 */

const PAGE_SIZE = 20;
const MESS_TYPES: StaffType[] = ["Mess Manager", "Mess Accountant", "Mess Caretaker"];

const TYPE_TONE: Record<StaffType, string> = {
  Admin: "bg-primary/10 text-primary border-primary/20",
  Teacher: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  Staff: "bg-muted text-muted-foreground",
  "Batch Director": "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  "Mess Manager": "bg-teal-500/10 text-teal-700 border-teal-500/20",
  "Mess Accountant": "bg-teal-500/10 text-teal-700 border-teal-500/20",
  "Mess Caretaker": "bg-teal-500/10 text-teal-700 border-teal-500/20",
};

function errText(err: unknown, fallback: string) {
  return err instanceof ApiClientError ? err.message : fallback;
}

function StaffAvatar({ s, className }: { s: Staff; className?: string }) {
  return (
    <Avatar className={cn("h-9 w-9", className)}>
      {s.photo && <AvatarImage src={s.photo} alt="" className="object-cover" />}
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{s.name.trim().charAt(0)}</AvatarFallback>
    </Avatar>
  );
}

function StatusBadge({ status }: { status: Staff["status"] }) {
  return <Badge variant="outline" className={status === "সক্রিয়" ? "border-success/20 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>{status}</Badge>;
}

interface MessRow { _id: string; name: string; staff: { staffId: { _id: string } | string; responsibility: string }[] }

export default function StaffPage() {
  const { staff, updateStaff, deleteStaff } = useStaff();
  const { getBatchesByDirector } = useBatches();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [viewing, setViewing] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState<Staff | null>(null);
  const [resetting, setResetting] = useState<Staff | null>(null);

  // Mess assignments (only for roles allowed to see Mess data — the API enforces it).
  const canSeeMess = hasPermission(user, MESS_VIEW);
  const messes = useQuery({ queryKey: ["staff", "mess-assignments"], queryFn: () => api.get<MessRow[]>("/mess/messes"), enabled: canSeeMess, staleTime: 120_000, retry: false });
  const messesFor = (staffId: string) =>
    (messes.data ?? []).filter((m) => m.staff.some((x) => (typeof x.staffId === "string" ? x.staffId : x.staffId?._id) === staffId)).map((m) => m.name);

  // Recent staff changes from the existing audit log (only for users the API lets read it).
  const canSeeAudit = hasPermission(user, "audit:read") || hasPermission(user, SETTINGS_MANAGE);
  const activity = useQuery({
    queryKey: ["staff", "activity"],
    queryFn: () => api.get<AuditLogEntry[]>("/audit-logs?module=staff&limit=6&sortBy=timestamp&sortOrder=desc"),
    enabled: canSeeAudit,
    staleTime: 60_000,
    retry: false,
  });
  const staffName = (id?: string) => staff.find((s) => s.id === id)?.name;

  const counts = useMemo(() => {
    const by = (t: StaffType[]) => staff.filter((s) => t.includes(s.staffType)).length;
    return {
      total: staff.length,
      active: staff.filter((s) => s.status === "সক্রিয়").length,
      teachers: by(["Teacher"]),
      directors: by(["Batch Director"]),
      mess: by(MESS_TYPES),
      other: by(["Admin", "Staff"]),
    };
  }, [staff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff
      .filter((s) => {
        const matchSearch = !q || s.name.toLowerCase().includes(q) || s.mobile.includes(q) || (s.email || "").toLowerCase().includes(q) || (s.staffId || "").toLowerCase().includes(q);
        const matchType = type === "all" || (type === "mess" ? MESS_TYPES.includes(s.staffType) : s.staffType === type);
        const matchStatus = status === "all" || s.status === status;
        return matchSearch && matchType && matchStatus;
      })
      .sort((a, b) => Number(b.status === "সক্রিয়") - Number(a.status === "সক্রিয়") || a.name.localeCompare(b.name));
  }, [staff, search, type, status]);
  useEffect(() => setPage(1), [search, type, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const locked = (s: Staff) => s.staffType === "Admin" && !user?.isSuperAdmin;
  const openEdit = (s: Staff) => { setViewing(null); setEditStaff(s); setFormOpen(true); };
  const toggleStatus = async (s: Staff) => {
    const next = s.status === "সক্রিয়" ? "নিষ্ক্রিয়" : "সক্রিয়";
    try {
      const updated = await updateStaff(s.id, { status: next });
      toast.success(next === "সক্রিয়" ? `${s.name} সক্রিয় করা হয়েছে` : `${s.name} নিষ্ক্রিয় করা হয়েছে — পোর্টালে লগইন করতে পারবেন না`);
      if (viewing?.id === s.id) setViewing(updated);
    } catch (err) {
      toast.error(errText(err, "অবস্থা পরিবর্তন করা যায়নি"));
    }
  };

  const assignmentText = (s: Staff) => {
    if (s.staffType === "Batch Director") {
      const b = getBatchesByDirector(s.id);
      return b.length ? b.map((x) => x.name).join(", ") : "কোনো ব্যাচ নেই";
    }
    if (MESS_TYPES.includes(s.staffType)) {
      if (!canSeeMess) return "—";
      const m = messesFor(s.id);
      return m.length ? m.join(", ") : "কোনো মেস নেই";
    }
    return "—";
  };

  const rowMenu = (s: Staff) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`${s.name} — কাজ`}><MoreVertical className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewing(s)}><Eye className="mr-2 h-4 w-4" />প্রোফাইল দেখুন</DropdownMenuItem>
        <DropdownMenuItem disabled={locked(s)} onClick={() => openEdit(s)}><Pencil className="mr-2 h-4 w-4" />সম্পাদনা / দায়িত্ব</DropdownMenuItem>
        <DropdownMenuItem disabled={locked(s)} onClick={() => void toggleStatus(s)}><Power className="mr-2 h-4 w-4" />{s.status === "সক্রিয়" ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}</DropdownMenuItem>
        {s.staffType === "Admin" && user?.isSuperAdmin && <DropdownMenuItem onClick={() => setResetting(s)}><KeyRound className="mr-2 h-4 w-4" />লগইন পাসওয়ার্ড রিসেট</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={locked(s)} className="text-destructive focus:text-destructive" onClick={() => setDeleting(s)}><Trash2 className="mr-2 h-4 w-4" />মুছে ফেলুন</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">স্টাফ ম্যানেজমেন্ট</h1>
            <p className="text-sm text-muted-foreground">শিক্ষক, ব্যাচ ডিরেক্টর, মেস স্টাফ ও এডমিন — দায়িত্ব, অবস্থা ও পোর্টাল অ্যাক্সেস</p>
          </div>
          <Button onClick={() => { setEditStaff(null); setFormOpen(true); }}><UserPlus className="h-4 w-4" />নতুন স্টাফ</Button>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <StatCard title="মোট স্টাফ" value={String(counts.total)} icon={Users} variant="primary" description={`${counts.active} জন সক্রিয়`} onClick={() => { setType("all"); setStatus("all"); }} />
          <StatCard title="শিক্ষক" value={String(counts.teachers)} icon={Briefcase} variant="info" onClick={() => setType("Teacher")} />
          <StatCard title="ব্যাচ ডিরেক্টর" value={String(counts.directors)} icon={Layers} variant="info" onClick={() => setType("Batch Director")} />
          <StatCard title="মেস স্টাফ" value={String(counts.mess)} icon={BedDouble} variant="success" description="ম্যানেজার / হিসাবরক্ষক / কেয়ারটেকার" onClick={() => setType("mess")} />
          <StatCard title="এডমিন ও অন্যান্য" value={String(counts.other)} icon={ShieldCheck} variant="warning" className="col-span-2 lg:col-span-1" />
        </div>

        {canSeeAudit && (activity.data?.length ?? 0) > 0 && (
          <Card className="p-3 sm:p-4">
            <p className="mb-2 text-sm font-semibold">সাম্প্রতিক পরিবর্তন</p>
            <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {activity.data!.map((a) => {
                const verb = a.action.endsWith(".create") ? "যোগ করা হয়েছে" : a.action.endsWith(".delete") ? "মুছে ফেলা হয়েছে" : "আপডেট হয়েছে";
                const who = staffName(a.targetId) ?? ((a.before ?? a.after) as { name?: string } | undefined)?.name ?? "স্টাফ";
                return (
                  <li key={(a as AuditLogEntry & { _id?: string })._id ?? a.id} className="flex min-w-0 items-baseline gap-2">
                    <span className={cn("h-1.5 w-1.5 shrink-0 translate-y-[-2px] rounded-full", a.action.endsWith(".delete") ? "bg-destructive" : a.action.endsWith(".create") ? "bg-success" : "bg-primary")} aria-hidden />
                    <span className="min-w-0 truncate"><span className="font-medium">{who}</span> — {verb}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{new Date(a.timestamp).toLocaleDateString("bn-BD", { day: "numeric", month: "short" })}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 gap-2 border-b p-3 sm:grid-cols-[minmax(0,1fr)_200px_160px] sm:p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, মোবাইল, ইমেইল বা স্টাফ আইডি" className="pl-9" aria-label="স্টাফ খুঁজুন" />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger aria-label="স্টাফ টাইপ"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সকল টাইপ</SelectItem>
                <SelectItem value="mess">সব মেস স্টাফ</SelectItem>
                {STAFF_TYPES.map((t) => <SelectItem key={t} value={t}>{STAFF_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="অবস্থা"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব অবস্থা</SelectItem>
                <SelectItem value="সক্রিয়">সক্রিয়</SelectItem>
                <SelectItem value="নিষ্ক্রিয়">নিষ্ক্রিয়</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Users} title={staff.length ? "এই ফিল্টারে কোনো স্টাফ নেই" : "এখনো কোনো স্টাফ যোগ করা হয়নি"} description={staff.length ? "অনুসন্ধান বা ফিল্টার বদলে দেখুন।" : "নতুন স্টাফ যোগ করে শুরু করুন।"} />
          ) : (
            <>
              {/* Desktop / tablet table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>স্টাফ</TableHead>
                      <TableHead>স্টাফ আইডি</TableHead>
                      <TableHead>টাইপ</TableHead>
                      <TableHead>যোগাযোগ</TableHead>
                      <TableHead className="hidden lg:table-cell">দায়িত্ব / অ্যাসাইনমেন্ট</TableHead>
                      <TableHead className="hidden xl:table-cell">যোগদান</TableHead>
                      <TableHead>অবস্থা</TableHead>
                      <TableHead className="w-[52px]"><span className="sr-only">কাজ</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((s) => (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => setViewing(s)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <StaffAvatar s={s} />
                            <span className="min-w-0"><span className="block truncate font-medium">{s.name}</span>{s.email && <span className="block truncate text-xs text-muted-foreground">{s.email}</span>}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{s.staffId || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className={TYPE_TONE[s.staffType]}>{STAFF_TYPE_LABELS[s.staffType]}</Badge></TableCell>
                        <TableCell className="text-sm tabular-nums">{s.mobile}</TableCell>
                        <TableCell className="hidden max-w-[220px] truncate text-sm text-muted-foreground lg:table-cell">{assignmentText(s)}</TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">{s.joinDate || "—"}</TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>{rowMenu(s)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y md:hidden">
                {visible.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-3">
                    <button type="button" onClick={() => setViewing(s)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <StaffAvatar s={s} className="h-10 w-10" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant="outline" className={cn("px-1.5 py-0 text-[11px]", TYPE_TONE[s.staffType])}>{STAFF_TYPE_LABELS[s.staffType]}</Badge>
                          <span className="tabular-nums">{s.mobile}</span>
                          {s.status !== "সক্রিয়" && <span className="text-destructive">নিষ্ক্রিয়</span>}
                        </span>
                      </span>
                    </button>
                    {rowMenu(s)}
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5 text-sm sm:px-4">
                <span className="text-muted-foreground">{filtered.length} জনের মধ্যে {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span>
                <span className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>আগের</Button>
                  <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>পরের</Button>
                </span>
              </div>
            </>
          )}
        </Card>

        <StaffForm open={formOpen} onOpenChange={setFormOpen} editStaff={editStaff} />
        <ProfileSheet staff={viewing} onClose={() => setViewing(null)} locked={viewing ? locked(viewing) : true} assignments={viewing ? assignmentText(viewing) : ""} isSuperAdmin={!!user?.isSuperAdmin} onEdit={openEdit} onToggle={toggleStatus} onReset={setResetting} />

        <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleting?.name} — মুছে ফেলবেন?</AlertDialogTitle>
              <AlertDialogDescription>স্টাফ রেকর্ডটি মুছে যাবে এবং এই স্টাফ আর পোর্টালে লগইন করতে পারবেন না। শুধু সাময়িকভাবে বন্ধ করতে চাইলে "নিষ্ক্রিয় করুন" ব্যবহার করুন।</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>বাতিল</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  const s = deleting!;
                  try {
                    await deleteStaff(s.id);
                    toast.success("স্টাফ মুছে ফেলা হয়েছে");
                    if (viewing?.id === s.id) setViewing(null);
                  } catch (err) {
                    toast.error(errText(err, "মুছতে ব্যর্থ হয়েছে"));
                  }
                }}
              >
                মুছে ফেলুন
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ResetPasswordDialog staff={resetting} onClose={() => setResetting(null)} />
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><div className="break-words text-sm font-medium">{children}</div></div>
    </div>
  );
}

function ProfileSheet({ staff: s, onClose, locked, assignments, isSuperAdmin, onEdit, onToggle, onReset }: {
  staff: Staff | null; onClose: () => void; locked: boolean; assignments: string; isSuperAdmin: boolean;
  onEdit: (s: Staff) => void; onToggle: (s: Staff) => Promise<void>; onReset: (s: Staff) => void;
}) {
  return (
    <Sheet open={!!s} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {s && (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-4">
                <StaffAvatar s={s} className="h-16 w-16 text-lg" />
                <div className="min-w-0">
                  <SheetTitle className="truncate">{s.name}</SheetTitle>
                  <SheetDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={TYPE_TONE[s.staffType]}>{STAFF_TYPE_LABELS[s.staffType]}</Badge>
                    <StatusBadge status={s.status} />
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="mt-6 divide-y rounded-lg border px-4">
              <InfoRow icon={UserCheck} label="স্টাফ আইডি (পোর্টাল লগইন)"><span className="font-mono">{s.staffId || "—"}</span></InfoRow>
              <InfoRow icon={Phone} label="মোবাইল"><a className="hover:text-primary" href={`tel:${s.mobile}`}>{s.mobile}</a></InfoRow>
              <InfoRow icon={Mail} label="ইমেইল">{s.email || "—"}</InfoRow>
              <InfoRow icon={MapPin} label="ঠিকানা">{s.address || "—"}</InfoRow>
              <InfoRow icon={CalendarDays} label="যোগদান">{s.joinDate || "—"}</InfoRow>
              <InfoRow icon={Wallet} label="বেতন">৳ {s.salary.toLocaleString("bn-BD")}</InfoRow>
              <InfoRow icon={Layers} label="দায়িত্ব / অ্যাসাইনমেন্ট">
                {assignments}
                {s.staffType === "Batch Director" && <Link to="/batches" className="mt-1 block text-xs text-primary hover:underline">ব্যাচে ডিরেক্টর নির্ধারণ →</Link>}
                {MESS_TYPES.includes(s.staffType) && <Link to="/mess/setup" className="mt-1 block text-xs text-primary hover:underline">মেসে স্টাফ নির্ধারণ →</Link>}
              </InfoRow>
              <InfoRow icon={ShieldCheck} label="পোর্টাল অ্যাক্সেস">
                {s.staffType === "Admin" ? "এডমিন লগইন (মোবাইল/আইডি + পাসওয়ার্ড)" : s.staffType === "Batch Director" || MESS_TYPES.includes(s.staffType) ? "স্টাফ লগইন (মোবাইল + স্টাফ আইডি)" : "কোনো পোর্টাল লগইন নেই"}
              </InfoRow>
            </div>
            {locked && <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">এডমিন স্টাফ শুধু সুপার অ্যাডমিন সম্পাদনা করতে পারবেন।</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button disabled={locked} onClick={() => onEdit(s)}><Pencil className="h-4 w-4" />সম্পাদনা</Button>
              <Button variant="outline" disabled={locked} onClick={() => void onToggle(s)}><Power className="h-4 w-4" />{s.status === "সক্রিয়" ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}</Button>
              {s.staffType === "Admin" && isSuperAdmin && <Button variant="outline" className="col-span-2" onClick={() => onReset(s)}><KeyRound className="h-4 w-4" />লগইন পাসওয়ার্ড রিসেট</Button>}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Super Admin only: resets an Admin staff's login password through the existing /users/:id/reset-credentials. */
function ResetPasswordDialog({ staff, onClose }: { staff: Staff | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (staff) { setPassword(""); setConfirm(""); } }, [staff]);
  const submit = async () => {
    if (!staff) return;
    if (password.length < 6) { toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে"); return; }
    if (password !== confirm) { toast.error("দুটি পাসওয়ার্ড মেলেনি"); return; }
    setBusy(true);
    try {
      const users = await api.get<{ _id: string }[]>(`/users?linkedStaffId=${staff.id}`);
      if (!users.length) throw new Error("এই স্টাফের কোনো লগইন অ্যাকাউন্ট পাওয়া যায়নি");
      await api.patch(`/users/${users[0]._id}/reset-credentials`, { password });
      toast.success(`${staff.name}-এর পাসওয়ার্ড রিসেট হয়েছে`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "রিসেট করা যায়নি");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!staff} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>লগইন পাসওয়ার্ড রিসেট</DialogTitle>
          <DialogDescription>{staff?.name} — নতুন পাসওয়ার্ড দিন। পরিবর্তন অডিট লগে থাকবে।</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="reset-pass">নতুন পাসওয়ার্ড</Label><Input id="reset-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="reset-pass2">আবার লিখুন</Label><Input id="reset-pass2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>বাতিল</Button>
          <Button disabled={busy} onClick={submit}>{busy ? "রিসেট হচ্ছে..." : "রিসেট করুন"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
