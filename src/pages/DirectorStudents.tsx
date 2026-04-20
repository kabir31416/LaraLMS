import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { useStudents } from "@/contexts/StudentContext";

const DirectorStudents = () => {
  const { user } = useAuth();
  const { batches } = useBatches();
  const { students } = useStudents();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");

  const myBatches = useMemo(
    () => (user ? batches.filter((b) => b.directorId === user.staffId) : []),
    [batches, user],
  );
  const myStudentIds = useMemo(() => new Set(myBatches.flatMap((b) => b.studentIds)), [myBatches]);

  const list = useMemo(() => {
    const q = search.toLowerCase();
    return students
      .filter((s) => myStudentIds.has(s.id))
      .filter((s) => {
        if (batchFilter !== "all") {
          const b = myBatches.find((x) => x.id === batchFilter);
          if (!b || !b.studentIds.includes(s.id)) return false;
        }
        return !q || s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.mobile.includes(q);
      });
  }, [students, myStudentIds, search, batchFilter, myBatches]);

  if (!user || user.role !== "Batch Director") {
    return <Navigate to="/login" replace />;
  }

  const batchOf = (sid: string) => myBatches.find((b) => b.studentIds.includes(sid));

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">আমার শিক্ষার্থী</h1>
          <p className="text-sm text-muted-foreground">মোট {list.length} জন</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, আইডি বা মোবাইল..." className="pl-9" />
          </div>
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="ব্যাচ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সকল ব্যাচ</SelectItem>
              {myBatches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <Card className="border-none shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">ছবি</TableHead>
                <TableHead>আইডি</TableHead>
                <TableHead>নাম</TableHead>
                <TableHead>ব্যাচ</TableHead>
                <TableHead>সময়</TableHead>
                <TableHead>মোবাইল</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">কোনো শিক্ষার্থী নেই</TableCell></TableRow>
              ) : (
                list.map((s) => {
                  const b = batchOf(s.id);
                  return (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/students/${s.id}`)}>
                      <TableCell>
                        <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{s.name.charAt(0)}</AvatarFallback></Avatar>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.studentId}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{b?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b?.batchTime || "—"}</TableCell>
                      <TableCell className="text-sm">{s.mobile}</TableCell>
                      <TableCell>
                        <Badge className={s.status === "সক্রিয়" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DirectorStudents;
