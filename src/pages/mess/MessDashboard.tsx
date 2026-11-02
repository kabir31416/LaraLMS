import { useNavigate } from "react-router-dom";
import { BedDouble, Building2, ClipboardList, Coins, HandCoins, Receipt, ShieldCheck, Users, Wallet, Wrench, AlertCircle, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { MessPage, useMessScope } from "@/components/mess/MessShell";
import { qs, SEAT_STATUS_LABELS, tk, useApiData, type SeatStatus } from "@/lib/mess";
import { Button } from "@/components/ui/button";

interface DashboardData {
  period: string;
  messCount: number;
  roomCount: number;
  seatCounts: Record<SeatStatus, number>;
  totalSeats: number;
  occupancyRate: number;
  activeMembers: number;
  pendingApplications: number;
  activeReservations: number;
  monthBilled: number;
  monthBillDue: number;
  monthBillCount: number;
  monthRentCollected: number;
  monthDepositCollected: number;
  totalDue: number;
  totalAdvance: number;
  depositsHeld: number;
  monthExpenses: number;
  openComplaints: number;
  pendingExpenses: number;
  pendingDepositRequests: number;
  pendingSettlements: number;
}

const SEAT_COLORS: Record<SeatStatus, string> = {
  available: "bg-success",
  reserved: "bg-warning",
  occupied: "bg-primary",
  maintenance: "bg-info",
  inactive: "bg-muted-foreground/40",
};

export default function MessDashboard() {
  const { messId, messes, messesLoading, can } = useMessScope();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApiData<DashboardData>(`/mess/dashboard${qs({ messId })}`);

  return (
    <MessPage title="মেস / হোস্টেল ড্যাশবোর্ড" subtitle="সিট, সদস্য, বিল ও খরচের সারসংক্ষেপ">
      {!messesLoading && messes.length === 0 ? (
        <Card><CardContent className="py-10 text-center space-y-3">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">{can("mess:manage") ? "এখনো কোনো মেস তৈরি হয়নি।" : "আপনাকে এখনো কোনো মেসে যুক্ত করা হয়নি — অ্যাডমিনের সাথে যোগাযোগ করুন।"}</p>
          {can("mess:manage") && <Button onClick={() => navigate("/mess/setup")}>মেস তৈরি করুন</Button>}
        </CardContent></Card>
      ) : error ? (
        <Card><CardContent className="py-8 text-center space-y-2"><p className="text-destructive">{error}</p><Button variant="outline" onClick={reload}>আবার চেষ্টা করুন</Button></CardContent></Card>
      ) : loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="সক্রিয় সদস্য" value={String(data.activeMembers)} icon={Users} variant="primary" onClick={() => navigate("/mess/members")} />
            <StatCard title="মোট সিট / দখল" value={`${data.totalSeats} / ${data.occupancyRate}%`} icon={BedDouble} variant="info" onClick={() => navigate("/mess/setup")} />
            <StatCard title="খালি সিট" value={String(data.seatCounts.available)} icon={BedDouble} variant="success" />
            <StatCard title="অপেক্ষমাণ আবেদন" value={String(data.pendingApplications)} icon={ClipboardList} variant="warning" onClick={() => navigate("/mess/members?tab=applications")} />
            <StatCard title={`এ মাসের বিল (${data.period})`} value={tk(data.monthBilled)} icon={Receipt} variant="info" onClick={() => navigate("/mess/billing")} />
            <StatCard title="এ মাসের ভাড়া আদায়" value={tk(data.monthRentCollected)} icon={Coins} variant="success" onClick={() => navigate("/mess/payments")} />
            <StatCard title="মোট বকেয়া" value={tk(data.totalDue)} icon={AlertCircle} variant="warning" onClick={() => navigate("/mess/reports?tab=dues")} />
            <StatCard title="জমা জামানত" value={tk(data.depositsHeld)} icon={ShieldCheck} variant="primary" onClick={() => navigate("/mess/deposits")} />
            <StatCard title="অগ্রিম জমা" value={tk(data.totalAdvance)} icon={Wallet} variant="info" />
            <StatCard title="এ মাসের খরচ (অনুমোদিত)" value={tk(data.monthExpenses)} icon={HandCoins} variant="warning" onClick={() => navigate("/mess/expenses")} />
            <StatCard title="খোলা অভিযোগ" value={String(data.openComplaints)} icon={Wrench} variant="warning" onClick={() => navigate("/mess/complaints")} />
            <StatCard title="সক্রিয় রিজার্ভেশন" value={String(data.activeReservations)} icon={CalendarClock} variant="info" onClick={() => navigate("/mess/members?tab=reservations")} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">সিটের অবস্থা</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data.totalSeats === 0 ? <p className="text-sm text-muted-foreground">কোনো সিট নেই</p> : (
                  <>
                    <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                      {(Object.keys(SEAT_COLORS) as SeatStatus[]).map((k) => data.seatCounts[k] > 0 && (
                        <div key={k} className={SEAT_COLORS[k]} style={{ width: `${(data.seatCounts[k] / data.totalSeats) * 100}%` }} title={`${SEAT_STATUS_LABELS[k]}: ${data.seatCounts[k]}`} />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                      {(Object.keys(SEAT_COLORS) as SeatStatus[]).map((k) => (
                        <div key={k} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${SEAT_COLORS[k]}`} />{SEAT_STATUS_LABELS[k]}: <b>{data.seatCounts[k]}</b></div>
                      ))}
                    </div>
                  </>
                )}
                <p className="text-xs text-muted-foreground">মেস: {data.messCount} • রুম: {data.roomCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">অপেক্ষমাণ কাজ</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <PendingRow label="সদস্যপদের আবেদন" value={data.pendingApplications} onClick={() => navigate("/mess/members?tab=applications")} />
                <PendingRow label="খরচ অনুমোদন" value={data.pendingExpenses} onClick={() => navigate("/mess/expenses?status=pending")} />
                <PendingRow label="জামানত কর্তন/ফেরত অনুরোধ" value={data.pendingDepositRequests} onClick={() => navigate("/mess/deposits")} />
                <PendingRow label="চূড়ান্ত নিষ্পত্তি" value={data.pendingSettlements} onClick={() => navigate("/mess/deposits?tab=settlements")} />
                <PendingRow label={`এ মাসের বিলের বকেয়া (${data.monthBillCount}টি বিল)`} value={tk(data.monthBillDue)} onClick={() => navigate("/mess/billing")} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </MessPage>
  );
}

function PendingRow({ label, value, onClick }: { label: string; value: number | string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/50">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </button>
  );
}
