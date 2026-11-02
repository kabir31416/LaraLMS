import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble, Building2, ClipboardList, Coins, HandCoins, Receipt, ShieldCheck, Users, Wallet, Wrench, AlertCircle, CalendarClock,
  UserPlus, FileBarChart, Settings2, CalendarCog, LogOut, ListChecks, Zap, History, PiggyBank,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchInput } from "@/components/mess/MessCommon";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { MessPage, useMessScope } from "@/components/mess/MessShell";
import { EmptyState, ErrorState, ListSkeleton, Panel, PanelLink, SectionHeader } from "@/components/dashboard/DashboardKit";
import { cn } from "@/lib/utils";
import {
  COMPLAINT_STATUS_LABELS, MEMBERSHIP_STATUS_LABELS, periodName, PURPOSE_LABELS, qs, refName, SEAT_STATUS_LABELS, tk, useApiData, usePagedList,
  type Complaint, type Membership, type MessPayment, type SeatStatus,
} from "@/lib/mess";
import {
  MESS_BILLING_MANAGE, MESS_COMPLAINTS_MANAGE, MESS_MANAGE, MESS_MEMBERS_EDIT_DATES, MESS_MEMBERS_MANAGE, MESS_PAYMENTS_COLLECT, MESS_REPORTS_READ,
  MESS_SETTINGS_MANAGE, MESS_VIEW,
} from "@/lib/permissions";

interface DashboardData {
  period: string;
  canSeeFinance: boolean;
  messCount: number;
  roomCount: number;
  seatCounts: Record<SeatStatus, number>;
  totalSeats: number;
  occupancyRate: number;
  activeMembers: number;
  pendingApplications: number;
  activeReservations: number;
  monthBilled: number | null;
  monthBillDue: number | null;
  monthBillCount: number;
  monthRentCollected: number | null;
  monthDepositCollected: number | null;
  totalDue: number | null;
  totalAdvance: number | null;
  depositsHeld: number | null;
  monthExpenses: number | null;
  openComplaints: number;
  pendingExpenses: number;
  pendingDepositRequests: number;
  pendingSettlements: number;
  monthCollected?: number | null;
  monthPaymentCount?: number;
  previousDue?: number | null;
  previousDueMembers?: number;
  recentAdmissions?: { _id: string; membershipNo: string; studentId?: { name: string; registrationId?: string }; messId?: { name: string }; seatId?: { seatNumber: string }; joiningDate: string; status: Membership["status"] }[];
  recentCheckouts?: { _id: string; membershipNo: string; studentId?: { name: string; registrationId?: string }; messId?: { name: string }; leftDate: string }[];
  sms?: { failed: number; pending: number };
  autoBilling?: { enabled: boolean; period: string; billingDay: number; messes: number; billedThisMonth: number; created: number; failed: number; errors: number; lastRunAt: string | null };
}

type PickAction = "pay" | "joining" | "checkout";
const PICK_TITLES: Record<PickAction, string> = { pay: "পেমেন্ট নিন — সদস্য নির্বাচন", joining: "যোগদানের তারিখ সংশোধন — সদস্য নির্বাচন", checkout: "চেক-আউট — সদস্য নির্বাচন" };

const SEAT_ORDER: { key: SeatStatus; className: string }[] = [
  { key: "occupied", className: "bg-primary" },
  { key: "reserved", className: "bg-warning" },
  { key: "available", className: "bg-success" },
  { key: "maintenance", className: "bg-foreground/30" },
  { key: "inactive", className: "bg-foreground/10" },
];

/**
 * Mess Dashboard — every number from the scope-aware Mess endpoints, so a
 * Mess Manager sees only their assigned Mess(es). Money is shown only when
 * the server says this role may see it (canSeeFinance); lists below only
 * load for roles holding that list's own permission.
 */
export default function MessDashboard() {
  const { messId, messes, messesLoading, can } = useMessScope();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApiData<DashboardData>(`/mess/dashboard${qs({ messId })}`);
  const fin = !!data?.canSeeFinance;
  const dues = usePagedList<Membership>(can(MESS_REPORTS_READ) ? `/mess/reports/balances${qs({ messId, mode: "dues", limit: 6 })}` : null);
  const complaints = usePagedList<Complaint>(can(MESS_COMPLAINTS_MANAGE) ? `/mess/complaints${qs({ messId, status: "open", limit: 5 })}` : null);
  const payments = usePagedList<MessPayment>(fin ? `/mess/payments${qs({ messId, limit: 6 })}` : null);
  const selectedMess = messId !== "all" ? messes.find((m) => m._id === messId) : null;
  const [pick, setPick] = useState<PickAction | null>(null);
  const quick = [
    { label: "নতুন ভর্তি", icon: UserPlus, perm: MESS_MEMBERS_MANAGE, go: () => navigate("/mess/members?new=1") },
    { label: "শিক্ষার্থী তালিকা", icon: Users, perm: MESS_VIEW, go: () => navigate("/mess/members") },
    { label: "রুম / সিট", icon: BedDouble, perm: MESS_VIEW, go: () => navigate("/mess/setup") },
    { label: "পেমেন্ট নিন", icon: Coins, perm: MESS_PAYMENTS_COLLECT, go: () => setPick("pay") },
    { label: "মাসিক বিল", icon: Receipt, perm: MESS_BILLING_MANAGE, go: () => navigate("/mess/billing") },
    { label: "বকেয়া শিক্ষার্থী", icon: AlertCircle, perm: MESS_REPORTS_READ, go: () => navigate("/mess/reports?tab=dues") },
    { label: "যোগদানের তারিখ", icon: CalendarCog, perm: MESS_MEMBERS_EDIT_DATES, go: () => setPick("joining") },
    { label: "চেক-আউট", icon: LogOut, perm: MESS_MEMBERS_MANAGE, go: () => setPick("checkout") },
    { label: "রিপোর্ট", icon: FileBarChart, perm: MESS_REPORTS_READ, go: () => navigate("/mess/reports") },
    { label: "সেটিংস", icon: Settings2, perm: MESS_SETTINGS_MANAGE, go: () => navigate("/mess/settings") },
  ].filter((q) => can(q.perm));
  const ab = data?.autoBilling;
  const today = new Date().getDate();
  const autoPending = !!ab && ab.enabled && ab.messes > ab.billedThisMonth && today >= ab.billingDay;

  return (
    <MessPage title={selectedMess ? `${selectedMess.name} — ড্যাশবোর্ড` : "মেস / হোস্টেল ড্যাশবোর্ড"} subtitle={data ? `চলতি মাস ${data.period} • ${data.messCount}টি মেস • ${data.roomCount}টি রুম` : "সিট, সদস্য, বিল ও খরচের সারসংক্ষেপ"}>
      {!messesLoading && messes.length === 0 ? (
        <Card><CardContent>
          <EmptyState
            icon={Building2}
            title={can(MESS_MANAGE) ? "এখনো কোনো মেস তৈরি হয়নি" : "আপনাকে এখনো কোনো মেসে যুক্ত করা হয়নি"}
            description={can(MESS_MANAGE) ? "মেস, রুম ও সিট তৈরি করে শুরু করুন।" : "অ্যাডমিনের সাথে যোগাযোগ করুন।"}
            action={can(MESS_MANAGE) ? <Button onClick={() => navigate("/mess/setup")}>মেস তৈরি করুন</Button> : undefined}
          />
        </CardContent></Card>
      ) : error ? (
        <Card><CardContent><ErrorState message={error} onRetry={reload} /></CardContent></Card>
      ) : (
        <div className="space-y-8">
          {quick.length > 0 && (
            <section aria-label="দ্রুত কাজ">
              <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-5 gap-2">
                {quick.map((q) => (
                  <button key={q.label} type="button" onClick={q.go} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <q.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">{q.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {ab && (fin || can(MESS_BILLING_MANAGE)) && (
            <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-2.5 text-sm", autoPending || ab.failed > 0 || ab.errors > 0 ? "border-warning/40 bg-warning/5" : "bg-card")}>
              <span className="flex items-center gap-2 font-medium"><Zap className="h-4 w-4 text-primary" aria-hidden />স্বয়ংক্রিয় মাসিক বিল — {periodName(ab.period)}</span>
              {!ab.enabled ? <span className="text-warning">বন্ধ আছে (মেস সেটিংস)</span> : (
                <>
                  <span className="text-muted-foreground">{ab.billedThisMonth}/{ab.messes} মেস সম্পন্ন • {ab.created}টি বিল তৈরি{ab.failed ? ` • ${ab.failed}টি ব্যর্থ` : ""}{ab.errors ? ` • ${ab.errors}টি মেসে ত্রুটি` : ""}</span>
                  {autoPending && <span className="text-warning">এ মাসের স্বয়ংক্রিয় বিল এখনো সম্পন্ন হয়নি — সার্ভার শিডিউলার চালু আছে কি না দেখুন বা বিলিং পেজ থেকে তৈরি করুন</span>}
                  {ab.lastRunAt && <span className="text-xs text-muted-foreground">শেষ রান {new Date(ab.lastRunAt).toLocaleString("bn-BD")}</span>}
                </>
              )}
              {can(MESS_BILLING_MANAGE) && <PanelLink to="/mess/billing">বিলিং</PanelLink>}
            </div>
          )}

          <section>
            <SectionHeader title="অকুপেন্সি ও সদস্য" icon={BedDouble} action={<PanelLink to="/mess/setup">রুম ও সিট</PanelLink>} />
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4">
              <Card>
                <CardContent className="p-4 sm:p-5">
                  {loading || !data ? <Skeleton className="h-32" /> : (
                    <>
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">দখলের হার</p>
                          <p className="text-4xl font-bold tabular-nums tracking-tight">{data.occupancyRate}%</p>
                          <p className="text-xs text-muted-foreground mt-1">{data.seatCounts.occupied + data.seatCounts.reserved} / {data.totalSeats - data.seatCounts.inactive} ব্যবহারযোগ্য সিট ব্যবহৃত</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">সক্রিয় সদস্য</p>
                          <p className="text-2xl font-bold tabular-nums">{data.activeMembers}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-muted" role="img" aria-label={SEAT_ORDER.map((s) => `${SEAT_STATUS_LABELS[s.key]} ${data.seatCounts[s.key]}`).join(", ")}>
                        {SEAT_ORDER.map((s) => data.seatCounts[s.key] > 0 && <div key={s.key} className={s.className} style={{ width: `${(data.seatCounts[s.key] / Math.max(1, data.totalSeats)) * 100}%` }} />)}
                      </div>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {SEAT_ORDER.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-sm", s.className)} aria-hidden />{SEAT_STATUS_LABELS[s.key]} <b className="tabular-nums">{data.seatCounts[s.key]}</b></span>)}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <StatCard title="খালি সিট" value={String(data?.seatCounts.available ?? 0)} icon={BedDouble} variant="success" loading={loading} onClick={() => navigate("/mess/reports?tab=available")} />
                <StatCard title="অপেক্ষমাণ আবেদন" value={String(data?.pendingApplications ?? 0)} icon={ClipboardList} variant="warning" loading={loading} onClick={() => navigate("/mess/members?tab=applications")} />
                <StatCard title="সক্রিয় রিজার্ভেশন" value={String(data?.activeReservations ?? 0)} icon={CalendarClock} variant="info" loading={loading} onClick={() => navigate("/mess/members?tab=reservations")} />
                <StatCard title="খোলা অভিযোগ" value={String(data?.openComplaints ?? 0)} icon={Wrench} variant={(data?.openComplaints ?? 0) > 0 ? "warning" : "info"} loading={loading} onClick={can(MESS_COMPLAINTS_MANAGE) ? () => navigate("/mess/complaints") : undefined} />
              </div>
            </div>
          </section>

          {fin && data && (
            <section>
              <SectionHeader title={`আর্থিক — ${data.period}`} icon={Wallet} description="মেসের হিসাব — কোর্স ফি থেকে সম্পূর্ণ আলাদা" action={<PanelLink to="/mess/reports?tab=income">আয় বনাম খরচ</PanelLink>} />
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <StatCard title="এ মাসের বিল" value={tk(data.monthBilled)} icon={Receipt} variant="primary" description={`${data.monthBillCount}টি বিল • এ মাসের বকেয়া ${tk(data.monthBillDue)}`} onClick={() => navigate("/mess/billing")} />
                <StatCard title="এ মাসের আদায়" value={tk(data.monthCollected ?? data.monthRentCollected)} icon={Coins} variant="success" description={`ভাড়া/ডাইনিং ${tk(data.monthRentCollected)} • অগ্রিম ${tk(data.monthDepositCollected)}`} onClick={() => navigate("/mess/payments")} />
                <StatCard title="পূর্বের বকেয়া" value={tk(data.previousDue)} icon={History} variant={(data.previousDue ?? 0) > 0 ? "danger" : "success"} description={`${data.previousDueMembers ?? 0} জন — আগের মাসগুলোর`} onClick={() => navigate("/mess/reports?tab=previous-due")} />
                <StatCard title="মোট মেস বকেয়া" value={tk(data.totalDue)} icon={AlertCircle} variant={(data.totalDue ?? 0) > 0 ? "danger" : "success"} description={`অতিরিক্ত পরিশোধ জমা ${tk(data.totalAdvance)}`} onClick={() => navigate("/mess/reports?tab=dues")} />
                <StatCard title="জমা অগ্রিম" value={tk(data.depositsHeld)} icon={PiggyBank} variant="info" description="শিক্ষার্থীর পক্ষে জমা — আয় নয়" onClick={() => navigate("/mess/deposits")} />
                <StatCard title="এ মাসের খরচ" value={tk(data.monthExpenses)} icon={HandCoins} variant="warning" onClick={() => navigate("/mess/expenses")} />
              </div>
            </section>
          )}

          <section>
            <SectionHeader title="অপেক্ষমাণ কাজ ও সাম্প্রতিক" icon={ShieldCheck} />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel title="অপেক্ষমাণ কাজ" bodyClassName="px-0 sm:px-0">
                {loading || !data ? <div className="px-5"><ListSkeleton rows={4} /></div> : (
                  <ul className="divide-y">
                    <TaskRow label="সদস্যপদের আবেদন" value={data.pendingApplications} onClick={() => navigate("/mess/members?tab=applications")} />
                    {fin && <TaskRow label="খরচ অনুমোদন" value={data.pendingExpenses} onClick={() => navigate("/mess/expenses?status=pending")} />}
                    {fin && <TaskRow label="জামানত কর্তন/ফেরত অনুরোধ" value={data.pendingDepositRequests} onClick={() => navigate("/mess/deposits")} />}
                    {fin && <TaskRow label="চূড়ান্ত নিষ্পত্তি" value={data.pendingSettlements} onClick={() => navigate("/mess/deposits?tab=settlements")} />}
                    <TaskRow label="খোলা অভিযোগ" value={data.openComplaints} onClick={can(MESS_COMPLAINTS_MANAGE) ? () => navigate("/mess/complaints") : undefined} />
                    {data.sms && (can(MESS_REPORTS_READ) || can(MESS_SETTINGS_MANAGE)) && <TaskRow label="ব্যর্থ SMS (৩০ দিন)" value={data.sms.failed} onClick={() => navigate("/mess/reports?tab=sms")} />}
                    {data.sms && (can(MESS_REPORTS_READ) || can(MESS_SETTINGS_MANAGE)) && <TaskRow label="সাড়া পাওয়া যায়নি এমন SMS" value={data.sms.pending} onClick={() => navigate("/mess/reports?tab=sms")} />}
                  </ul>
                )}
              </Panel>
              {can(MESS_REPORTS_READ) && (
                <Panel title="সবচেয়ে বেশি বকেয়া" action={<PanelLink to="/mess/reports?tab=dues">বকেয়া রিপোর্ট</PanelLink>} bodyClassName="px-0 sm:px-0">
                  {dues.loading ? <div className="px-5"><ListSkeleton /></div> : dues.items.length === 0 ? <EmptyState compact icon={Users} title="কোনো বকেয়া নেই" /> : (
                    <ul className="divide-y">
                      {dues.items.map((m) => (
                        <li key={m._id}>
                          <button type="button" onClick={() => navigate(`/mess/members/${m._id}`)} className="flex w-full items-center gap-3 px-4 sm:px-5 py-2.5 text-left hover:bg-muted/40">
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{m.studentId?.name}</span><span className="block truncate text-xs text-muted-foreground">{refName(m.messId)} • রুম {refName(m.roomId)} / {refName(m.seatId, "seatNumber")}</span></span>
                            <span className="shrink-0 text-sm font-semibold text-destructive tabular-nums">{tk(m.balance?.due)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}
              {fin ? (
                <Panel title="সাম্প্রতিক পেমেন্ট" action={<PanelLink to="/mess/payments">সব দেখুন</PanelLink>} bodyClassName="px-0 sm:px-0">
                  {payments.loading ? <div className="px-5"><ListSkeleton /></div> : payments.items.length === 0 ? <EmptyState compact icon={Coins} title="কোনো পেমেন্ট নেই" /> : (
                    <ul className="divide-y">
                      {payments.items.map((p) => (
                        <li key={p._id}>
                          <button type="button" onClick={() => navigate(`/mess/payments/${p._id}/receipt`)} className="flex w-full items-center gap-3 px-4 sm:px-5 py-2.5 text-left hover:bg-muted/40">
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.studentId?.name}</span><span className="block truncate text-xs text-muted-foreground">{p.receiptNo} • {p.date} • {PURPOSE_LABELS[p.purpose]}</span></span>
                            <span className="shrink-0 text-sm font-semibold text-success tabular-nums">{tk(p.amount)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              ) : can(MESS_COMPLAINTS_MANAGE) && (
                <Panel title="খোলা অভিযোগ" action={<PanelLink to="/mess/complaints">সব দেখুন</PanelLink>} bodyClassName="px-0 sm:px-0">
                  {complaints.loading ? <div className="px-5"><ListSkeleton /></div> : complaints.items.length === 0 ? <EmptyState compact icon={Wrench} title="কোনো খোলা অভিযোগ নেই" /> : (
                    <ul className="divide-y">
                      {complaints.items.map((c) => (
                        <li key={c._id} className="px-4 sm:px-5 py-2.5">
                          <p className="truncate text-sm font-medium">{c.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.ticketNo} • {refName(c.messId)} • {COMPLAINT_STATUS_LABELS[c.status]}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}
            </div>
          </section>

          {data && (
            <section>
              <SectionHeader title="সাম্প্রতিক ভর্তি ও চেক-আউট" icon={ListChecks} action={can(MESS_REPORTS_READ) ? <PanelLink to="/mess/reports?tab=joining">রিপোর্ট</PanelLink> : undefined} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="সাম্প্রতিক ভর্তি" bodyClassName="px-0 sm:px-0">
                  {(data.recentAdmissions ?? []).length === 0 ? <EmptyState compact icon={UserPlus} title="কোনো ভর্তি নেই" /> : (
                    <ul className="divide-y">
                      {data.recentAdmissions!.map((m) => (
                        <li key={m._id}>
                          <button type="button" onClick={() => navigate(`/mess/members/${m._id}`)} className="flex w-full items-center gap-3 px-4 sm:px-5 py-2.5 text-left hover:bg-muted/40">
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{m.studentId?.name ?? "—"}</span><span className="block truncate text-xs text-muted-foreground">{m.messId?.name} • সিট {m.seatId?.seatNumber ?? "—"} • {MEMBERSHIP_STATUS_LABELS[m.status]}</span></span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{m.joiningDate}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel title="সাম্প্রতিক চেক-আউট" bodyClassName="px-0 sm:px-0">
                  {(data.recentCheckouts ?? []).length === 0 ? <EmptyState compact icon={LogOut} title="কোনো চেক-আউট নেই" /> : (
                    <ul className="divide-y">
                      {data.recentCheckouts!.map((m) => (
                        <li key={m._id}>
                          <button type="button" onClick={() => navigate(`/mess/members/${m._id}`)} className="flex w-full items-center gap-3 px-4 sm:px-5 py-2.5 text-left hover:bg-muted/40">
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{m.studentId?.name ?? "—"}</span><span className="block truncate text-xs text-muted-foreground">{m.messId?.name} • {m.membershipNo}</span></span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{m.leftDate}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </section>
          )}
        </div>
      )}
      <MemberPickDialog action={pick} messId={messId} onClose={() => setPick(null)} onPick={(id) => { const a = pick; setPick(null); navigate(`/mess/members/${id}?action=${a}`); }} />
    </MessPage>
  );
}

function TaskRow({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  const inner = (
    <>
      <span className="flex-1 text-sm">{label}</span>
      <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums", value > 0 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground")}>{value}</span>
    </>
  );
  return (
    <li>
      {onClick ? <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 sm:px-5 py-2.5 text-left hover:bg-muted/40">{inner}</button> : <div className="flex items-center gap-3 px-4 sm:px-5 py-2.5">{inner}</div>}
    </li>
  );
}

/** Find a current member, then open their profile with the chosen action (payment / joining-date edit / check-out). */
function MemberPickDialog({ action, messId, onClose, onPick }: { action: PickAction | null; messId: string; onClose: () => void; onPick: (membershipId: string) => void }) {
  const [search, setSearch] = useState("");
  const status = action === "pay" ? "active,on_leave,notice_given,left" : "active,on_leave,notice_given,approved";
  const list = usePagedList<Membership>(action ? `/mess/memberships${qs({ messId, status, search, limit: 8 })}` : null);
  return (
    <Dialog open={!!action} onOpenChange={(v) => { if (!v) { setSearch(""); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{action ? PICK_TITLES[action] : ""}</DialogTitle><DialogDescription>নাম, রেজি. নং বা মোবাইল দিয়ে খুঁজুন</DialogDescription></DialogHeader>
        <SearchInput value={search} onChange={setSearch} placeholder="নাম, রেজি. নং, মোবাইল" />
        <div className="max-h-80 overflow-y-auto rounded-md border">
          {list.loading ? <div className="p-3"><ListSkeleton rows={3} /></div> : list.items.length === 0 ? <p className="p-4 text-sm text-muted-foreground text-center">কেউ পাওয়া যায়নি</p> : (
            <ul className="divide-y">
              {list.items.map((m) => (
                <li key={m._id}>
                  <button type="button" onClick={() => onPick(m._id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{m.studentId?.name}</span><span className="block truncate text-xs text-muted-foreground">{m.studentId?.registrationId} • {refName(m.messId)} • সিট {refName(m.seatId, "seatNumber")}</span></span>
                    <span className="shrink-0 text-xs tabular-nums">{m.balance?.due > 0 ? <span className="text-destructive">বকেয়া {tk(m.balance.due)}</span> : MEMBERSHIP_STATUS_LABELS[m.status]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
