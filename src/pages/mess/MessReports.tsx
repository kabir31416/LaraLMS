import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportToolbar } from "@/components/reports/ReportToolbar";
import { MessPage, useMessScope } from "@/components/mess/MessShell";
import { Pager, SearchInput, StatusBadge, TableState } from "@/components/mess/MessCommon";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import {
  DEPOSIT_TX_STATUS_LABELS, errMsg, MEMBERSHIP_STATUS_LABELS, periodName, qs, refName, SEAT_STATUS_LABELS, SMS_STATUS_LABELS, tk, useApiData, usePagedList,
  type Membership, type MessSmsLog, type Seat, type DepositTx, type SeatStatus, type MembershipStatus,
} from "@/lib/mess";

/**
 * Every report here is computed server-side (aggregations or paginated
 * lists with server filters). Export/print uses the ERP's shared
 * ReportToolbar; a paginated report exports the rows currently loaded.
 */
const REPORTS = [
  { key: "occupancy", label: "অকুপেন্সি" },
  { key: "members", label: "সদস্য তালিকা" },
  { key: "available", label: "খালি সিট" },
  { key: "joining", label: "ভর্তি / চেক-আউট" },
  { key: "collection", label: "আদায়" },
  { key: "monthly", label: "মাসভিত্তিক বিল ও আদায়" },
  { key: "dues", label: "বকেয়া" },
  { key: "previous-due", label: "পূর্বের বকেয়া" },
  { key: "advances", label: "অগ্রিম" },
  { key: "deposits", label: "জামানত" },
  { key: "expenses", label: "খরচ" },
  { key: "income", label: "আয় বনাম খরচ" },
  { key: "refunds", label: "ফেরত" },
  { key: "sms", label: "SMS ইতিহাস" },
] as const;
type ReportKey = (typeof REPORTS)[number]["key"];

export default function MessReports() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as ReportKey) || "occupancy";
  const { messId } = useMessScope();
  const [dateFrom, setDateFrom] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`);
  const [dateTo, setDateTo] = useState("");
  const needsDates = ["joining", "collection", "expenses", "income", "refunds", "sms"].includes(tab);
  return (
    <MessPage title="মেস রিপোর্ট" subtitle="সার্ভার-সাইড হিসাব; ফিল্টার অনুযায়ী প্রিন্ট/এক্সপোর্ট">
      <div className="overflow-x-auto">
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
          <TabsList className="h-auto flex-wrap">{REPORTS.map((r) => <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>)}</TabsList>
        </Tabs>
      </div>
      {needsDates && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>তারিখ:</span>
          <Input type="date" className="w-44" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span>থেকে</span>
          <Input type="date" className="w-44" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      )}
      {tab === "occupancy" && <OccupancyReport messId={messId} />}
      {tab === "members" && <MembersReport messId={messId} />}
      {tab === "available" && <AvailableSeatsReport messId={messId} />}
      {tab === "joining" && <JoiningReport messId={messId} dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "collection" && <CollectionReport messId={messId} dateFrom={dateFrom} dateTo={dateTo} />}
      {(tab === "dues" || tab === "advances" || tab === "deposits") && <BalancesReport key={tab} messId={messId} mode={tab} />}
      {tab === "expenses" && <ExpenseReport messId={messId} dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "income" && <IncomeReport messId={messId} dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "refunds" && <RefundReport messId={messId} dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "monthly" && <MonthlySummaryReport messId={messId} />}
      {tab === "previous-due" && <PreviousDueReport messId={messId} />}
      {tab === "sms" && <SmsHistoryReport messId={messId} dateFrom={dateFrom} dateTo={dateTo} />}
    </MessPage>
  );
}

function SimpleTable({ title, headers, rows, loading, error, footer }: { title: string; headers: string[]; rows: (string | number)[][]; loading: boolean; error: string | null; footer?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <ReportToolbar data={{ filename: title.replace(/\s+/g, "-"), title, headers, rows }} />
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            <TableState colSpan={headers.length} loading={loading} error={error} empty={rows.length === 0} />
            {!loading && rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className="text-sm">{c}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
        {footer && <div className="p-3">{footer}</div>}
      </CardContent>
    </Card>
  );
}

type OccRow = { mess: { name: string; code: string }; totals: Record<SeatStatus, number>; seatCount: number; rooms: { name: string; floor?: string; roomType?: string; totalSeats: number; counts: Record<SeatStatus, number>; seatCount: number }[] };

function OccupancyReport({ messId }: { messId: string }) {
  const { data, loading, error } = useApiData<OccRow[]>(`/mess/reports/occupancy${qs({ messId })}`);
  const rows = useMemo(() => (data ?? []).flatMap((m) => [
    [`${m.mess.name} (মোট)`, "—", m.seatCount, m.totals.occupied, m.totals.reserved, m.totals.available, m.totals.maintenance + m.totals.inactive, m.seatCount ? `${Math.round(((m.totals.occupied + m.totals.reserved) / Math.max(1, m.seatCount - m.totals.inactive)) * 100)}%` : "0%"],
    ...m.rooms.map((r) => [`   রুম ${r.name}`, r.floor || "—", `${r.seatCount}/${r.totalSeats}`, r.counts.occupied, r.counts.reserved, r.counts.available, r.counts.maintenance + r.counts.inactive, r.seatCount ? `${Math.round(((r.counts.occupied + r.counts.reserved) / Math.max(1, r.seatCount - r.counts.inactive)) * 100)}%` : "0%"]),
  ]), [data]);
  return <SimpleTable title="অকুপেন্সি রিপোর্ট" headers={["মেস / রুম", "তলা", "সিট", "দখলকৃত", "সংরক্ষিত", "খালি", "রক্ষণাবেক্ষণ/নিষ্ক্রিয়", "দখলের হার"]} rows={rows} loading={loading} error={error} />;
}

function MembersReport({ messId }: { messId: string }) {
  const { courses } = useAcademic();
  const { batches } = useBatches();
  const [status, setStatus] = useState("active,on_leave,notice_given,approved");
  const [courseId, setCourseId] = useState("all");
  const [batchId, setBatchId] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId, status, courseId, batchId, search]);
  const list = usePagedList<Membership>(`/mess/memberships${qs({ messId, status, courseId, batchId, search, page, limit: 100 })}`);
  const rows = list.items.map((m) => [m.membershipNo, m.studentId?.name ?? "", m.studentId?.registrationId ?? "", m.studentId?.currentRollNumber ?? "", m.studentId?.course ?? "", refName(m.studentId?.currentBatchId), refName(m.messId), refName(m.roomId), refName(m.seatId, "seatNumber"), m.joiningDate, MEMBERSHIP_STATUS_LABELS[m.status], m.monthlyRent, m.balance?.due ?? 0]);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <SearchInput value={search} onChange={setSearch} />
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active,on_leave,notice_given,approved">চলমান</SelectItem>{(Object.keys(MEMBERSHIP_STATUS_LABELS) as MembershipStatus[]).map((s) => <SelectItem key={s} value={s}>{MEMBERSHIP_STATUS_LABELS[s]}</SelectItem>)}<SelectItem value="pending,approved,active,on_leave,notice_given,left,cancelled">সব (সদস্যপদের ইতিহাস)</SelectItem></SelectContent></Select>
        <Select value={courseId} onValueChange={(v) => { setCourseId(v); setBatchId("all"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব কোর্স</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={batchId} onValueChange={setBatchId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব ব্যাচ</SelectItem>{batches.filter((b) => courseId === "all" || b.courseId === courseId).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <SimpleTable title="মেস / রুমভিত্তিক সদস্য তালিকা" headers={["সদস্যপদ", "নাম", "সিস্টেম আইডি", "রেজি. নং", "কোর্স", "ব্যাচ", "মেস", "রুম", "সিট", "যোগদান", "অবস্থা", "মাসিক চার্জ", "বকেয়া"]} rows={rows} loading={list.loading} error={list.error} footer={<Pager meta={list.meta} page={page} onPage={setPage} />} />
    </div>
  );
}

function AvailableSeatsReport({ messId }: { messId: string }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId]);
  const list = usePagedList<Seat>(`/mess/seats${qs({ messId, availableOnly: true, page, limit: 100 })}`);
  const rows = list.items.map((s) => [refName(s.messId), refName(s.roomId), s.seatNumber, s.seatType || "—", s.monthlyRent, s.availableFrom || "এখনই", SEAT_STATUS_LABELS[s.status]]);
  return <SimpleTable title="খালি সিটের রিপোর্ট" headers={["মেস", "রুম", "সিট", "ধরন", "মাসিক চার্জ", "খালি থেকে", "অবস্থা"]} rows={rows} loading={list.loading} error={list.error} footer={<Pager meta={list.meta} page={page} onPage={setPage} />} />;
}

function JoiningReport({ messId, dateFrom, dateTo }: { messId: string; dateFrom: string; dateTo: string }) {
  const [mode, setMode] = useState<"joining" | "leaving">("joining");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId, mode, dateFrom, dateTo]);
  const list = usePagedList<Membership>(`/mess/reports/joining-leaving${qs({ messId, mode, dateFrom, dateTo, page, limit: 100 })}`);
  const rows = list.items.map((m) => [m.membershipNo, m.studentId?.name ?? "", m.studentId?.registrationId ?? "", refName(m.messId), refName(m.roomId), refName(m.seatId, "seatNumber"), m.joiningDate, m.leftDate ?? "—", MEMBERSHIP_STATUS_LABELS[m.status]]);
  return (
    <div className="space-y-2">
      <Select value={mode} onValueChange={(v) => setMode(v as "joining" | "leaving")}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="joining">ভর্তি / যোগদান</SelectItem><SelectItem value="leaving">চেক-আউট</SelectItem></SelectContent></Select>
      <SimpleTable title={mode === "joining" ? "ভর্তি / যোগদান রিপোর্ট" : "চেক-আউট রিপোর্ট"} headers={["সদস্যপদ", "নাম", "সিস্টেম আইডি", "মেস", "রুম", "সিট", "যোগদান", "চেক-আউট", "অবস্থা"]} rows={rows} loading={list.loading} error={list.error} footer={<Pager meta={list.meta} page={page} onPage={setPage} />} />
    </div>
  );
}

type Agg = { _id: Record<string, string> | string; total: number; count: number; messName?: string; purpose?: string };
type CollAgg = { _id: string; rent: number; deposit: number; total: number; count: number; messName?: string };

function CollectionReport({ messId, dateFrom, dateTo }: { messId: string; dateFrom: string; dateTo: string }) {
  const { data, loading, error } = useApiData<{ byDate: CollAgg[]; byMethod: CollAgg[]; byMess: CollAgg[]; byMonth: CollAgg[] }>(`/mess/reports/collection${qs({ messId, dateFrom, dateTo })}`);
  const sum = (k: "rent" | "deposit") => (data?.byMethod ?? []).reduce((s, a) => s + (a[k] ?? 0), 0);
  const headers = ["লেনদেন", "ভাড়া ও ডাইনিং চার্জ", "এক মাসের অগ্রিম", "মোট"];
  const row = (label: string, a: CollAgg) => [label, a.count, a.rent, a.deposit, a.total];
  return (
    <div className="space-y-4">
      <p className="text-sm">ভাড়া ও ডাইনিং চার্জ আদায় <b>{tk(sum("rent"))}</b> • অগ্রিম সংগ্রহ <b>{tk(sum("deposit"))}</b> <span className="text-xs text-muted-foreground">(অগ্রিম আয় নয় — শিক্ষার্থীর পক্ষে জমা। ভর্তির একটি রসিদের দুই অংশ আলাদা করে দেখানো হয়েছে।)</span></p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SimpleTable title="তারিখভিত্তিক আদায়" headers={["তারিখ", ...headers]} rows={(data?.byDate ?? []).map((a) => row(a._id, a))} loading={loading} error={error} />
        <div className="space-y-4">
          <SimpleTable title="মাসভিত্তিক আদায়" headers={["মাস", ...headers]} rows={(data?.byMonth ?? []).map((a) => row(periodName(a._id), a))} loading={loading} error={error} />
          <SimpleTable title="পেমেন্ট পদ্ধতি অনুযায়ী" headers={["পদ্ধতি", ...headers]} rows={(data?.byMethod ?? []).map((a) => row(a._id, a))} loading={loading} error={error} />
          <SimpleTable title="মেস অনুযায়ী" headers={["মেস", ...headers]} rows={(data?.byMess ?? []).map((a) => row(a.messName ?? "", a))} loading={loading} error={error} />
        </div>
      </div>
    </div>
  );
}

interface MonthlyRow { period: string; bills: number; billed: number; billPaid: number; billDue: number; rentCollected: number; depositCollected: number; receipts: number }

function MonthlySummaryReport({ messId }: { messId: string }) {
  const [months, setMonths] = useState("12");
  const { data, loading, error } = useApiData<MonthlyRow[]>(`/mess/reports/monthly-summary${qs({ messId, months })}`);
  const rows = (data ?? []).map((r) => [periodName(r.period), r.bills, r.billed, r.billPaid, r.billDue, r.rentCollected, r.depositCollected, r.receipts]);
  return (
    <div className="space-y-2">
      <Select value={months} onValueChange={setMonths}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{["6", "12", "24"].map((m) => <SelectItem key={m} value={m}>শেষ {m} মাস</SelectItem>)}</SelectContent></Select>
      <SimpleTable title="মাসভিত্তিক বিল ও আদায়" headers={["মাস", "ভাড়ার বিল", "বিলের ভাড়া ও চার্জ", "বিলের পরিশোধ", "বিলের বকেয়া", "ভাড়া/ডাইনিং আদায় (ঐ মাসে)", "অগ্রিম সংগ্রহ", "রসিদ"]} rows={rows} loading={loading} error={error} />
      <p className="text-xs text-muted-foreground">"বিলের পরিশোধ/বকেয়া" — ঐ মাসের বিলের বর্তমান অবস্থা (পুরোনো বিল আগে পরিশোধ ধরা হয়)। "আদায়" — ঐ মাসে নেওয়া টাকা।</p>
    </div>
  );
}

interface PrevDueRow { membership: Membership | null; previousDue: number; oldestPeriod: string; months: number; currentMonthDue: number }

function PreviousDueReport({ messId }: { messId: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId, search]);
  const list = usePagedList<PrevDueRow>(`/mess/reports/previous-due${qs({ messId, search, page, limit: 100 })}`);
  const rows = list.items.map((r) => [r.membership?.membershipNo ?? "", r.membership?.studentId?.name ?? "", r.membership?.studentId?.registrationId ?? "", r.membership?.studentId?.phone ?? "", refName(r.membership?.messId), `${refName(r.membership?.roomId)} / ${refName(r.membership?.seatId, "seatNumber")}`, periodName(r.oldestPeriod), r.months, r.previousDue, r.currentMonthDue, r.membership?.balance?.due ?? 0]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} className="w-72" />
        <p className="text-sm">মোট পূর্বের বকেয়া: <b className="text-destructive">{tk(Number(list.meta?.sum ?? 0))}</b></p>
      </div>
      <SimpleTable title="পূর্বের বকেয়া (আগের মাসগুলোর)" headers={["সদস্যপদ", "নাম", "সিস্টেম আইডি", "মোবাইল", "মেস", "রুম/সিট", "সবচেয়ে পুরোনো মাস", "মাস সংখ্যা", "পূর্বের বকেয়া", "এ মাসের বকেয়া", "মোট বকেয়া"]} rows={rows} loading={list.loading} error={list.error} footer={<Pager meta={list.meta} page={page} onPage={setPage} />} />
    </div>
  );
}

const SMS_REF_LABELS: Record<string, string> = { payment: "পেমেন্ট", bill: "মাসিক বিল", membership: "ভর্তি / বকেয়া রিমাইন্ডার", settlement: "চেক-আউট" };

function SmsHistoryReport({ messId, dateFrom, dateTo }: { messId: string; dateFrom: string; dateTo: string }) {
  const [status, setStatus] = useState("all");
  const [refType, setRefType] = useState("all");
  const [page, setPage] = useState(1);
  const [checking, setChecking] = useState<string | null>(null);
  useEffect(() => setPage(1), [messId, status, refType, dateFrom, dateTo]);
  const list = usePagedList<MessSmsLog>(`/mess/sms/logs${qs({ messId, status, refType, dateFrom, dateTo, page, limit: 50 })}`);
  const byStatus = (list.meta?.byStatus ?? {}) as Record<string, number>;
  const check = async (id: string) => {
    setChecking(id);
    try {
      const r = await api.post<{ deliveryStatus: string }>(`/mess/sms/logs/${id}/delivery`, {});
      toast.success(`ডেলিভারি অবস্থা: ${r.deliveryStatus}`);
      await list.reload();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setChecking(null);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব অবস্থা</SelectItem><SelectItem value="failed,timeout">ব্যর্থ / সাড়া নেই</SelectItem>{Object.entries(SMS_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={refType} onValueChange={setRefType}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব ঘটনা</SelectItem>{Object.entries(SMS_REF_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <p className="text-xs text-muted-foreground">{Object.entries(byStatus).map(([k, n]) => `${SMS_STATUS_LABELS[k] ?? k}: ${n}`).join(" • ")}</p>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>সময়</TableHead><TableHead>শিক্ষার্থী</TableHead><TableHead>নম্বর</TableHead><TableHead>ঘটনা</TableHead><TableHead>বার্তা</TableHead><TableHead>প্রোভাইডার অবস্থা</TableHead><TableHead>ডেলিভারি</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableState colSpan={7} loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText="কোনো মেস SMS নেই" />
              {!list.loading && list.items.map((l) => (
                <TableRow key={l._id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(l.createdAt).toLocaleString("bn-BD")}</TableCell>
                  <TableCell className="text-sm">{l.studentId?.name ?? "—"}<p className="text-xs text-muted-foreground">{refName(l.messId)}</p></TableCell>
                  <TableCell className="text-xs font-mono">{l.recipient}</TableCell>
                  <TableCell className="text-xs">{SMS_REF_LABELS[l.refType ?? ""] ?? l.refType ?? "—"}</TableCell>
                  <TableCell className="text-xs max-w-xs"><span className="line-clamp-2">{l.message}</span></TableCell>
                  <TableCell><StatusBadge status={l.status === "sent" ? "completed" : l.status === "pending" ? "pending" : "rejected"} label={SMS_STATUS_LABELS[l.status] ?? l.status} />{l.errorMessage && <p className="text-[11px] text-destructive mt-0.5">{l.errorMessage}</p>}<p className="text-[11px] text-muted-foreground">{l.provider}</p></TableCell>
                  <TableCell className="text-xs">
                    {l.deliveryStatus ? <span>{l.deliveryStatus}<span className="block text-[11px] text-muted-foreground">{l.deliveryCheckedAt ? new Date(l.deliveryCheckedAt).toLocaleString("bn-BD") : ""}</span></span> : l.status === "sent" && l.providerRequestId ? (
                      <Button size="sm" variant="outline" disabled={checking === l._id} onClick={() => check(l._id)}>{checking === l._id ? "..." : "যাচাই"}</Button>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-3"><Pager meta={list.meta} page={page} onPage={setPage} /></div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">"প্রোভাইডার গ্রহণ করেছে" মানে গেটওয়ে SMS নিয়েছে — হ্যান্ডসেটে পৌঁছানো আলাদা অবস্থা। ডেলিভারি রিপোর্ট শুধু Alpha SMS সক্রিয় থাকলে পাওয়া যায়।</p>
    </div>
  );
}

function BalancesReport({ messId, mode }: { messId: string; mode: "dues" | "advances" | "deposits" }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [messId, search]);
  const list = usePagedList<Membership>(`/mess/reports/balances${qs({ messId, mode, search, page, limit: 100 })}`);
  const title = mode === "dues" ? "বকেয়া রিপোর্ট" : mode === "advances" ? "অগ্রিম পেমেন্ট রিপোর্ট" : "জামানত রিপোর্ট";
  const rows = list.items.map((m) => [m.membershipNo, m.studentId?.name ?? "", m.studentId?.registrationId ?? "", m.studentId?.phone ?? "", refName(m.messId), `${refName(m.roomId)} / ${refName(m.seatId, "seatNumber")}`, MEMBERSHIP_STATUS_LABELS[m.status],
    ...(mode === "deposits" ? [m.securityDeposit, m.balance?.depositCollected ?? 0, m.balance?.depositBalance ?? 0, m.balance?.depositPendingRefund ?? 0] : [m.balance?.totalBilled ?? 0, m.balance?.totalPaid ?? 0, mode === "dues" ? m.balance?.due ?? 0 : m.balance?.advance ?? 0])]);
  const headers = ["সদস্যপদ", "নাম", "সিস্টেম আইডি", "মোবাইল", "মেস", "রুম/সিট", "অবস্থা", ...(mode === "deposits" ? ["নির্ধারিত", "সংগৃহীত", "বর্তমান ব্যালেন্স", "ফেরত অপেক্ষমাণ"] : ["মোট বিল", "মোট পরিশোধ", mode === "dues" ? "বকেয়া" : "অগ্রিম"])];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} className="w-72" />
        <p className="text-sm">মোট: <b>{tk(Number(list.meta?.sum ?? 0))}</b></p>
      </div>
      <SimpleTable title={title} headers={headers} rows={rows} loading={list.loading} error={list.error} footer={<Pager meta={list.meta} page={page} onPage={setPage} />} />
    </div>
  );
}

function ExpenseReport({ messId, dateFrom, dateTo }: { messId: string; dateFrom: string; dateTo: string }) {
  const { data, loading, error } = useApiData<{ byDate: Agg[]; byCategory: Agg[]; byMess: Agg[] }>(`/mess/reports/expenses${qs({ messId, dateFrom, dateTo })}`);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SimpleTable title="খাতভিত্তিক খরচ" headers={["খাত", "সংখ্যা", "পরিমাণ"]} rows={(data?.byCategory ?? []).map((a) => [String(a._id), a.count, a.total])} loading={loading} error={error} />
      <SimpleTable title="তারিখভিত্তিক খরচ" headers={["তারিখ", "সংখ্যা", "পরিমাণ"]} rows={(data?.byDate ?? []).map((a) => [String(a._id), a.count, a.total])} loading={loading} error={error} />
      <SimpleTable title="মেসভিত্তিক খরচ" headers={["মেস", "সংখ্যা", "পরিমাণ"]} rows={(data?.byMess ?? []).map((a) => [a.messName ?? "", a.count, a.total])} loading={loading} error={error} />
    </div>
  );
}

interface IncomeRow { mess: { name: string }; rentCollected: number; depositDeductions: number; advanceRefunded: number; income: number; expenses: number; net: number; depositCollected: number; depositRefunded: number; outstandingDue: number; advanceHeld: number; depositsHeld: number }

function IncomeReport({ messId, dateFrom, dateTo }: { messId: string; dateFrom: string; dateTo: string }) {
  const { data, loading, error } = useApiData<{ rows: IncomeRow[]; totals: Omit<IncomeRow, "mess"> }>(`/mess/reports/income-expense${qs({ messId, dateFrom, dateTo })}`);
  const toRow = (name: string, r: Omit<IncomeRow, "mess">) => [name, r.rentCollected, r.depositDeductions, r.advanceRefunded, r.income, r.expenses, r.net, r.outstandingDue, r.depositsHeld, r.advanceHeld];
  const rows = [...(data?.rows ?? []).map((r) => toRow(r.mess.name, r)), ...(data && data.rows.length > 1 ? [toRow("সর্বমোট", data.totals)] : [])];
  return (
    <div className="space-y-2">
      <SimpleTable title="আয় বনাম খরচ ও মেসভিত্তিক ব্যালেন্স" headers={["মেস", "ভাড়া/ডাইনিং আদায়", "জামানত কর্তন", "অগ্রিম ফেরত", "নিট আয়", "খরচ", "নিট", "মোট বকেয়া (বর্তমান)", "জমা জামানত (বর্তমান)", "জমা অগ্রিম (বর্তমান)"]} rows={rows} loading={loading} error={error} />
      <p className="text-xs text-muted-foreground">আয় = ভাড়া ও ডাইনিং চার্জ আদায় + জামানত থেকে কর্তন − নিষ্পত্তিতে অগ্রিম ফেরত। জামানত সংগ্রহ/ফেরত আয় নয় — শিক্ষার্থীর পক্ষে জমা অর্থ। বকেয়া/জামানত/অগ্রিম কলাম আজকের অবস্থা দেখায়।</p>
    </div>
  );
}

function RefundReport({ messId, dateFrom, dateTo }: { messId: string; dateFrom: string; dateTo: string }) {
  const { data, loading, error } = useApiData<{ depositRefunds: DepositTx[]; advanceRefunds: { settlementNo: string; studentId: { name: string; registrationId: string }; messId: { name: string }; advanceRefund: number; refundDate?: string; refundMethod?: string }[] }>(`/mess/reports/refunds${qs({ messId, dateFrom, dateTo })}`);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SimpleTable title="জামানত ফেরত" headers={["নং", "তারিখ", "নাম", "মেস", "পদ্ধতি", "অবস্থা", "পরিমাণ"]} rows={(data?.depositRefunds ?? []).map((t) => [t.txNo, t.date, t.studentId?.name ?? "", refName(t.messId), t.method ?? "—", DEPOSIT_TX_STATUS_LABELS[t.status], t.amount])} loading={loading} error={error} />
      <SimpleTable title="অগ্রিম ফেরত (নিষ্পত্তি)" headers={["নিষ্পত্তি", "তারিখ", "নাম", "মেস", "পদ্ধতি", "পরিমাণ"]} rows={(data?.advanceRefunds ?? []).map((s) => [s.settlementNo, s.refundDate ?? "—", s.studentId?.name ?? "", s.messId?.name ?? "", s.refundMethod ?? "—", s.advanceRefund])} loading={loading} error={error} />
    </div>
  );
}
