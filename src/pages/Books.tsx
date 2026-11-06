import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Boxes, Package, Plus, Send, TrendingUp } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { EmptyState, Panel, RankedBars } from "@/components/dashboard/DashboardKit";
import { api } from "@/lib/apiClient";
import { useMaterials } from "@/contexts/MaterialContext";
import { stockLevel, type DashboardStats } from "@/types/material";
import { MaterialsListTab } from "@/components/materials/MaterialsListTab";
import { DistributionTab } from "@/components/materials/DistributionTab";
import { ReportsTab } from "@/components/materials/ReportsTab";
import { MaterialFormDialog } from "@/components/materials/MaterialFormDialog";

/**
 * Material Management — catalogue, transaction-based stock and student/batch
 * distribution. Workflow: add material (with opening stock) → it becomes
 * available → distribute to a student or a whole batch → stock is deducted
 * atomically → every distribution and stock movement stays in history.
 * Route kept as /books for sidebar/permission compatibility.
 */
export default function Books() {
  const [params, setParams] = useSearchParams();
  const tab = ["materials", "distribution", "reports"].includes(params.get("tab") ?? "") ? params.get("tab")! : "materials";
  const setTab = (t: string) => setParams(t === "materials" ? {} : { tab: t }, { replace: true });
  const { materials } = useMaterials();
  const [preselect, setPreselect] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const stats = useQuery({ queryKey: ["materials", "stats"], queryFn: () => api.get<DashboardStats>("/materials/dashboard/stats"), staleTime: 30_000 });
  const s = stats.data;
  const n = (v: number | undefined) => (v === undefined ? "—" : v.toLocaleString("bn-BD"));
  const refresh = () => { void stats.refetch(); };
  const attention = materials.filter((m) => m.status === "সক্রিয়" && stockLevel(m) !== "ok").sort((a, b) => a.currentStock - b.currentStock);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">ম্যাটেরিয়াল ব্যবস্থাপনা</h1>
            <p className="text-sm text-muted-foreground">ম্যাটেরিয়াল যোগ → স্টক → শিক্ষার্থী বা ব্যাচে বিতরণ → স্টক স্বয়ংক্রিয় হালনাগাদ → ইতিহাস</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />নতুন ম্যাটেরিয়াল</Button>
            <Button onClick={() => { setPreselect(null); setTab("distribution"); }}><Send className="h-4 w-4" />বিতরণ করুন</Button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard title="মোট ম্যাটেরিয়াল" value={n(s?.totalMaterials)} icon={Package} variant="primary" description="সক্রিয় ম্যাটেরিয়াল" loading={stats.isLoading} />
          <StatCard title="উপলব্ধ স্টক" value={n(s?.totalStock)} icon={Boxes} variant="info" description="সব সক্রিয় ম্যাটেরিয়াল মিলিয়ে" loading={stats.isLoading} />
          <StatCard title="বিতরণকৃত" value={n(s?.distributedTotal ?? s?.distributedThisMonth)} icon={Send} variant="success" description={s ? `এই মাসে ${n(s.distributedThisMonth)} • আজ ${n(s.distributedToday)}` : undefined} loading={stats.isLoading} />
          <StatCard title="কম স্টক" value={n(s?.lowStockCount)} icon={AlertTriangle} variant="warning" description={s ? `${n(s.outOfStockCount)}টি স্টকে নেই` : undefined} loading={stats.isLoading} onClick={() => setTab("materials")} />
        </div>

        {tab === "materials" && (attention.length > 0 || (s?.mostDistributed.length ?? 0) > 0 || (s?.recentDistributions.length ?? 0) > 0) && (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Panel title="মনোযোগ প্রয়োজন" description="কম স্টক বা স্টকে নেই — স্টক যোগ করুন" icon={AlertTriangle}>
              {attention.length === 0 ? <EmptyState compact title="সব ম্যাটেরিয়ালে যথেষ্ট স্টক আছে" /> : (
                <ul className="divide-y">
                  {attention.slice(0, 6).map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0 truncate">{m.name} <span className="text-xs text-muted-foreground">• ন্যূনতম {m.minimumStock}</span></span>
                      <span className={m.currentStock === 0 ? "font-semibold text-destructive" : "font-semibold text-warning"}>{m.currentStock === 0 ? "স্টকে নেই" : `${m.currentStock} বাকি`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="সর্বাধিক বিতরণকৃত" icon={TrendingUp}>
              <RankedBars rows={(s?.mostDistributed ?? []).map((m) => ({ key: m.materialId, label: m.materialName, value: m.totalQuantity }))} format={(v) => `${v.toLocaleString("bn-BD")} পিস`} emptyText="এখনো কোনো বিতরণ নেই" />
            </Panel>
            <Panel title="সাম্প্রতিক বিতরণ" icon={Send} className="lg:col-span-2 xl:col-span-1">
              {(s?.recentDistributions.length ?? 0) === 0 ? <EmptyState compact title="এখনো কোনো বিতরণ নেই" /> : (
                <ul className="divide-y">
                  {s!.recentDistributions.slice(0, 6).map((d) => (
                    <li key={(d as unknown as { _id?: string })._id ?? d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0"><span className="block truncate font-medium">{d.studentName}</span><span className="block truncate text-xs text-muted-foreground">{d.items.map((i) => i.materialName).join(", ")}</span></span>
                      <span className="shrink-0 text-xs text-muted-foreground">{d.distributionDate}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="materials"><Package className="mr-1.5 h-4 w-4" />ম্যাটেরিয়াল</TabsTrigger>
            <TabsTrigger value="distribution"><Send className="mr-1.5 h-4 w-4" />বিতরণ</TabsTrigger>
            <TabsTrigger value="reports"><BarChart3 className="mr-1.5 h-4 w-4" />রিপোর্ট</TabsTrigger>
          </TabsList>
          <TabsContent value="materials"><MaterialsListTab onChanged={refresh} onDistribute={(id) => { setPreselect(id); setTab("distribution"); }} /></TabsContent>
          <TabsContent value="distribution"><DistributionTab preselectMaterialId={preselect} onChanged={refresh} /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
        </Tabs>
      </div>
      <MaterialFormDialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) refresh(); }} editMaterial={null} />
    </DashboardLayout>
  );
}
