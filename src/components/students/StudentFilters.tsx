import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { COURSES, BATCHES, SECTIONS } from "@/types/student";

interface StudentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  course: string;
  onCourseChange: (value: string) => void;
  batch: string;
  onBatchChange: (value: string) => void;
  section: string;
  onSectionChange: (value: string) => void;
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
  dueOnly,
  onDueOnlyChange,
}: StudentFiltersProps) {
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
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="ব্যাচ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল ব্যাচ</SelectItem>
          {BATCHES.map((b) => (
            <SelectItem key={b} value={b}>{b}</SelectItem>
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
