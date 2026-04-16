import { Users, UserPlus, DollarSign, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { title: "মোট শিক্ষার্থী", value: "১,২৪৫", icon: Users, variant: "primary" as const, trend: "+১২ এই মাসে" },
  { title: "আজকের ভর্তি", value: "৮", icon: UserPlus, variant: "success" as const, trend: "+৩ গতকাল থেকে" },
  { title: "আজকের আদায়", value: "৳ ৩৫,৫০০", icon: DollarSign, variant: "info" as const },
  { title: "বকেয়া ফি", value: "৳ ১,২৫,০০০", icon: AlertCircle, variant: "warning" as const },
];

const recentAdmissions = [
  { name: "রাহাত হোসেন", class: "দশম শ্রেণি", date: "১৬ এপ্রিল ২০২৬" },
  { name: "ফাতেমা আক্তার", class: "নবম শ্রেণি", date: "১৬ এপ্রিল ২০২৬" },
  { name: "আরিফ ইসলাম", class: "অষ্টম শ্রেণি", date: "১৫ এপ্রিল ২০২৬" },
  { name: "সুমাইয়া খান", class: "দশম শ্রেণি", date: "১৫ এপ্রিল ২০২৬" },
  { name: "মেহেদী হাসান", class: "একাদশ শ্রেণি", date: "১৪ এপ্রিল ২০২৬" },
];

const upcomingExams = [
  { subject: "গণিত", class: "দশম শ্রেণি", date: "২০ এপ্রিল ২০২৬" },
  { subject: "পদার্থবিজ্ঞান", class: "একাদশ শ্রেণি", date: "২২ এপ্রিল ২০২৬" },
  { subject: "ইংরেজি", class: "নবম শ্রেণি", date: "২৪ এপ্রিল ২০২৬" },
];

const Index = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">ড্যাশবোর্ড</h1>
          <p className="text-muted-foreground text-sm">স্বাগতম! আজকের সারসংক্ষেপ দেখুন</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">সাম্প্রতিক ভর্তি</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recentAdmissions.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.class}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">আসন্ন পরীক্ষা</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {upcomingExams.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{item.subject}</p>
                      <p className="text-xs text-muted-foreground">{item.class}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.date}</span>
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
