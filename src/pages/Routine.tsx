import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoutines } from "@/contexts/RoutineContext";
import { RoutineForm } from "@/components/routine/RoutineForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Clock, MapPin } from "lucide-react";
import { DAYS, TEACHERS, type Day, type RoutineEntry } from "@/types/routine";
import { BATCHES } from "@/types/student";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Routine = () => {
  const { routines, deleteRoutine } = useRoutines();
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<RoutineEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [filterBatch, setFilterBatch] = useState("all");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterDay, setFilterDay] = useState<string>("all");

  const filtered = useMemo(() => {
    return routines.filter((r) => {
      if (filterBatch !== "all" && !r.batches.includes(filterBatch)) return false;
      if (filterTeacher !== "all" && r.teacherId !== filterTeacher) return false;
      if (filterDay !== "all" && r.day !== filterDay) return false;
      return true;
    });
  }, [routines, filterBatch, filterTeacher, filterDay]);

  const openEdit = (entry: RoutineEntry) => {
    setEditEntry(entry);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditEntry(null);
    setFormOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteRoutine(deleteId);
      toast.success("রুটিন মুছে ফেলা হয়েছে");
      setDeleteId(null);
    }
  };

  const teacherName = (id: string) => TEACHERS.find((t) => t.id === id)?.name || "—";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">রুটিন ম্যানেজমেন্ট</h1>
            <p className="text-muted-foreground text-sm">সাপ্তাহিক ক্লাস রুটিন তৈরি ও পরিচালনা</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> নতুন রুটিন
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ব্যাচ ফিল্টার</label>
                <Select value={filterBatch} onValueChange={setFilterBatch}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সব ব্যাচ</SelectItem>
                    {BATCHES.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">শিক্ষক ফিল্টার</label>
                <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সব শিক্ষক</SelectItem>
                    {TEACHERS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">দিন ফিল্টার</label>
                <Select value={filterDay} onValueChange={setFilterDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সব দিন</SelectItem>
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Views */}
        <Tabs defaultValue="weekly" className="space-y-4">
          <TabsList className="bg-card border">
            <TabsTrigger value="weekly">সাপ্তাহিক গ্রিড</TabsTrigger>
            <TabsTrigger value="batch">ব্যাচ অনুযায়ী</TabsTrigger>
            <TabsTrigger value="teacher">শিক্ষক অনুযায়ী</TabsTrigger>
            <TabsTrigger value="day">দিন অনুযায়ী</TabsTrigger>
          </TabsList>

          {/* Weekly grid view */}
          <TabsContent value="weekly">
            <WeeklyGrid entries={filtered} onEdit={openEdit} onDelete={setDeleteId} />
          </TabsContent>

          {/* Batch wise */}
          <TabsContent value="batch">
            <div className="space-y-4">
              {BATCHES.filter((b) => filterBatch === "all" || b === filterBatch).map((batch) => {
                const items = filtered.filter((r) => r.batches.includes(batch));
                return (
                  <Card key={batch} className="border-none shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="secondary">{batch}</Badge>
                        <span className="text-sm text-muted-foreground font-normal">{items.length} ক্লাস</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RoutineList entries={items} onEdit={openEdit} onDelete={setDeleteId} groupBy="day" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Teacher wise */}
          <TabsContent value="teacher">
            <div className="space-y-4">
              {TEACHERS.filter((t) => filterTeacher === "all" || t.id === filterTeacher).map((teacher) => {
                const items = filtered.filter((r) => r.teacherId === teacher.id);
                return (
                  <Card key={teacher.id} className="border-none shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span>{teacher.name}</span>
                        <Badge variant="outline" className="text-xs">{teacher.subject}</Badge>
                        <span className="text-sm text-muted-foreground font-normal ml-auto">{items.length} ক্লাস</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RoutineList entries={items} onEdit={openEdit} onDelete={setDeleteId} groupBy="day" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Day wise */}
          <TabsContent value="day">
            <div className="space-y-4">
              {DAYS.filter((d) => filterDay === "all" || d === filterDay).map((day) => {
                const items = filtered
                  .filter((r) => r.day === day)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                return (
                  <Card key={day} className="border-none shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span>{day}</span>
                        <span className="text-sm text-muted-foreground font-normal ml-auto">{items.length} ক্লাস</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RoutineList entries={items} onEdit={openEdit} onDelete={setDeleteId} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <RoutineForm open={formOpen} onOpenChange={setFormOpen} editEntry={editEntry} />

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>রুটিন মুছে ফেলবেন?</AlertDialogTitle>
              <AlertDialogDescription>এই কাজটি ফিরিয়ে আনা যাবে না।</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>বাতিল</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">মুছুন</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

/* ================= Weekly Grid ================= */
function WeeklyGrid({
  entries,
  onEdit,
  onDelete,
}: {
  entries: RoutineEntry[];
  onEdit: (e: RoutineEntry) => void;
  onDelete: (id: string) => void;
}) {
  // Collect unique time slots sorted
  const slots = Array.from(
    new Set(entries.map((e) => `${e.startTime}-${e.endTime}`))
  ).sort();

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-0 overflow-x-auto">
        {slots.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">কোনো রুটিন নেই</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-3 text-left font-medium border-b border-r min-w-[110px]">সময়</th>
                {DAYS.map((d) => (
                  <th key={d} className="p-3 text-left font-medium border-b border-r min-w-[160px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const [start, end] = slot.split("-");
                return (
                  <tr key={slot} className="hover:bg-muted/20">
                    <td className="p-3 border-b border-r font-medium text-muted-foreground align-top">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs">{start}</span>
                      </div>
                      <div className="text-xs ml-5 text-muted-foreground/70">— {end}</div>
                    </td>
                    {DAYS.map((d) => {
                      const cellItems = entries.filter(
                        (e) => e.day === d && e.startTime === start && e.endTime === end
                      );
                      return (
                        <td key={d} className="p-2 border-b border-r align-top">
                          <div className="space-y-1.5">
                            {cellItems.map((item) => (
                              <RoutineCell key={item.id} entry={item} onEdit={onEdit} onDelete={onDelete} />
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function RoutineCell({
  entry,
  onEdit,
  onDelete,
}: {
  entry: RoutineEntry;
  onEdit: (e: RoutineEntry) => void;
  onDelete: (id: string) => void;
}) {
  const teacher = TEACHERS.find((t) => t.id === entry.teacherId);
  return (
    <div className="group rounded-md bg-primary/5 border border-primary/10 p-2 text-xs hover:bg-primary/10 transition-colors">
      <div className="flex items-start justify-between gap-1">
        <div className="font-semibold text-primary">{entry.subject}</div>
        <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
          <button onClick={() => onEdit(entry)} className="p-0.5 hover:text-primary"><Pencil className="h-3 w-3" /></button>
          <button onClick={() => onDelete(entry.id)} className="p-0.5 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="text-muted-foreground mt-0.5">{teacher?.name}</div>
      <div className="flex flex-wrap gap-1 mt-1">
        {entry.batches.map((b) => (
          <span key={b} className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground text-[10px]">{b}</span>
        ))}
      </div>
      {entry.room && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
          <MapPin className="h-2.5 w-2.5" /> রুম {entry.room}
        </div>
      )}
    </div>
  );
}

/* ================= List view ================= */
function RoutineList({
  entries,
  onEdit,
  onDelete,
  groupBy,
}: {
  entries: RoutineEntry[];
  onEdit: (e: RoutineEntry) => void;
  onDelete: (id: string) => void;
  groupBy?: "day";
}) {
  if (entries.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-4">কোনো রুটিন নেই</div>;
  }

  const groups: Record<string, RoutineEntry[]> = {};
  if (groupBy === "day") {
    DAYS.forEach((d) => {
      const items = entries.filter((e) => e.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
      if (items.length) groups[d] = items;
    });
  } else {
    groups[""] = [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([label, items]) => (
        <div key={label}>
          {label && <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>}
          <div className="space-y-1.5">
            {items.map((e) => (
              <RoutineRow key={e.id} entry={e} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoutineRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: RoutineEntry;
  onEdit: (e: RoutineEntry) => void;
  onDelete: (id: string) => void;
}) {
  const teacher = TEACHERS.find((t) => t.id === entry.teacherId);
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-md border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[110px]">
        <Clock className="h-3.5 w-3.5" />
        <span>{entry.startTime} — {entry.endTime}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{entry.subject}</div>
        <div className="text-xs text-muted-foreground">{teacher?.name}{entry.room ? ` • রুম ${entry.room}` : ""}</div>
      </div>
      <div className="hidden md:flex flex-wrap gap-1 max-w-[280px] justify-end">
        {entry.batches.map((b) => (
          <Badge key={b} variant="outline" className="text-[10px]">{b}</Badge>
        ))}
      </div>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(entry)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(entry.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default Routine;
