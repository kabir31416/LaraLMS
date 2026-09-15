import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import { Package, Boxes, Send, CalendarDays, AlertTriangle, XCircle } from "lucide-react";
import { api } from "@/lib/apiClient";
import type { DashboardStats } from "@/types/material";
import { MaterialsListTab } from "@/components/materials/MaterialsListTab";
import { DistributionTab } from "@/components/materials/DistributionTab";
import { ReportsTab } from "@/components/materials/ReportsTab";

/**
 * Coaching Material Inventory & Student Distribution System — replaces the
 * old library-style Book Management (author/ISBN/lending/branch stock) with
 * a centralized material catalog, transaction-based stock, and student
 * distribution, per the spec. Route/filename kept as "Books"/"/books" for
 * sidebar/routing compatibility; only the UI content and underlying data
 * model changed.
 */
export default function Books() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tab, setTab] = useState("materials");

  useEffect(() => {
    api.get<DashboardStats>("/materials/dashboard/stats").then(setStats).catch(() => setStats(null));
  }, [tab]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">ম্যাটেরিয়াল ব্যবস্থাপনা</h1>
          <p className="text-sm text-muted-foreground">কোচিং ম্যাটেরিয়াল ইনভেন্টরি ও শিক্ষার্থী বিতরণ ব্যবস্থাপনা</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard title="মোট ম্যাটেরিয়াল" value={stats ? stats.totalMaterials.toLocaleString("bn-BD") : "—"} icon={Package} variant="primary" />
          <StatCard title="মোট স্টক" value={stats ? stats.totalStock.toLocaleString("bn-BD") : "—"} icon={Boxes} variant="info" />
          <StatCard title="আজ বিতরণ" value={stats ? stats.distributedToday.toLocaleString("bn-BD") : "—"} icon={Send} variant="success" />
          <StatCard title="এই মাসে বিতরণ" value={stats ? stats.distributedThisMonth.toLocaleString("bn-BD") : "—"} icon={CalendarDays} variant="success" />
          <StatCard title="লো স্টক" value={stats ? stats.lowStockCount.toLocaleString("bn-BD") : "—"} icon={AlertTriangle} variant="warning" />
          <StatCard title="স্টকে নেই" value={stats ? stats.outOfStockCount.toLocaleString("bn-BD") : "—"} icon={XCircle} variant="warning" />
        </div>

        {stats && (stats.mostDistributed.length > 0 || stats.recentDistributions.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">সর্বাধিক বিতরণকৃত ম্যাটেরিয়াল</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {stats.mostDistributed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">কোনো তথ্য নেই</p>
                ) : (
                  stats.mostDistributed.map((m, i) => (
                    <div key={m.materialId} className="flex items-center justify-between text-sm">
                      <span>{i + 1}. {m.materialName}</span>
                      <Badge variant="outline">{m.totalQuantity}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">সাম্প্রতিক বিতরণ</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {stats.recentDistributions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">কোনো বিতরণ নেই</p>
                ) : (
                  stats.recentDistributions.slice(0, 6).map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5 last:pb-0">
                      <span>{d.studentName} — {d.items.map((i) => i.materialName).join(", ")}</span>
                      <span className="text-xs text-muted-foreground">{d.distributionDate}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="bg-card border">
            <TabsTrigger value="materials">ম্যাটেরিয়াল</TabsTrigger>
            <TabsTrigger value="distribution">শিক্ষার্থী বিতরণ</TabsTrigger>
            <TabsTrigger value="reports">রিপোর্ট</TabsTrigger>
          </TabsList>
          <TabsContent value="materials"><MaterialsListTab /></TabsContent>
          <TabsContent value="distribution"><DistributionTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
