import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useBatches } from "@/contexts/BatchContext";
import { useStudents } from "@/contexts/StudentContext";
import { useAttendance } from "@/contexts/AttendanceContext";
import { toast } from "@/hooks/use-toast";

const DirectorAttendance = () => {
  const { user } = useAuth();
  const { batches } = useBatches();
  const { students } = useStudents();
  const { saveAttendance, getByBatchDate } = useAttendance();

  const myBatches = useMemo(
    () => (user ? batches.filter((b) => b.directorId === user.staffId) : []),
    [batches, user],
  );

  const [batchId, setBatchId] = useState<string>(myBatches[0]?.id || "");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [att, setAtt] = useState<Record<string, "Present" | "Absent">>({});

  const batch = myBatches.find((b) => b.id === batchId);
  const batchStudents = students.filter((s) => s.batchId === batch?.id);

  // Load existing for batch+date
  useEffect(() => {
    if (!batch) return;
    const existing = getByBatchDate(batch.id, date).filter((e) => e.source === "Manual");
    const map: Record<string, "Present" | "Absent"> = {};
    batchStudents.forEach((s) => {
      const found = existing.find((e) => e.studentId === s.id);
      map[s.id] = found?.status || "Present";
    });
    setAtt(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, date]);

  const markAll = (status: "Present" | "Absent") => {
    const m: Record<string, "Present" | "Absent"> = {};
    batchStudents.forEach((s) => { m[s.id] = status; });
    setAtt(m);
  };

  const handleSave = () => {
    if (!batch) return;
    saveAttendance(
      batch.id, date,
      batchStudents.map((s) => ({ studentId: s.id, status: att[s.id] || "Present" })),
      "Manual",
    );
    toast({ title: "সংরক্ষিত", description: `${batch.name} - ${date}` });
  };

  if (!user || user.role !== "Batch Director") return <Navigate to="/login" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">ম্যানুয়াল উপস্থিতি</h1>
          <p className="text-sm text-muted-foreground">ব্যাচ ও তারিখ অনুযায়ী উপস্থিতি নিন</p>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            <div>
              <Label>ব্যাচ</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                <SelectContent>
                  {myBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>তারিখ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => markAll("Present")}>সবাই উপস্থিত</Button>
              <Button variant="outline" onClick={() => markAll("Absent")}>সবাই অনুপস্থিত</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-base">শিক্ষার্থী ({batchStudents.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>আইডি</TableHead>
                  <TableHead>নাম</TableHead>
                  <TableHead className="w-[160px] text-center">উপস্থিত / অনুপস্থিত</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">কোনো শিক্ষার্থী নেই</TableCell></TableRow>
                ) : batchStudents.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.studentId}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xs text-muted-foreground">অনুপ.</span>
                        <Switch
                          checked={att[s.id] === "Present"}
                          onCheckedChange={(c) => setAtt((p) => ({ ...p, [s.id]: c ? "Present" : "Absent" }))}
                        />
                        <span className="text-xs text-success font-medium">উপস্থিত</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave}>সংরক্ষণ করুন</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DirectorAttendance;