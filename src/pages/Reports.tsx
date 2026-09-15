import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdmissionReport from "@/components/reports/AdmissionReport";
import FeeCollectionReport from "@/components/reports/FeeCollectionReport";
import DueReport from "@/components/reports/DueReport";
import AttendanceReport from "@/components/reports/AttendanceReport";
import ResultReport from "@/components/reports/ResultReport";
import MaterialDistributionReport from "@/components/reports/MaterialDistributionReport";
import StaffReport from "@/components/reports/StaffReport";
import BranchLedgerReport from "@/components/reports/BranchLedgerReport";

export default function Reports() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">রিপোর্ট সেন্টার</h1>
          <p className="text-sm text-muted-foreground">সব ধরনের রিপোর্ট দেখুন, প্রিন্ট করুন এবং এক্সপোর্ট করুন</p>
        </div>

        <Tabs defaultValue="admission">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="admission">ভর্তি</TabsTrigger>
            <TabsTrigger value="fees">ফি কালেকশন</TabsTrigger>
            <TabsTrigger value="due">বকেয়া</TabsTrigger>
            <TabsTrigger value="attendance">উপস্থিতি</TabsTrigger>
            <TabsTrigger value="result">ফলাফল</TabsTrigger>
            <TabsTrigger value="book">ম্যাটেরিয়াল বিতরণ</TabsTrigger>
            <TabsTrigger value="staff">স্টাফ</TabsTrigger>
            <TabsTrigger value="branch">ব্রাঞ্চ লেজার</TabsTrigger>
          </TabsList>
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