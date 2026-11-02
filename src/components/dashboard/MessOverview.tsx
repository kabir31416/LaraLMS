import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BedDouble, Building2, Coins, HandCoins, Receipt, Users, AlertCircle, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission, useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import {
  MESS_BILLING_MANAGE, MESS_EXPENSES_APPROVE, MESS_EXPENSES_MANAGE, MESS_MANAGE, MESS_MEMBERS_MANAGE, MESS_PAYMENTS_COLLECT, MESS_VIEW,
} from "@/lib/permissions";
import { EmptyState, ErrorState } from "./DashboardKit";
import { taka } from "@/lib/dashboardFormat";

type SeatStatus = "available" | "reserved" | "occupied" | "maintenance" | "inactive";
interface MessDashboardData {
  period: string;
  canSeeFinance: boolean;
  messCount: number;
  seatCounts: Record<SeatStatus, number>;
  totalSeats: number;
  occupancyRate: number;
  activeMembers: number;
  pendingApplications: number;
  activeReservations: number;
  monthRentCollected: number | null;
  totalDue: number | null;
  monthExpenses: number | null;
  openComplaints: number;
  pendingExpenses: number;
}
interface MessRow { _id: string; name: string; code: string; status: "active" | "inactive"; totalSeats?: number; activeMembers?: number; seatCounts?: Record<SeatStatus, number> }

const SEAT_SEGMENTS: { key: SeatStatus; label: string; className: string }[] = [
  { key: "occupied", label: "দখলকৃত", className: "bg-primary" },
  { key: "reserved", label: "সংরক্ষিত", className: "bg-warning" },
  { key: "available", label: "খালি", className: "bg-success" },
  { key: "maintenance", label: "রক্ষণাবেক্ষণ", className: "bg-foreground/30" },
];

/** Same key MessShell.tsx reads — choosing a Mess here opens the Mess Dashboard already filtered to it. */
const MESS_SELECTED_KEY = "laralms_mess_selected";

/**
 * "মেস ম্যানেজমেন্ট" overview on the Main Dashboard. Rendered only for users
 * holding MESS_VIEW. All figures come from the Mess module's own
 * scope-aware endpoints (/mess/dashboard, /mess/messes), so a Mess Manager
 * only ever sees their assigned Mess(es) and money is omitted by the server
 * for roles without Mess financial permission.
 */
export function MessOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const enabled = hasPermission(user, MESS_VIEW);
  const dash = useQuery({ queryKey: ["mess", "dashboard", "all"], queryFn: () => api.get<MessDashboardData>("/mess/dashboard"), enabled, staleTime: 60_000 });
  const messes = useQuery({ queryKey: ["mess", "messes"], queryFn: () => api.get<MessRow[]>("/mess/messes"), enabled, staleTime: 60_000 });
  if (!enabled) return null;

  const openMess = (messId: string, path = "/mess") => {
    try { localStorage.setItem(MESS_SELECTED_KEY, messId); } catch { /* selection just isn't remembered */ }
    navigate(path);
  };

  const actions = [
    { label: "সদস্য ব্যবস্থাপনা", url: "/mess/members", icon: Users, show: true },
    { label: "রুম ও সিট", url: "/mess/setup", icon: Building2, show: true },
    { label: "বিলিং ও পেমেন্ট", url: hasPermission(user, MESS_BILLING_MANAGE) ? "/mess/billing" : "/mess/payments", icon: Receipt, show: hasPermission(user, MESS_BILLING_MANAGE) || hasPermission(user, MESS_PAYMENTS_COLLECT) },
    { label: "খরচ ব্যবস্থাপনা", url: "/mess/expenses", icon: HandCoins, show: hasPermission(user, MESS_EXPENSES_MANAGE) || hasPermission(user, MESS_EXPENSES_APPROVE) },
  ].filter((a) => a.show);

  const d = dash.data;
  const list = messes.data ?? [];
  const loading = dash.isLoading || messes.isLoading;

  return (
    <Card className="overflow-hidden border-primary/25">
      <div className="flex flex-col gap-3 border-b bg-gradient-to-r from-primary/[0.06] to-transparent px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="rounded-lg bg-primary p-2.5 text-primary-foreground shadow-sm"><BedDouble className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight">মেস ম্যানেজমেন্ট</h2>
            <p className="text-xs text-muted-foreground">
              {loading ? "লোড হচ্ছে..." : d ? `${d.messCount}টি মেস • ${d.totalSeats}টি সিট • চলতি মাস ${d.period}` : "মেস / হোস্টেলের সারসংক্ষেপ"}
            </p>
          </div>
        </div>
        <Button onClick={() => navigate("/mess")} className="w-full sm:w-auto">মেস ড্যাশবোর্ড খুলুন <ArrowRight className="h-4 w-4" /></Button>
      </div>

      {dash.isError ? (
        <ErrorState message="মেসের তথ্য লোড করা যায়নি" onRetry={() => { void dash.refetch(); void messes.refetch(); }} />
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !d || d.messCount === 0 ? (
        <EmptyState
          icon={BedDouble}
          title={hasPermission(user, MESS_MANAGE) ? "এখনো কোনো মেস তৈরি হয়নি" : "আপনাকে এখনো কোনো মেসে যুক্ত করা হয়নি"}
          description={hasPermission(user, MESS_MANAGE) ? "মেস, রুম ও সিট তৈরি করে সদস্য ভর্তি শুরু করুন।" : undefined}
          action={hasPermission(user, MESS_MANAGE) ? <Button size="sm" onClick={() => navigate("/mess/setup")}>মেস সেটআপ করুন</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="p-4 sm:p-5 space-y-5">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
              <Metric label="সক্রিয় সদস্য" value={String(d.activeMembers)} />
              <Metric label="দখলকৃত সিট" value={`${d.seatCounts.occupied}`} hint={`দখলের হার ${d.occupancyRate}%`} />
              <Metric label="খালি সিট" value={String(d.seatCounts.available)} tone={d.seatCounts.available > 0 ? "success" : undefined} />
              {d.canSeeFinance && <Metric label="এ মাসের ভাড়া আদায়" value={taka(d.monthRentCollected)} />}
              {d.canSeeFinance && <Metric label="মোট মেস বকেয়া" value={taka(d.totalDue)} tone={(d.totalDue ?? 0) > 0 ? "danger" : undefined} />}
              {d.canSeeFinance && <Metric label="এ মাসের খরচ" value={taka(d.monthExpenses)} hint="অনুমোদিত" />}
            </dl>
            <div>
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <span className="font-medium">সিটের অবস্থা</span>
                <span className="text-muted-foreground tabular-nums">{d.seatCounts.occupied + d.seatCounts.reserved}/{d.totalSeats - d.seatCounts.inactive} ব্যবহৃত</span>
              </div>
              <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-muted" role="img" aria-label={SEAT_SEGMENTS.map((s) => `${s.label} ${d.seatCounts[s.key]}`).join(", ")}>
                {SEAT_SEGMENTS.map((s) => d.seatCounts[s.key] > 0 && <div key={s.key} className={s.className} style={{ width: `${(d.seatCounts[s.key] / Math.max(1, d.totalSeats)) * 100}%` }} />)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {SEAT_SEGMENTS.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-sm", s.className)} aria-hidden />{s.label} <b className="text-foreground tabular-nums">{d.seatCounts[s.key]}</b></span>)}
              </div>
            </div>
            {(d.pendingApplications > 0 || d.openComplaints > 0 || (d.canSeeFinance && d.pendingExpenses > 0)) && (
              <div className="flex flex-wrap gap-2">
                {d.pendingApplications > 0 && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 cursor-pointer" onClick={() => navigate("/mess/members?tab=applications")}><ClipboardList className="h-3 w-3" />{d.pendingApplications}টি আবেদন অপেক্ষমাণ</Badge>}
                {d.openComplaints > 0 && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 cursor-pointer" onClick={() => navigate("/mess/complaints")}><AlertCircle className="h-3 w-3" />{d.openComplaints}টি খোলা অভিযোগ</Badge>}
                {d.canSeeFinance && d.pendingExpenses > 0 && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 cursor-pointer" onClick={() => navigate("/mess/expenses?status=pending")}><Coins className="h-3 w-3" />{d.pendingExpenses}টি খরচ অনুমোদনের অপেক্ষায়</Badge>}
              </div>
            )}
          </div>

          <div className="border-t xl:border-t-0 xl:border-l p-4 sm:p-5 space-y-4">
            {list.length > 1 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">মেসভিত্তিক অবস্থা</p>
                <ul className="divide-y">
                  {list.slice(0, 4).map((m) => {
                    const used = (m.seatCounts?.occupied ?? 0) + (m.seatCounts?.reserved ?? 0);
                    const usable = (m.totalSeats ?? 0) - (m.seatCounts?.inactive ?? 0);
                    const pct = usable > 0 ? Math.round((used / usable) * 100) : 0;
                    return (
                      <li key={m._id}>
                        <button type="button" onClick={() => openMess(m._id)} className="w-full py-2 text-left hover:bg-muted/40 -mx-1 px-1 rounded-sm">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{m.name}{m.status === "inactive" && <span className="text-xs text-muted-foreground"> (নিষ্ক্রিয়)</span>}</span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{m.activeMembers ?? 0} সদস্য • {pct}%</span>
                          </div>
                          <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} /></div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {list.length > 4 && <p className="text-xs text-muted-foreground mt-1">আরও {list.length - 4}টি মেস — মেস ড্যাশবোর্ডে দেখুন</p>}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">দ্রুত কাজ</p>
              <div className="grid grid-cols-2 gap-2">
                {actions.map((a) => (
                  <Button key={a.url} variant="outline" size="sm" className="justify-start h-9" onClick={() => navigate(a.url)}>
                    <a.icon className="text-primary" />{a.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "danger" }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-xl font-bold tabular-nums tracking-tight", tone === "success" && "text-success", tone === "danger" && "text-destructive")}>{value}</dd>
      {hint && <dd className="text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}
