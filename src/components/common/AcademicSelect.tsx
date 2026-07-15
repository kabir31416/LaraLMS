import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademic } from "@/contexts/AcademicContext";

type Kind = "session" | "course" | "subject" | "lecture";

interface Props {
  kind: Kind;
  value?: string;
  onValueChange: (v: string) => void;
  /** For subject: parent courseId. For lecture: parent subjectId. */
  parentId?: string;
  /** Emit `name` instead of `id` (useful for legacy string fields). */
  emit?: "id" | "name";
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Master-data dropdown backed by AcademicContext. Use everywhere instead of
 * hardcoded course/subject/lecture arrays.
 */
export function AcademicSelect({
  kind, value, onValueChange, parentId, emit = "id",
  placeholder = "নির্বাচন করুন", disabled,
}: Props) {
  const { sessions, courses, getSubjectsByCourse, getLecturesBySubject } = useAcademic();

  let items: { id: string; label: string }[] = [];
  if (kind === "session") items = sessions.map((s) => ({ id: s.id, label: s.name }));
  else if (kind === "course") items = courses.map((c) => ({ id: c.id, label: c.name }));
  else if (kind === "subject" && parentId)
    items = getSubjectsByCourse(parentId).map((s) => ({ id: s.id, label: s.name }));
  else if (kind === "lecture" && parentId)
    items = getLecturesBySubject(parentId).map((l) => ({ id: l.id, label: `${l.lectureNumber}. ${l.title}` }));

  const empty = items.length === 0;
  const emitValue = (id: string) => {
    if (emit === "name") {
      const found = items.find((x) => x.id === id);
      onValueChange(found?.label ?? id);
    } else onValueChange(id);
  };

  return (
    <Select value={value || ""} onValueChange={emitValue} disabled={disabled || empty}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {empty ? (
          <SelectItem value="__empty" disabled>
            {kind === "subject" || kind === "lecture" ? "প্রথমে উপরের নির্বাচন করুন" : "সেটিংস থেকে যোগ করুন"}
          </SelectItem>
        ) : (
          items.map((it) => <SelectItem key={it.id} value={emit === "name" ? it.label : it.id}>{it.label}</SelectItem>)
        )}
      </SelectContent>
    </Select>
  );
}