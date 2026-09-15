import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw } from "lucide-react";
import { useBatches } from "@/contexts/BatchContext";
import { ChanceFilters, RESULT_ROUNDS, SELECTION_TYPES } from "./chanceResultFilters";

export interface ChanceFilterOptions {
  programs: string[];
  sessions: string[];
  institutes: string[];
}

interface Props {
  filters: ChanceFilters;
  onChange: (next: ChanceFilters) => void;
  isAdmin: boolean;
  options: ChanceFilterOptions;
  onRefresh: () => void;
  /** Institute-wise / Batch-wise tabs group by exactly one of these dimensions — hide that dimension's own filter there since it doesn't apply to itself. */
  hideInstitute?: boolean;
  hideBatch?: boolean;
  hideSearch?: boolean;
}

export function ChanceFilterBar({ filters, onChange, isAdmin, options, onRefresh, hideInstitute, hideBatch, hideSearch }: Props) {
  const { batches } = useBatches();
  const set = <K extends keyof ChanceFilters>(key: K, value: ChanceFilters[K]) => onChange({ ...filters, [key]: value });

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-4 flex flex-wrap items-center gap-3">
        {!hideSearch && (
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="নাম, রোল, মোবাইল, ভর্তি রোল বা ইনস্টিটিউট দিয়ে খুঁজুন..."
              className="pl-9"
            />
          </div>
        )}

        <Select value={filters.programName} onValueChange={(v) => set("programName", v)}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="প্রোগ্রাম" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল প্রোগ্রাম</SelectItem>
            {options.programs.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={filters.session} onValueChange={(v) => set("session", v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="সেশন" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল সেশন</SelectItem>
            {options.sessions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
          </SelectContent>
        </Select>

        {!hideInstitute && (
          <Select value={filters.instituteName} onValueChange={(v) => set("instituteName", v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="ইনস্টিটিউট" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সকল ইনস্টিটিউট</SelectItem>
              {options.institutes.map((i) => (<SelectItem key={i} value={i}>{i}</SelectItem>))}
            </SelectContent>
          </Select>
        )}

        {isAdmin && !hideBatch && (
          <Select value={filters.batchId} onValueChange={(v) => set("batchId", v)}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="ব্যাচ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সকল ব্যাচ</SelectItem>
              <SelectItem value="unassigned">Batch assigned হয়নি</SelectItem>
              {batches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
            </SelectContent>
          </Select>
        )}

        <Select value={filters.resultRound} onValueChange={(v) => set("resultRound", v as ChanceFilters["resultRound"])}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="রাউন্ড" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল রাউন্ড</SelectItem>
            {RESULT_ROUNDS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={filters.selectionType} onValueChange={(v) => set("selectionType", v as ChanceFilters["selectionType"])}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">মেধা / উপজাতি</SelectItem>
            {SELECTION_TYPES.map((s) => (<SelectItem key={s} value={s}>{s === "Merit" ? "মেধা (Merit)" : "উপজাতি (Tribal)"}</SelectItem>))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={onRefresh} title="রিফ্রেশ"><RefreshCw className="h-4 w-4" /></Button>
      </CardContent>
    </Card>
  );
}
