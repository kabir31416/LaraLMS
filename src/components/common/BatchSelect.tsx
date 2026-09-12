import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBatches } from "@/contexts/BatchContext";

interface Props {
  value?: string;
  onValueChange: (v: string) => void;
  /** Restrict list to batches owned by this director. */
  directorId?: string;
  /** Restrict to batches of a specific course id. */
  courseId?: string;
  placeholder?: string;
  includeAll?: boolean;
}

export function BatchSelect({
  value, onValueChange, directorId, courseId,
  placeholder = "ব্যাচ নির্বাচন করুন", includeAll,
}: Props) {
  const { batches, getBatchesByDirector } = useBatches();
  let list = directorId ? getBatchesByDirector(directorId) : batches;
  if (courseId) list = list.filter((b) => b.courseId === courseId);
  return (
    <Select value={value || ""} onValueChange={onValueChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="__all">সব ব্যাচ</SelectItem>}
        {list.length === 0 ? (
          <SelectItem value="__empty" disabled>কোনো ব্যাচ নেই</SelectItem>
        ) : (
          list.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)
        )}
      </SelectContent>
    </Select>
  );
}