import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademic } from "@/contexts/AcademicContext";

type Kind = "session" | "course" | "subject" | "lecture";

interface Props {
  kind: Kind;
  value?: string;
  onValueChange: (v: string) => void;
  /** For subject: parent courseId. For lecture: parent courseSubjectId (a Subject's assignment to a specific Course — Lectures belong to that, not the Subject directly). */
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
  const { sessions, courses, lectures, getSubjectsByCourse } = useAcademic();

  // Active-or-currently-selected (Settings §25): a new pick can only land on
  // an active row, but re-opening this form for an already-admitted/assigned
  // record must still show its (possibly since-deactivated) choice by name
  // instead of going blank.
  const isSelectable = (id: string, status: "সক্রিয়" | "নিষ্ক্রিয়") => status !== "নিষ্ক্রিয়" || id === value;

  let items: { id: string; label: string }[] = [];
  if (kind === "session") items = sessions.filter((s) => isSelectable(s.id, s.status)).map((s) => ({ id: s.id, label: s.name }));
  else if (kind === "course") items = courses.filter((c) => isSelectable(c.id, c.status)).map((c) => ({ id: c.id, label: c.name }));
  else if (kind === "subject" && parentId)
    items = getSubjectsByCourse(parentId)
      .filter((s) => isSelectable(s.id, s.status))
      .map((s) => ({ id: s.id, label: s.name }));
  else if (kind === "lecture" && parentId)
    items = lectures
      .filter((l) => l.courseSubjectId === parentId && isSelectable(l.id, l.status))
      .sort((a, b) => a.lectureNumber - b.lectureNumber)
      .map((l) => ({ id: l.id, label: `${l.lectureNumber}. ${l.title}` }));

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