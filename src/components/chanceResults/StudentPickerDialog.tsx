import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { api } from "@/lib/apiClient";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface SearchStudent {
  _id: string;
  name: string;
  phone: string;
  currentRollNumber?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (studentId: string, studentName: string) => void;
}

/**
 * A student search must hit the server directly (not any preloaded
 * Context) since the coaching centre's full student list can run into the
 * hundreds — same reasoning AdmissionResult.tsx already documents for its
 * own server-side search.
 */
export function StudentPickerDialog({ open, onOpenChange, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 350);
  const [results, setResults] = useState<SearchStudent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setSearch(""); setResults([]); return; }
  }, [open]);

  useEffect(() => {
    if (!open || !debounced.trim()) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    api.getWithMeta<SearchStudent[]>(`/students?search=${encodeURIComponent(debounced.trim())}&limit=10`)
      .then((res) => { if (!cancelled) setResults(res.data); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>শিক্ষার্থী খুঁজে ম্যাচ করুন</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="নাম, রোল বা মোবাইল দিয়ে খুঁজুন..."
              className="pl-9"
            />
          </div>
          <div className="max-h-72 overflow-auto space-y-1">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-6">খোঁজা হচ্ছে...</p>
            ) : !debounced.trim() ? (
              <p className="text-sm text-muted-foreground text-center py-6">শিক্ষার্থীর নাম বা রোল লিখুন</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
            ) : (
              results.map((s) => (
                <button
                  key={s._id}
                  onClick={() => onSelect(s._id, s.name)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/60 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.currentRollNumber || "—"} • {s.phone}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
