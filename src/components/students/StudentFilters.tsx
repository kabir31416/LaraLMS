import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Cake } from "lucide-react";
import { useAcademic } from "@/contexts/AcademicContext";
import { useBatches } from "@/contexts/BatchContext";
import { api } from "@/lib/apiClient";
import { GENDERS } from "@/types/student";

export type DueStatus = "all" | "has" | "none";

interface HscInstitutionOption {
  _id: string;
  name: string;
}

interface StudentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  courseId: string;
  onCourseIdChange: (value: string) => void;
  batchId: string;
  onBatchIdChange: (value: string) => void;
  hscInstitution: string;
  onHscInstitutionChange: (value: string) => void;
  division: string;
  onDivisionChange: (value: string) => void;
  district: string;
  onDistrictChange: (value: string) => void;
  guardianMobile: string;
  onGuardianMobileChange: (value: string) => void;
  gender: string;
  onGenderChange: (value: string) => void;
  dueStatus: DueStatus;
  onDueStatusChange: (value: DueStatus) => void;
  birthdayToday: boolean;
  onBirthdayTodayChange: (value: boolean) => void;
}

export function StudentFilters({
  search,
  onSearchChange,
  courseId,
  onCourseIdChange,
  batchId,
  onBatchIdChange,
  hscInstitution,
  onHscInstitutionChange,
  division,
  onDivisionChange,
  district,
  onDistrictChange,
  guardianMobile,
  onGuardianMobileChange,
  gender,
  onGenderChange,
  dueStatus,
  onDueStatusChange,
  birthdayToday,
  onBirthdayTodayChange,
}: StudentFiltersProps) {
  const { activeCourses } = useAcademic();
  const { batches } = useBatches();

  // Course -> Batch dependent filtering (§11): once a course is picked, the
  // Batch dropdown narrows to that course's own batches only, since a batch
  // never spans multiple courses (batch.model.ts's courseId is required).
  const batchesForCourse = useMemo(
    () => (courseId === "all" ? batches : batches.filter((b) => b.courseId === courseId)),
    [batches, courseId],
  );

  const handleCourseChange = (value: string) => {
    onCourseIdChange(value);
    // The previously-selected batch may not belong to the newly-selected
    // course anymore — reset it rather than silently keeping an
    // inconsistent combination active.
    if (value !== "all" && batchId !== "all" && batchId !== "unassigned") {
      const stillValid = batches.some((b) => b.id === batchId && b.courseId === value);
      if (!stillValid) onBatchIdChange("all");
    }
  };

  // HSC Institution options — a plain dropdown fed by the shared master
  // data (§5/§9), same convention as Course/Batch above. Fetched once; a
  // coaching centre's institution list is small enough not to need its own
  // search-as-you-type UI here (unlike the admission-time combobox, which
  // exists specifically to let an admin *add* a new one).
  const [institutions, setInstitutions] = useState<HscInstitutionOption[]>([]);
  useEffect(() => {
    api.getWithMeta<HscInstitutionOption[]>("/hsc-institutions?limit=100").then((res) => setInstitutions(res.data)).catch(() => {});
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="নাম, আইডি, রোল বা মোবাইল দিয়ে খুঁজুন..."
          className="pl-9"
        />
      </div>
      <Select value={courseId} onValueChange={handleCourseChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="কোর্স" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল কোর্স</SelectItem>
          {activeCourses.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={batchId} onValueChange={onBatchIdChange}>
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="ব্যাচ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল ব্যাচ</SelectItem>
          <SelectItem value="unassigned">Batch assigned হয়নি</SelectItem>
          {batchesForCourse.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={hscInstitution} onValueChange={onHscInstitutionChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="HSC প্রতিষ্ঠান" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল প্রতিষ্ঠান</SelectItem>
          {institutions.map((i) => (
            <SelectItem key={i._id} value={i.name}>{i.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={gender} onValueChange={onGenderChange}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="লিঙ্গ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল লিঙ্গ</SelectItem>
          {GENDERS.map((g) => (
            <SelectItem key={g} value={g}>{g}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={division}
        onChange={(e) => onDivisionChange(e.target.value)}
        placeholder="বিভাগ"
        className="w-[130px]"
      />
      <Input
        value={district}
        onChange={(e) => onDistrictChange(e.target.value)}
        placeholder="জেলা"
        className="w-[130px]"
      />
      <Input
        value={guardianMobile}
        onChange={(e) => onGuardianMobileChange(e.target.value)}
        placeholder="অভিভাবকের মোবাইল"
        className="w-[170px]"
      />
      <Select value={dueStatus} onValueChange={(v) => onDueStatusChange(v as DueStatus)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="বকেয়া" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল (বকেয়া)</SelectItem>
          <SelectItem value="has">বকেয়া আছে</SelectItem>
          <SelectItem value="none">বকেয়া নেই</SelectItem>
        </SelectContent>
      </Select>
      <button
        onClick={() => onBirthdayTodayChange(!birthdayToday)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
          birthdayToday
            ? "bg-primary/10 text-primary border-primary/30"
            : "bg-card text-muted-foreground border-border hover:bg-muted"
        }`}
      >
        <Cake className="h-4 w-4" /> আজকের জন্মদিন
      </button>
    </div>
  );
}
