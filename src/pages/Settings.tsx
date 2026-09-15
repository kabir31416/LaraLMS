import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAcademic } from "@/contexts/AcademicContext";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";
import { SessionsTab } from "@/components/settings/SessionsTab";
import { CoursesTab } from "@/components/settings/CoursesTab";
import { SubjectsTab } from "@/components/settings/SubjectsTab";
import { LecturesTab } from "@/components/settings/LecturesTab";
import { ClassExamsTab } from "@/components/settings/ClassExamsTab";
import { PublicInfoTab } from "@/components/settings/PublicInfoTab";
import { PublicMarksheetTab } from "@/components/settings/PublicMarksheetTab";
import { InstitutionTab } from "@/components/settings/InstitutionTab";
import { FinanceTab } from "@/components/settings/FinanceTab";
import { ResultSettingsTab } from "@/components/settings/ResultSettingsTab";
import { StudentSettingsTab } from "@/components/settings/StudentSettingsTab";
import { AuditLogTab } from "@/components/settings/AuditLogTab";

/**
 * Settings — the ERP's central configuration/master-data hub. Grouped into
 * Master Data (একাডেমিক/ফিন্যান্স's payment methods) and System Configuration
 * (প্রতিষ্ঠান/শিক্ষার্থী/ফলাফল/পাবলিক/অডিট) sections behind a left-hand
 * category nav, per the "don't make one giant settings page" requirement.
 */
type Section = "institution" | "academic" | "student" | "result" | "finance" | "classExams" | "public" | "audit";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "institution", label: "প্রতিষ্ঠান" },
  { key: "academic", label: "একাডেমিক" },
  { key: "student", label: "শিক্ষার্থী" },
  { key: "result", label: "ফলাফল" },
  { key: "finance", label: "ফিন্যান্স" },
  { key: "classExams", label: "ক্লাস / এক্সাম" },
  { key: "public", label: "পাবলিক" },
  { key: "audit", label: "অডিট লগ" },
];

function DefaultSessionPicker() {
  const { sessions, settings, updateSettings } = useAcademic();
  const save = async (defaultSessionId: string) => {
    try {
      await updateSettings({ defaultSessionId });
      toast.success("সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    }
  };
  return (
    <Card className="border-none shadow-sm max-w-md">
      <CardContent className="pt-6">
        <Label>ডিফল্ট সেশন</Label>
        <Select value={settings.defaultSessionId || ""} onValueChange={save}>
          <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
          <SelectContent>{sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const [section, setSection] = useState<Section>("institution");
  const [academicTab, setAcademicTab] = useState("sessions");
  const [publicTab, setPublicTab] = useState("info");
  const [subjectCourseFilter, setSubjectCourseFilter] = useState<string | undefined>(undefined);

  const openSubjectsForCourse = (courseId: string) => {
    setSubjectCourseFilter(courseId);
    setAcademicTab("subjects");
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">সেটিংস</h1>
          <p className="text-sm text-muted-foreground">প্রতিষ্ঠানের সকল রিইউজেবল মাস্টার ডেটা ও গ্লোবাল কনফিগারেশনের কেন্দ্রীয় স্থান</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:w-[200px] shrink-0">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={cn(
                  "text-left px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  section === s.key ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 min-w-0">
            {section === "institution" && <InstitutionTab />}
            {section === "student" && <StudentSettingsTab />}
            {section === "result" && <ResultSettingsTab />}
            {section === "finance" && <FinanceTab />}
            {section === "classExams" && <ClassExamsTab />}
            {section === "audit" && <AuditLogTab />}

            {section === "academic" && (
              <div className="space-y-4">
              <DefaultSessionPicker />
              <Tabs value={academicTab} onValueChange={setAcademicTab}>
                <TabsList className="flex flex-wrap h-auto">
                  <TabsTrigger value="sessions">সেশন</TabsTrigger>
                  <TabsTrigger value="courses">কোর্স</TabsTrigger>
                  <TabsTrigger value="subjects">সাবজেক্ট</TabsTrigger>
                  <TabsTrigger value="lectures">লেকচার</TabsTrigger>
                </TabsList>
                <TabsContent value="sessions" className="mt-4"><SessionsTab /></TabsContent>
                <TabsContent value="courses" className="mt-4"><CoursesTab onManageSubjects={openSubjectsForCourse} /></TabsContent>
                <TabsContent value="subjects" className="mt-4"><SubjectsTab initialCourseFilter={subjectCourseFilter} /></TabsContent>
                <TabsContent value="lectures" className="mt-4"><LecturesTab /></TabsContent>
              </Tabs>
              </div>
            )}

            {section === "public" && (
              <Tabs value={publicTab} onValueChange={setPublicTab}>
                <TabsList>
                  <TabsTrigger value="info">পাবলিক তথ্য</TabsTrigger>
                  <TabsTrigger value="marksheet">পাবলিক মার্কশিট</TabsTrigger>
                </TabsList>
                <TabsContent value="info" className="mt-4"><PublicInfoTab /></TabsContent>
                <TabsContent value="marksheet" className="mt-4"><PublicMarksheetTab /></TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
