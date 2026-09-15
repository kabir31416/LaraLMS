import {
  LayoutDashboard,
  Users,
  UserPlus,
  DollarSign,
  ClipboardCheck,
  FileText,
  Award,
  GraduationCap,
  BookOpen,
  Calculator,
  Settings,
  UserCog,
  Layers,
  Video,
  ClipboardList,
  Bell,
  BarChart3 as ReportIcon,
  User,
  ListChecks,
  Phone,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { DEVELOPER_INFO } from "@/config/developerInfo";

const adminMenu = [
  { title: "ড্যাশবোর্ড", url: "/", icon: LayoutDashboard },
  { title: "শিক্ষার্থী", url: "/students", icon: Users },
  { title: "ভর্তি", url: "/admission", icon: UserPlus },
  { title: "অ্যাডমিশন রেজাল্ট", url: "/admission-result", icon: ListChecks },
  { title: "ফি ম্যানেজমেন্ট", url: "/fees", icon: DollarSign },
  { title: "উপস্থিতি", url: "/attendance", icon: ClipboardCheck },
  { title: "এক্সাম", url: "/exams", icon: FileText },
  { title: "ভিডিও ক্লাস", url: "/videos", icon: Video },
  { title: "নোটিশ", url: "/notices", icon: Bell },
  { title: "রিপোর্ট", url: "/reports", icon: ReportIcon },
  { title: "স্টাফ", url: "/staff", icon: UserCog },
  { title: "ব্যাচ", url: "/batches", icon: Layers },
  { title: "ম্যাটেরিয়াল", url: "/books", icon: BookOpen },
  { title: "হিসাব", url: "/accounts", icon: Calculator },
  { title: "সেটিংস", url: "/settings", icon: Settings },
];

const directorMenu = [
  { title: "ডিরেক্টর ড্যাশবোর্ড", url: "/director", icon: LayoutDashboard },
  { title: "আমার শিক্ষার্থী", url: "/director/students", icon: Users },
  // Marks and attendance are both entered together here now — there's no separate attendance page for directors anymore.
  { title: "রেজাল্ট এন্ট্রি", url: "/director/results", icon: ClipboardList },
  { title: "অ্যাডমিশন রেজাল্ট", url: "/director/admission-result", icon: ListChecks },
  { title: "এক্সাম", url: "/exams", icon: FileText },
  { title: "ভিডিও ক্লাস", url: "/videos", icon: Video },
];

const studentMenu = [
  { title: "ড্যাশবোর্ড", url: "/student", icon: LayoutDashboard },
  { title: "প্রোফাইল", url: "/student/profile", icon: User },
  { title: "উপস্থিতি", url: "/student/attendance", icon: ClipboardCheck },
  { title: "ফলাফল", url: "/student/results", icon: Award },
  { title: "পেমেন্ট", url: "/student/payments", icon: DollarSign },
  { title: "ম্যাটেরিয়াল", url: "/student/books", icon: BookOpen },
  { title: "নোটিশ", url: "/student/notices", icon: Bell },
  { title: "ভিডিও ক্লাস", url: "/student/videos", icon: Video },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();

  const menuItems = user?.role === "Batch Director" ? directorMenu
    : user?.role === "Student" ? studentMenu
    : adminMenu;
  const isAdmin = menuItems === adminMenu;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-base font-bold text-sidebar-primary-foreground leading-tight">
                লারা এলএমএস
              </h1>
              <p className="text-xs text-sidebar-foreground/60">কোচিং ম্যানেজমেন্ট</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/" || item.url === "/director" || item.url === "/student"}
                      className="hover:bg-sidebar-accent/50 transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/*
        Fixed, non-scrolling footer (SidebarContent above is the only
        `flex-1 overflow-auto` region in this layout, so a sibling
        SidebarFooter always stays pinned below it — see sidebar.tsx). Admin
        only. Content is 100% from DEVELOPER_INFO (source-level constants,
        never Settings/DB-backed) — no Admin action can edit, hide, or
        remove it. Kept to just product name / developer / phone, no
        social links.
      */}
      {isAdmin && !collapsed && (
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div className="space-y-1">
            <p className="text-sm font-bold text-sidebar-primary-foreground">{DEVELOPER_INFO.productName}</p>
            <p className="text-xs text-sidebar-foreground/60">
              Developed by <span className="font-medium text-sidebar-foreground/90">{DEVELOPER_INFO.developerName}</span>
            </p>
            <a
              href={`tel:${DEVELOPER_INFO.phone}`}
              className="flex items-center gap-1.5 text-xs text-sidebar-foreground/70 hover:text-sidebar-primary-foreground transition-colors"
            >
              <Phone className="h-3 w-3 shrink-0" /> {DEVELOPER_INFO.phone}
            </a>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
