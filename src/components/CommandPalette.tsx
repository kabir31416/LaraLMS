import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Loader2, Search, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { hasPermission, useAuth } from "@/contexts/AuthContext";
import { navGroupsFor } from "@/lib/navigation";
import { api } from "@/lib/apiClient";
import { STUDENTS_READ } from "@/lib/permissions";

interface StudentHit { _id: string; name: string; registrationId: string; currentRollNumber?: string; phone?: string; course?: string }

/**
 * Global search (Ctrl/⌘+K) — jumps to any page this user may open (the same
 * catalog and visibility rules as the sidebar) and, for roles that can read
 * students, searches the real Student list server-side (name, Registration
 * ID, roll, phone, guardian phone — the Student List's own search) and opens
 * the profile. Only 6 student rows are ever fetched per query.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentHit[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const canSearchStudents = user?.role === "Admin" && hasPermission(user, STUDENTS_READ);

  useEffect(() => {
    if (!open) { setQuery(""); setStudents([]); }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!canSearchStudents || q.length < 2) { setStudents([]); setLoading(false); return; }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await api.get<StudentHit[]>(`/students?search=${encodeURIComponent(q)}&limit=6`);
        if (mine === seq.current) setStudents(rows);
      } catch {
        if (mine === seq.current) setStudents([]);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, canSearchStudents]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return navGroupsFor(user)
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => !q || i.title.toLowerCase().includes(q) || g.label.toLowerCase().includes(q) || (i.keywords ?? "").includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [user, query]);

  const go = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl top-[12%] translate-y-0 data-[state=open]:slide-in-from-top-2 [&>button]:hidden">
        <DialogTitle className="sr-only">খুঁজুন</DialogTitle>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
          <CommandInput value={query} onValueChange={setQuery} placeholder={canSearchStudents ? "পেজ বা শিক্ষার্থী খুঁজুন (নাম, রেজি. নং, মোবাইল)..." : "পেজ খুঁজুন..."} className="h-12" />
          <CommandList className="max-h-[60dvh]">
            <CommandEmpty>{loading ? "খোঁজা হচ্ছে..." : "কিছু পাওয়া যায়নি"}</CommandEmpty>
            {canSearchStudents && query.trim().length >= 2 && (students.length > 0 || loading) && (
              <CommandGroup heading="শিক্ষার্থী">
                {loading && students.length === 0 && (
                  <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />খোঁজা হচ্ছে...</div>
                )}
                {students.map((s) => (
                  <CommandItem key={s._id} value={`student-${s._id}`} onSelect={() => go(`/students/${s._id}`)} className="gap-3">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.registrationId}{s.currentRollNumber ? ` • রেজি. ${s.currentRollNumber}` : ""}{s.phone ? ` • ${s.phone}` : ""}{s.course ? ` • ${s.course}` : ""}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {groups.map((g) => (
              <CommandGroup key={g.label} heading={g.label}>
                {g.items.map((item) => (
                  <CommandItem key={item.url} value={item.url} onSelect={() => go(item.url)} className="group gap-3">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{item.title}</span>
                    <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100" />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** The header trigger — looks like a search field on desktop, an icon on phones. */
export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="খুঁজুন"
      className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground sm:w-64"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline flex-1 text-left">খুঁজুন...</span>
      <kbd className="hidden sm:inline rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium">{isMac ? "⌘" : "Ctrl"} K</kbd>
    </button>
  );
}
