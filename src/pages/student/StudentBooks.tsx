import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import type { StudentMaterialHistoryRow } from "@/types/material";
import { useStudentSelf } from "./useStudentSelf";
import { Navigate } from "react-router-dom";

export default function StudentBooks() {
  const { user, student } = useStudentSelf();
  const [rows, setRows] = useState<StudentMaterialHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!student) return;
    api.get<StudentMaterialHistoryRow[]>(`/materials/students/${student.id}/history`)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [student]);

  if (!user || user.role !== "Student") return <Navigate to="/login" replace />;
  if (!student) return <DashboardLayout><p className="p-6">শিক্ষার্থী পাওয়া যায়নি</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">আমার ম্যাটেরিয়াল</h1>
        <Card>
          <CardHeader><CardTitle className="text-base">বিতরণ ইতিহাস</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>তারিখ</TableHead>
                  <TableHead>ম্যাটেরিয়াল</TableHead>
                  <TableHead>টাইপ</TableHead>
                  <TableHead>পরিমাণ</TableHead>
                  <TableHead>Free/Paid</TableHead>
                  <TableHead>মূল্য</TableHead>
                  <TableHead>বিতরণকারী</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">কোনো ম্যাটেরিয়াল বিতরণ করা হয়নি</TableCell></TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell className="font-medium">{r.materialName}</TableCell>
                      <TableCell><Badge variant="outline">{r.materialType}</Badge></TableCell>
                      <TableCell>{r.quantity}</TableCell>
                      <TableCell>{r.isPaid ? "Paid" : "Free"}</TableCell>
                      <TableCell>{r.isPaid ? `৳ ${r.lineTotal}` : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.distributedBy}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
