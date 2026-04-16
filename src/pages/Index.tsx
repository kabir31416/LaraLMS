import { Users, UserPlus, DollarSign, AlertCircle, Package, TrendingUp } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudents } from "@/contexts/StudentContext";
import { format } from "date-fns";

const Index = () => {
  const { students, payments } = useStudents();

  const totalStudents = students.length;
  const today = format(new Date(), "yyyy-MM-dd");
  const todayAdmissions = students.filter((s) => s.admissionDate === today).length;
  const todayCollection = payments.filter((p) => p.date === today).reduce((sum, p) => sum + p.paidAmount, 0);
  const totalDue = students.reduce((sum, s) => sum + s.due, 0);
  const packageDue = students.filter((s) => s.feeType === "এককালীন").reduce((sum, s) => sum + s.due, 0);
  const monthlyDue = students.filter((s) => s.feeType === "মাসিক").reduce((sum, s) => sum + s.due, 0);

  const recentAdmissions = [...students]
    .sort((a, b) => b.admissionDate.localeCompare(a.admissionDate))
    .slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">ড্যাশবোর্ড</h1>
          <p className="text-muted-foreground text-sm">স্বাগতম! আজকের সারসংক্ষেপ দেখুন</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard title="মোট শিক্ষার্থী" value={String(totalStudents)} icon={Users} variant="primary" />
          <StatCard title="আজকের ভর্তি" value={String(todayAdmissions)} icon={UserPlus} variant="success" />
          <StatCard title="আজকের আদায়" value={`৳ ${todayCollection.toLocaleString()}`} icon={DollarSign} variant="info" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="মোট বকেয়া" value={`৳ ${totalDue.toLocaleString()}`} icon={AlertCircle} variant="warning" />
          <StatCard title="প্যাকেজ বকেয়া" value={`৳ ${packageDue.toLocaleString()}`} icon={Package} variant="info" />
          <StatCard title="মাসিক বকেয়া" value={`৳ ${monthlyDue.toLocaleString()}`} icon={TrendingUp} variant="primary" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">সাম্প্রতিক ভর্তি</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recentAdmissions.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.class} — {item.course}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.admissionDate}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">বকেয়া শিক্ষার্থী</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {students.filter((s) => s.due > 0).slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.feeType} — {item.course}</p>
                    </div>
                    <span className="text-xs text-destructive font-semibold">৳ {item.due.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
