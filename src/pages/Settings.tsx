import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SessionsTab } from "@/components/settings/SessionsTab";
import { CoursesTab } from "@/components/settings/CoursesTab";
import { SubjectsTab } from "@/components/settings/SubjectsTab";
import { LecturesTab } from "@/components/settings/LecturesTab";
import { ClassExamsTab } from "@/components/settings/ClassExamsTab";
import { OtherSettingsTab } from "@/components/settings/OtherSettingsTab";
import { PublicInfoTab } from "@/components/settings/PublicInfoTab";

export default function Settings() {
  const [tab, setTab] = useState("sessions");
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">একাডেমিক সেটিংস</h1>
          <p className="text-sm text-muted-foreground">সেশন → কোর্স → সাবজেক্ট → লেকচার → ক্লাস/এক্সাম</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="sessions">সেশন</TabsTrigger>
            <TabsTrigger value="courses">কোর্স</TabsTrigger>
            <TabsTrigger value="subjects">সাবজেক্ট</TabsTrigger>
            <TabsTrigger value="lectures">লেকচার</TabsTrigger>
            <TabsTrigger value="classExams">ক্লাস / এক্সাম</TabsTrigger>
            <TabsTrigger value="publicInfo">পাবলিক তথ্য</TabsTrigger>
            <TabsTrigger value="other">অন্যান্য সেটিংস</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-4"><SessionsTab /></TabsContent>
          <TabsContent value="courses" className="mt-4"><CoursesTab /></TabsContent>
          <TabsContent value="subjects" className="mt-4"><SubjectsTab /></TabsContent>
          <TabsContent value="lectures" className="mt-4"><LecturesTab /></TabsContent>
          <TabsContent value="classExams" className="mt-4"><ClassExamsTab /></TabsContent>
          <TabsContent value="publicInfo" className="mt-4"><PublicInfoTab /></TabsContent>
          <TabsContent value="other" className="mt-4"><OtherSettingsTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
