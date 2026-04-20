import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { COURSES, SECTIONS } from "@/types/student";
import { useBatches } from "@/contexts/BatchContext";
import { useStaff } from "@/contexts/StaffContext";

interface StudentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  course: string;
  onCourseChange: (value: string) => void;
  batch: string;
  onBatchChange: (value: string) => void;
  section: string;
  onSectionChange: (value: string) => void;
  director: string;
  onDirectorChange: (value: string) => void;
  dueOnly: boolean;
  onDueOnlyChange: (value: boolean) => void;
}

export function StudentFilters({
  search,
  onSearchChange,
  course,
  onCourseChange,
  batch,
  onBatchChange,
  section,
  onSectionChange,
  director,
  onDirectorChange,
  dueOnly,
  onDueOnlyChange,
}: StudentFiltersProps) {
  const { batches } = useBatches();
  const { staff } = useStaff();
  const directors = staff.filter((s) => s.staffType === "Batch Director");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="নাম, আইডি বা মোবাইল দিয়ে খুঁজুন..."
          className="pl-9"
        />
      </div>
      <Select value={course} onValueChange={onCourseChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="কোর্স" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল কোর্স</SelectItem>
          {COURSES.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={batch} onValueChange={onBatchChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="ব্যাচ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল ব্যাচ</SelectItem>
          <SelectItem value="unassigned">Batch assigned হয়নি</SelectItem>
          {batches.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={director} onValueChange={onDirectorChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="ডিরেক্টর" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল ডিরেক্টর</SelectItem>
          {directors.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={section} onValueChange={onSectionChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="সেকশন" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল সেকশন</SelectItem>
          {SECTIONS.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        onClick={() => onDueOnlyChange(!dueOnly)}
        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
          dueOnly
            ? "bg-destructive/10 text-destructive border-destructive/30"
            : "bg-card text-muted-foreground border-border hover:bg-muted"
        }`}
      >
        বকেয়া আছে
      </button>
    </div>
  );
}
