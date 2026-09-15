import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Users, Award, TrendingUp, Building2, GraduationCap, AlertTriangle, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";
import type { ChanceResultStats } from "@/types/chanceResult";
import { ChanceFilterBar, ChanceFilterOptions } from "@/components/chanceResults/ChanceFilterBar";
import { ChanceFilters, DEFAULT_CHANCE_FILTERS, buildFilterQuery } from "@/components/chanceResults/chanceResultFilters";
import { ChanceStudentsList } from "@/components/chanceResults/ChanceStudentsList";
import { InstituteSummaryTab } from "@/components/chanceResults/InstituteSummaryTab";
import { BatchSummaryTab } from "@/components/chanceResults/BatchSummaryTab";
import { UploadImportTab } from "@/components/chanceResults/UploadImportTab";
import { ImportHistoryTab } from "@/components/chanceResults/ImportHistoryTab";

/**
 * Admission Result Management ("চান্স রেজাল্ট") — built on top of the
 * existing Admission Roll bookkeeping page (AdmissionResult.tsx / route
 * /admission-result), which only records each student's own roll number.
 * This page is the PDF-import pipeline: upload an official result →
 * preview → confirm → browse/filter/export the resulting "Chance Student"
 * list, institute-wise and batch-wise, plus (Admin-only) import history
 * with rollback and manual matching of unmatched rolls.
 *
 * Deliberately a different route/component from AdmissionResult.tsx to
 * avoid confusing the two features.
 */
const DEFAULT_OPTIONS: ChanceFilterOptions = { programs: [], sessions: [], institutes: [] };

export default function ChanceResults() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "Admin";

  const [filters, setFilters] = useState<ChanceFilters>(DEFAULT_CHANCE_FILTERS);
  const [options, setOptions] = useState<ChanceFilterOptions>(DEFAULT_OPTIONS);
  const [stats, setStats] = useState<ChanceResultStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tab, setTab] = useState("students");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadOptions = useCallback(async () => {
    try {
      const opts = await api.get<ChanceFilterOptions>("/admission-results/filter-options");
      setOptions(opts);
    } catch {
      // Non-critical — filter dropdowns just stay empty ("সকল...") until a retry/refresh.
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const qs = buildFilterQuery(filters, isAdmin);
      const data = await api.get<ChanceResultStats>(`/admission-results/stats?${qs.toString()}`);
      setStats(data);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পরিসংখ্যান লোড করা যায়নি।");
    } finally {
      setStatsLoading(false);
    }
  }, [filters, isAdmin]);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { loadStats(); }, [loadStats, refreshKey]);

  if (!user || (user.role !== "Admin" && user.role !== "Batch Director")) {
    return <Navigate to="/login" replace />;
  }

  const refreshAll = () => setRefreshKey((k) => k + 1);

  const jumpToStudents = (patch: Partial<ChanceFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setTab("students");
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(isAdmin ? "/admission-result" : "/director/admission-result")}
            title="অ্যাডমিশন রেজাল্টে ফিরে যান"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">চান্স রেজাল্ট</h1>
            <p className="text-sm text-muted-foreground">অফিসিয়াল ভর্তি ফলাফল পিডিএফ আপলোড, ম্যাচিং ও চান্সপ্রাপ্ত শিক্ষার্থীদের ব্যবস্থাপনা</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard title="মোট শিক্ষার্থী" value={stats ? stats.totalStudents.toLocaleString("bn-BD") : statsLoading ? "…" : "—"} icon={Users} variant="primary" />
          <StatCard title="চান্সপ্রাপ্ত" value={stats ? stats.chance.toLocaleString("bn-BD") : statsLoading ? "…" : "—"} icon={Award} variant="success" />
          <StatCard title="চান্স রেট" value={stats ? `${stats.chanceRate}%` : statsLoading ? "…" : "—"} icon={TrendingUp} variant="info" />
          <StatCard title="ইনস্টিটিউট" value={stats ? stats.totalInstitutes.toLocaleString("bn-BD") : statsLoading ? "…" : "—"} icon={Building2} variant="primary" />
          <StatCard title="মেধা / উপজাতি" value={stats ? `${stats.merit} / ${stats.tribal}` : statsLoading ? "…" : "—"} icon={GraduationCap} variant="info" />
          <StatCard title="অমিলিত রোল" value={stats ? stats.unmatched.toLocaleString("bn-BD") : statsLoading ? "…" : "—"} icon={AlertTriangle} variant="warning" />
        </div>

        <ChanceFilterBar
          filters={filters}
          onChange={setFilters}
          isAdmin={isAdmin}
          options={options}
          onRefresh={refreshAll}
          hideInstitute={tab === "institutes"}
          hideBatch={tab === "batches"}
          hideSearch={tab === "institutes" || tab === "batches"}
        />

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="bg-card border flex-wrap h-auto">
            <TabsTrigger value="students">চান্স স্টুডেন্ট</TabsTrigger>
            <TabsTrigger value="institutes">ইনস্টিটিউট অনুযায়ী</TabsTrigger>
            <TabsTrigger value="batches">ব্যাচ অনুযায়ী</TabsTrigger>
            {isAdmin && <TabsTrigger value="upload">পিডিএফ আপলোড</TabsTrigger>}
            {isAdmin && <TabsTrigger value="history">ইমপোর্ট হিস্ট্রি</TabsTrigger>}
          </TabsList>

          <TabsContent value="students">
            <ChanceStudentsList filters={filters} isAdmin={isAdmin} refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="institutes">
            <InstituteSummaryTab filters={filters} isAdmin={isAdmin} refreshKey={refreshKey} onViewStudents={(instituteName) => jumpToStudents({ instituteName })} />
          </TabsContent>
          <TabsContent value="batches">
            <BatchSummaryTab filters={filters} isAdmin={isAdmin} refreshKey={refreshKey} onViewStudents={(batchId) => jumpToStudents({ batchId })} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="upload">
              <UploadImportTab onImported={() => { refreshAll(); setTab("history"); }} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="history">
              <ImportHistoryTab refreshKey={refreshKey} onChanged={refreshAll} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
