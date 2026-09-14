import { Fragment, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import type { AuditLogEntry } from "@/types/academic";
import { toast } from "sonner";

/**
 * Configuration History / Audit Log viewer (Settings §23) — read-only over
 * the existing AuditLog collection (backend/src/audit), which every
 * module's service already writes to. No new audit system, just the first
 * frontend to read it.
 */
export function AuditLogTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async (mod: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "50", sortBy: "timestamp", sortOrder: "desc" });
      if (mod.trim()) qs.set("module", mod.trim());
      const docs = await api.get<(Omit<AuditLogEntry, "id"> & { _id: string })[]>(`/audit-logs?${qs.toString()}`);
      setEntries(docs.map(({ _id, ...rest }) => ({ ...rest, id: _id })));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(""); }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">মডিউল দিয়ে ফিল্টার করুন</label>
          <Input value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} placeholder="যেমন: settings, academic, students" className="w-[240px]" />
        </div>
        <Button variant="outline" onClick={() => load(moduleFilter)}>খুঁজুন</Button>
        {moduleFilter && <Button variant="ghost" onClick={() => { setModuleFilter(""); load(""); }}>ফিল্টার মুছুন</Button>}
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[36px]" />
                <TableHead>সময়</TableHead>
                <TableHead>মডিউল</TableHead>
                <TableHead>অ্যাকশন</TableHead>
                <TableHead>ভূমিকা</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">লোড হচ্ছে...</TableCell></TableRow>
              ) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">কোনো এন্ট্রি নেই</TableCell></TableRow>
              ) : (
                entries.map((e) => {
                  const isOpen = expanded === e.id;
                  return (
                    <Fragment key={e.id}>
                      <TableRow>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(isOpen ? null : e.id)}>
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm">{new Date(e.timestamp).toLocaleString("bn-BD")}</TableCell>
                        <TableCell><Badge variant="outline">{e.module}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{e.action}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.actorRole || "—"}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell />
                          <TableCell colSpan={4} className="py-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">পূর্বের অবস্থা</p>
                                <pre className="text-xs bg-background border rounded p-2 max-h-48 overflow-auto">{JSON.stringify(e.before ?? null, null, 2)}</pre>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">নতুন অবস্থা</p>
                                <pre className="text-xs bg-background border rounded p-2 max-h-48 overflow-auto">{JSON.stringify(e.after ?? null, null, 2)}</pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
