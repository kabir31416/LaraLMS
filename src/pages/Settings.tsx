import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Award, BedDouble, BookOpen, Building2, ChevronRight, ClipboardList, Globe, History, MessageSquare, Package, Search, ShieldCheck,
  UserRound, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/dashboard/DashboardKit";
import { cn } from "@/lib/utils";
import { useAcademic } from "@/contexts/AcademicContext";
import { ApiClientError, hasPermission, useAuth } from "@/contexts/AuthContext";
import {
  MESS_SETTINGS_MANAGE, PAYMENT_METHODS_MANAGE, PUBLIC_INFO_MANAGE, PUBLIC_RESULTS_MANAGE, SETTINGS_MANAGE, SMS_MANAGE, STAFF_MANAGE,
} from "@/lib/permissions";
import { UnsavedChangesContext } from "@/components/settings/unsavedChanges";
import { SessionsTab } from "@/components/settings/SessionsTab";
import { CoursesTab } from "@/components/settings/CoursesTab";
import { SubjectsTab } from "@/components/settings/SubjectsTab";
import { LecturesTab } from "@/components/settings/LecturesTab";
import { ClassExamsTab } from "@/components/settings/ClassExamsTab";
import { PublicInfoTab } from "@/components/settings/PublicInfoTab";
import { PublicMarksheetTab } from "@/components/settings/PublicMarksheetTab";
import { InstitutionTab } from "@/components/settings/InstitutionTab";
import { FinanceTab } from "@/components/settings/FinanceTab";
import { MaterialsTab } from "@/components/settings/MaterialsTab";
import { ResultSettingsTab } from "@/components/settings/ResultSettingsTab";
import { StudentSettingsTab } from "@/components/settings/StudentSettingsTab";
import { AuditLogTab } from "@/components/settings/AuditLogTab";
import { SmsSettingsTab } from "@/components/settings/SmsSettingsTab";

/**
 * Smart Settings — the same settings tabs/APIs as before, organised into
 * searchable, permission-aware categories with URL state (?section=) and an
 * unsaved-changes guard. Categories only list settings that actually exist.
 * Visibility here is convenience: every save is still authorised by the
 * backend (requirePermission on each settings route).
 */
type Section = "institution" | "academic" | "student" | "result" | "finance" | "materials" | "classExams" | "public" | "sms" | "audit";

// Backend permission keys that have no frontend constant yet (backend/src/modules/rbac/permissions.ts).
const SESSIONS_MANAGE = "sessions:manage";
const COURSES_MANAGE = "courses:manage";
const SUBJECTS_MANAGE = "subjects:manage";
const LECTURES_MANAGE = "lectures:manage";
const MATERIAL_TYPES_MANAGE = "material-types:manage";
const AUDIT_READ = "audit:read";

interface SectionDef {
  key: Section;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "core" | "academic" | "operations" | "system";
  /** Any one of these lets the user open the category (the API re-checks on every save). */
  perms: string[];
  keywords: string;
}

const GROUPS: { key: SectionDef["group"]; label: string }[] = [
  { key: "core", label: "প্রতিষ্ঠান ও শিক্ষার্থী" },
  { key: "academic", label: "একাডেমিক ও ফলাফল" },
  { key: "operations", label: "ফিন্যান্স ও অপারেশন" },
  { key: "system", label: "যোগাযোগ, পাবলিক ও নিরাপত্তা" },
];

const SECTIONS: SectionDef[] = [
  { key: "institution", label: "প্রতিষ্ঠান", description: "নাম, লোগো, যোগাযোগ, রসিদ ও প্রিন্ট সেটিংস", icon: Building2, group: "core", perms: [SETTINGS_MANAGE], keywords: "institution name logo address phone email website receipt print branding timezone currency ঠিকানা লোগো রসিদ প্রিন্ট" },
  { key: "student", label: "শিক্ষার্থী", description: "সিস্টেম আইডি প্রিফিক্স ও রোল নম্বরের নিয়ম", icon: UserRound, group: "core", perms: [SETTINGS_MANAGE], keywords: "student id prefix roll রোল আইডি প্রিফিক্স" },
  { key: "academic", label: "একাডেমিক", description: "ডিফল্ট সেশন, সেশন, কোর্স, সাবজেক্ট ও লেকচার", icon: BookOpen, group: "academic", perms: [SETTINGS_MANAGE, SESSIONS_MANAGE, COURSES_MANAGE, SUBJECTS_MANAGE, LECTURES_MANAGE], keywords: "session course subject lecture default সেশন কোর্স সাবজেক্ট লেকচার" },
  { key: "result", label: "ফলাফল", description: "পাসিং পার্সেন্টেজ, গ্রেড স্কেল, এক্সামের সময়কাল ও অ্যানালিটিক্সের নিয়ম", icon: Award, group: "academic", perms: [SETTINGS_MANAGE], keywords: "result grade pass percentage exam duration analytics performance risk attendance threshold গ্রেড পাস অ্যানালিটিক্স ঝুঁকি" },
  { key: "classExams", label: "ক্লাস / এক্সাম", description: "ক্লাস ও এক্সামের তালিকা", icon: ClipboardList, group: "academic", perms: [SETTINGS_MANAGE], keywords: "class exam ক্লাস এক্সাম" },
  { key: "finance", label: "ফিন্যান্স", description: "ভর্তি ফি ও পেমেন্ট মাধ্যম", icon: Wallet, group: "operations", perms: [SETTINGS_MANAGE, PAYMENT_METHODS_MANAGE], keywords: "finance admission fee payment method bkash nagad cash ভর্তি ফি পেমেন্ট" },
  { key: "materials", label: "ম্যাটেরিয়াল", description: "ম্যাটেরিয়াল টাইপ, ডুপ্লিকেট বিতরণ নিয়ম ও মিনিমাম স্টক", icon: Package, group: "operations", perms: [SETTINGS_MANAGE, MATERIAL_TYPES_MANAGE], keywords: "material type stock distribution ম্যাটেরিয়াল স্টক বিতরণ" },
  { key: "sms", label: "SMS", description: "প্রোভাইডার, সেন্ডার আইডি, ইভেন্ট ও টেমপ্লেট", icon: MessageSquare, group: "system", perms: [SMS_MANAGE], keywords: "sms provider sender api key template balance এসএমএস টেমপ্লেট" },
  { key: "public", label: "পাবলিক", description: "পাবলিক তথ্য অনুসন্ধান ও পাবলিক মার্কশিট", icon: Globe, group: "system", perms: [SETTINGS_MANAGE, PUBLIC_INFO_MANAGE, PUBLIC_RESULTS_MANAGE], keywords: "public info marksheet পাবলিক মার্কশিট তথ্য" },
  { key: "audit", label: "অডিট লগ", description: "কে কখন কী পরিবর্তন করেছে — শুধু দেখার জন্য", icon: History, group: "system", perms: [SETTINGS_MANAGE, AUDIT_READ], keywords: "audit log history change অডিট ইতিহাস" },
];

/** Settings that live on their own pages — linked, not duplicated. */
const RELATED: { to: string; label: string; description: string; icon: LucideIcon; perms: string[]; keywords: string }[] = [
  { to: "/mess/settings", label: "মেস সেটিংস", description: "বিল তৈরির দিন, ডাইনিং চার্জ, জরিমানা ও মেস SMS", icon: BedDouble, perms: [MESS_SETTINGS_MANAGE], keywords: "mess hostel dining rent মেস হোস্টেল" },
  { to: "/staff", label: "স্টাফ ও অ্যাক্সেস", description: "স্টাফ, রোল ও এডমিনের মডিউল অ্যাক্সেস", icon: Users, perms: [STAFF_MANAGE], keywords: "staff role permission access স্টাফ রোল অ্যাক্সেস" },
];

const SECTION_KEYS = new Set<string>(SECTIONS.map((s) => s.key));

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
    <Card className="max-w-md">
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
  const { user } = useAuth();
  const can = useCallback((perms: string[]) => perms.some((p) => hasPermission(user, p)), [user]);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [academicTab, setAcademicTab] = useState("sessions");
  const [publicTab, setPublicTab] = useState(() => (can([SETTINGS_MANAGE, PUBLIC_INFO_MANAGE]) ? "info" : "marksheet"));

  const allowed = useMemo(() => SECTIONS.filter((s) => can(s.perms)), [can]);
  const related = useMemo(() => RELATED.filter((r) => can(r.perms)), [can]);
  const raw = params.get("section");
  const section = raw && SECTION_KEYS.has(raw) && allowed.some((s) => s.key === raw) ? (raw as Section) : null;
  const current = section ? SECTIONS.find((s) => s.key === section)! : null;

  // ---- unsaved-changes guard ----
  const [dirty, setDirtyMap] = useState<Record<string, boolean>>({});
  const reportDirty = useCallback((key: string, isDirty: boolean) => {
    setDirtyMap((m) => (Boolean(m[key]) === isDirty ? m : { ...m, [key]: isDirty }));
  }, []);
  const hasUnsaved = Object.values(dirty).some(Boolean);
  useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);
  const [pending, setPending] = useState<Section | "overview" | null>(null);
  const go = (next: Section | "overview") => {
    if (next === (section ?? "overview")) return;
    if (hasUnsaved) { setPending(next); return; }
    apply(next);
  };
  const apply = (next: Section | "overview") => {
    setDirtyMap({});
    setParams(next === "overview" ? {} : { section: next });
    window.scrollTo({ top: 0 });
  };

  const q = query.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  const visibleSections = allowed.filter((s) => matches(`${s.label} ${s.description} ${s.keywords}`));
  const visibleRelated = related.filter((r) => matches(`${r.label} ${r.description} ${r.keywords}`));

  const searchBox = (
    <div className="relative w-full sm:max-w-xs">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="সেটিং খুঁজুন (যেমন: লোগো, গ্রেড, SMS)" className="pl-9" aria-label="সেটিং খুঁজুন" />
    </div>
  );

  return (
    <DashboardLayout>
      <UnsavedChangesContext.Provider value={reportDirty}>
        <div className="space-y-5">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              {current ? (
                <button type="button" onClick={() => go("overview")} className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                  <ArrowLeft className="h-4 w-4" aria-hidden />সব সেটিংস
                </button>
              ) : null}
              <h1 className="text-2xl font-bold sm:text-3xl">{current ? current.label : "সেটিংস"}</h1>
              <p className="text-sm text-muted-foreground">{current ? current.description : "প্রতিষ্ঠানের মাস্টার ডেটা ও কনফিগারেশন — বিভাগ বেছে নিন বা খুঁজুন"}</p>
            </div>
            {!current && searchBox}
          </header>

          {allowed.length === 0 && related.length === 0 ? (
            <Card><EmptyState icon={ShieldCheck} title="কোনো সেটিং দেখার অনুমতি নেই" description="প্রয়োজনে সুপার অ্যাডমিনের কাছে অ্যাক্সেস চান।" /></Card>
          ) : !current ? (
            <Overview groups={GROUPS} sections={visibleSections} related={visibleRelated} onOpen={go} query={q} />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <nav aria-label="সেটিংস বিভাগ" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
                {allowed.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => go(s.key)}
                    aria-current={s.key === section ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      s.key === section ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <s.icon className="h-4 w-4 shrink-0" aria-hidden />{s.label}
                  </button>
                ))}
                {related.length > 0 && <div className="hidden px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:block">অন্য পেজে</div>}
                {related.map((r) => (
                  <Link key={r.to} to={r.to} className="hidden items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground lg:flex">
                    <r.icon className="h-4 w-4" aria-hidden />{r.label}<ArrowRight className="ml-auto h-3.5 w-3.5" aria-hidden />
                  </Link>
                ))}
              </nav>

              <div className="min-w-0">
                {section === "institution" && <InstitutionTab />}
                {section === "student" && <StudentSettingsTab />}
                {section === "result" && <ResultSettingsTab />}
                {section === "finance" && <FinanceTab />}
                {section === "materials" && <MaterialsTab />}
                {section === "classExams" && <ClassExamsTab />}
                {section === "sms" && <SmsSettingsTab />}
                {section === "audit" && <AuditLogTab />}

                {section === "academic" && (
                  <div className="space-y-4">
                    {can([SETTINGS_MANAGE]) && <DefaultSessionPicker />}
                    <Tabs value={academicTab} onValueChange={setAcademicTab}>
                      <TabsList className="flex h-auto flex-wrap justify-start">
                        <TabsTrigger value="sessions">সেশন</TabsTrigger>
                        <TabsTrigger value="courses">কোর্স</TabsTrigger>
                        <TabsTrigger value="subjects">সাবজেক্ট</TabsTrigger>
                        <TabsTrigger value="lectures">লেকচার</TabsTrigger>
                      </TabsList>
                      <TabsContent value="sessions" className="mt-4"><SessionsTab /></TabsContent>
                      <TabsContent value="courses" className="mt-4"><CoursesTab onManageSubjects={() => setAcademicTab("subjects")} /></TabsContent>
                      <TabsContent value="subjects" className="mt-4"><SubjectsTab /></TabsContent>
                      <TabsContent value="lectures" className="mt-4"><LecturesTab /></TabsContent>
                    </Tabs>
                  </div>
                )}

                {section === "public" && (
                  <Tabs value={publicTab} onValueChange={setPublicTab}>
                    <TabsList>
                      {can([SETTINGS_MANAGE, PUBLIC_INFO_MANAGE]) && <TabsTrigger value="info">পাবলিক তথ্য</TabsTrigger>}
                      {can([SETTINGS_MANAGE, PUBLIC_RESULTS_MANAGE]) && <TabsTrigger value="marksheet">পাবলিক মার্কশিট</TabsTrigger>}
                    </TabsList>
                    {can([SETTINGS_MANAGE, PUBLIC_INFO_MANAGE]) && <TabsContent value="info" className="mt-4"><PublicInfoTab /></TabsContent>}
                    {can([SETTINGS_MANAGE, PUBLIC_RESULTS_MANAGE]) && <TabsContent value="marksheet" className="mt-4"><PublicMarksheetTab /></TabsContent>}
                  </Tabs>
                )}
              </div>
            </div>
          )}
        </div>

        <AlertDialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>পরিবর্তন সংরক্ষণ করা হয়নি</AlertDialogTitle>
              <AlertDialogDescription>এই পেজে সংরক্ষণ না করা পরিবর্তন আছে। ছেড়ে গেলে সেগুলো হারিয়ে যাবে।</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>থাকুন</AlertDialogCancel>
              <AlertDialogAction onClick={() => { const next = pending!; setPending(null); apply(next); }}>সংরক্ষণ ছাড়াই যান</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </UnsavedChangesContext.Provider>
    </DashboardLayout>
  );
}

function Overview({ groups, sections, related, onOpen, query }: {
  groups: typeof GROUPS; sections: SectionDef[]; related: typeof RELATED; onOpen: (s: Section) => void; query: string;
}) {
  if (sections.length === 0 && related.length === 0) {
    return <Card><EmptyState icon={Search} title={`"${query}" — কোনো সেটিং পাওয়া যায়নি`} description="অন্য শব্দ দিয়ে খুঁজে দেখুন (বাংলা বা ইংরেজি)।" /></Card>;
  }
  const tile = "group flex h-full items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const items = sections.filter((s) => s.group === g.key);
        if (!items.length) return null;
        return (
          <section key={g.key} aria-labelledby={`grp-${g.key}`}>
            <h2 id={`grp-${g.key}`} className="mb-2 text-sm font-semibold text-muted-foreground">{g.label}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((s) => (
                <button key={s.key} type="button" onClick={() => onOpen(s.key)} className={tile}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><s.icon className="h-5 w-5" aria-hidden /></span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{s.label}</span><span className="block text-sm text-muted-foreground">{s.description}</span></span>
                  <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {related.length > 0 && (
        <section aria-labelledby="grp-related">
          <h2 id="grp-related" className="mb-2 text-sm font-semibold text-muted-foreground">অন্য পেজের সেটিংস</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {related.map((r) => (
              <Link key={r.to} to={r.to} className={tile}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"><r.icon className="h-5 w-5" aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{r.label}</span><span className="block text-sm text-muted-foreground">{r.description}</span></span>
                <ArrowRight className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
