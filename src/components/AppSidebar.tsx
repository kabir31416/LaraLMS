import {
  LayoutDashboard,
  Users,
  UserPlus,
  DollarSign,
  ClipboardCheck,
  CalendarDays,
  FileText,
  Award,
  GraduationCap,
  BookOpen,
  FolderOpen,
  Calculator,
  BarChart3,
  Settings,
  UserCog,
  Layers,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

const adminMenu = [
  { title: "ড্যাশবোর্ড", url: "/", icon: LayoutDashboard },
  { title: "শিক্ষার্থী", url: "/students", icon: Users },
  { title: "ভর্তি", url: "/admission", icon: UserPlus },
  { title: "ফি ম্যানেজমেন্ট", url: "/fees", icon: DollarSign },
  { title: "উপস্থিতি", url: "/attendance", icon: ClipboardCheck },
  { title: "রুটিন", url: "/routine", icon: CalendarDays },
  { title: "পরীক্ষা", url: "/exams", icon: FileText },
  { title: "ফলাফল", url: "/results", icon: Award },
  { title: "স্টাফ", url: "/staff", icon: UserCog },
  { title: "ব্যাচ", url: "/batches", icon: Layers },
  { title: "শিক্ষক", url: "/teachers", icon: GraduationCap },
  { title: "বই", url: "/books", icon: BookOpen },
  { title: "ডকুমেন্ট", url: "/documents", icon: FolderOpen },
  { title: "হিসাব", url: "/accounts", icon: Calculator },
  { title: "রিপোর্ট", url: "/reports", icon: BarChart3 },
  { title: "সেটিংস", url: "/settings", icon: Settings },
];

const directorMenu = [
  { title: "ডিরেক্টর ড্যাশবোর্ড", url: "/director", icon: LayoutDashboard },
  { title: "আমার শিক্ষার্থী", url: "/director/students", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();

  const menuItems = user?.role === "Batch Director" ? directorMenu : adminMenu;

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
                      end={item.url === "/" || item.url === "/director"}
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
    </Sidebar>
  );
}
