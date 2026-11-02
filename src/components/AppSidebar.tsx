import { GraduationCap } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { EXACT_ROOTS, navGroupsFor, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Role-aware, grouped navigation (catalog + visibility rules live in
 * lib/navigation.ts). Light surface, charcoal text, a thin orange bar on the
 * active item. Collapses to icons on desktop (with tooltips) and becomes an
 * off-canvas drawer on mobile that closes itself after navigation.
 */
export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const location = useLocation();
  const { user } = useAuth();
  const groups = navGroupsFor(user);

  const isActive = (item: NavItem) => {
    // Admin's single "মেস / হোস্টেল" entry stays highlighted on every Mess sub-page.
    const exact = EXACT_ROOTS.has(item.url) && !(item.url === "/mess" && user?.role !== "Mess Staff");
    return exact ? location.pathname === item.url : location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 shrink-0 rounded-md bg-sidebar-primary flex items-center justify-center">
            <GraduationCap className="w-[18px] h-[18px] text-sidebar-primary-foreground" aria-hidden />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-tight text-foreground truncate">নিউরন এলএমএস</p>
              <p className="text-[11px] text-muted-foreground leading-tight truncate">কোচিং ম্যানেজমেন্ট সিস্টেম</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2 gap-0">
        {groups.map((group, gi) => (
          <SidebarGroup key={group.label} className={cn("py-1", gi > 0 && "pt-2")}>
            {group.items.length > 1 || groups.length > 1 ? (
              <SidebarGroupLabel className="h-6 px-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">{group.label}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className={cn(
                          "relative h-9 text-[13.5px] text-sidebar-foreground hover:bg-muted hover:text-foreground",
                          "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-semibold",
                          "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-primary before:opacity-0 data-[active=true]:before:opacity-100",
                        )}
                      >
                        <NavLink
                          to={item.url}
                          end={EXACT_ROOTS.has(item.url)}
                          aria-current={active ? "page" : undefined}
                          onClick={() => { if (isMobile) setOpenMobile(false); }}
                        >
                          <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
