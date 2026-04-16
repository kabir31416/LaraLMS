import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Users, TrendingUp } from "lucide-react";
import { useStudents } from "@/contexts/StudentContext";
import { AdmissionForm } from "@/components/students/AdmissionForm";
import { StatCard } from "@/components/StatCard";

const Admission = () => {
  const { students } = useStudents();
  const [formOpen, setFormOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const todayAdmissions = students.filter((s) => s.admissionDate === today);
  const newStudents = students.filter((s) => s.admissionType === "নতুন");
  const oldStudents = students.filter((s) => s.admissionType === "পুরাতন");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ভর্তি</h1>
            <p className="text-sm text-muted-foreground">নতুন শিক্ষার্থী ভর্তি করুন</p>
          </div>
          <Button onClick={() => setFormOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> নতুন ভর্তি
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="আজকের ভর্তি" value={String(todayAdmissions.length)} icon={UserPlus} variant="success" />
          <StatCard title="নতুন শিক্ষার্থী" value={String(newStudents.length)} icon={Users} variant="primary" />
          <StatCard title="পুরাতন শিক্ষার্থী" value={String(oldStudents.length)} icon={TrendingUp} variant="info" />
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">সাম্প্রতিক ভর্তি</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {students.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.studentId} • {s.class} • {s.course}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{s.admissionDate}</p>
                    <p className="text-xs font-medium">{s.admissionType}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <AdmissionForm open={formOpen} onOpenChange={setFormOpen} />
      </div>
    </DashboardLayout>
  );
};

export default Admission;
