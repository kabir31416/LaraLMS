import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileBarChart, UserPlus, Wallet, AlertCircle, CalendarCheck, GraduationCap, Package, Users, Building2 } from "lucide-react";
import AdmissionReport from "@/components/reports/AdmissionReport";
import FeeCollectionReport from "@/components/reports/FeeCollectionReport";
import DueReport from "@/components/reports/DueReport";
import AttendanceReport from "@/components/reports/AttendanceReport";
import ResultReport from "@/components/reports/ResultReport";
import MaterialDistributionReport from "@/components/reports/MaterialDistributionReport";
import StaffReport from "@/components/reports/StaffReport";
import BranchLedgerReport from "@/components/reports/BranchLedgerReport";

const TABS = [
  { value: "admission", label: "ভর্তি", icon: UserPlus },
  { value: "fees", label: "ফি কালেকশন", icon: Wallet },
  { value: "due", label: "বকেয়া", icon: AlertCircle },
  { value: "attendance", label: "উপস্থিতি", icon: CalendarCheck },
  { value: "result", label: "ফলাফল", icon: GraduationCap },
  { value: "book", label: "ম্যাটেরিয়াল বিতরণ", icon: Package },
  { value: "staff", label: "স্টাফ", icon: Users },
  { value: "branch", label: "ব্রাঞ্চ লেজার", icon: Building2 },
] as const;

export default function Reports() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileBarChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">রিপোর্ট সেন্টার</h1>
            <p className="text-sm text-muted-foreground">সব ধরনের রিপোর্ট দেখুন, প্রিন্ট করুন এবং এক্সপোর্ট করুন</p>
          </div>
        </div>

        <Tabs defaultValue="admission">
          {/* A horizontally-scrolling single row reads cleaner on a phone than
              wrapping 8 tabs across several lines, and needs no extra state —
              the browser handles the scroll natively. */}
          <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <TabsList className="inline-flex w-max h-auto gap-1 bg-card border p-1">
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="gap-1.5 whitespace-nowrap">
                  <Icon className="h-4 w-4" /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="admission" className="pt-4"><AdmissionReport /></TabsContent>
          <TabsContent value="fees" className="pt-4"><FeeCollectionReport /></TabsContent>
          <TabsContent value="due" className="pt-4"><DueReport /></TabsContent>
          <TabsContent value="attendance" className="pt-4"><AttendanceReport /></TabsContent>
          <TabsContent value="result" className="pt-4"><ResultReport /></TabsContent>
          <TabsContent value="book" className="pt-4"><MaterialDistributionReport /></TabsContent>
          <TabsContent value="staff" className="pt-4"><StaffReport /></TabsContent>
          <TabsContent value="branch" className="pt-4"><BranchLedgerReport /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}