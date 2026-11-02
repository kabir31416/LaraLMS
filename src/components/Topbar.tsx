import { useEffect, useState } from "react";
import { Bell, ChevronRight, KeyRound, LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { CommandPalette, SearchTrigger } from "@/components/CommandPalette";
import { useAuth } from "@/contexts/AuthContext";
import { breadcrumbFor } from "@/lib/navigation";
import { useLocation, useNavigate } from "react-router-dom";

/** Where the bell goes for each role — only roles that actually have a notice page get one (no decorative unread dot). */
function noticesRouteFor(role?: string): string | null {
  if (role === "Admin") return "/notices";
  if (role === "Student") return "/student/notices";
  return null;
}

export function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl/⌘ + K opens global search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initial = user?.name?.charAt(0) || "অ";
  const roleLabel = user?.role === "Batch Director" ? "ব্যাচ ডিরেক্টর"
    : user?.role === "Student" ? "শিক্ষার্থী"
    : user?.role === "Mess Staff" ? "মেস স্টাফ"
    : user?.isSuperAdmin ? "সুপার অ্যাডমিন"
    : "প্রশাসক";
  const crumb = breadcrumbFor(user, location.pathname);
  const noticesRoute = noticesRouteFor(user?.role);
  // Only Admin logins have a password; portal logins (Director / Student / Mess staff) sign in with phone + ID.
  const hasPassword = user?.role === "Admin";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 flex items-center justify-between gap-3 px-3 sm:px-4 shrink-0 no-print">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-5 hidden sm:block" />
        {crumb && (
          <nav aria-label="breadcrumb" className="flex items-center gap-1.5 min-w-0 text-sm">
            {crumb.group && (
              <>
                <span className="hidden md:inline text-muted-foreground truncate">{crumb.group}</span>
                <ChevronRight className="hidden md:inline h-3.5 w-3.5 text-muted-foreground/60 shrink-0" aria-hidden />
              </>
            )}
            <span className="font-semibold text-foreground truncate" aria-current="page">{crumb.title}</span>
          </nav>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <SearchTrigger onOpen={() => setSearchOpen(true)} />
        {noticesRoute && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => navigate(noticesRoute)} aria-label="নোটিশ">
                <Bell className="h-[18px] w-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>নোটিশ</TooltipContent>
          </Tooltip>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md pl-1 pr-1.5 py-1 hover:bg-muted transition-colors" aria-label="অ্যাকাউন্ট মেনু">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-foreground text-background text-sm font-semibold">{initial}</AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left max-w-[160px]">
                <p className="text-sm font-medium leading-tight truncate">{user?.name || "অ্যাডমিন"}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{roleLabel}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold truncate">{user?.name || "অ্যাডমিন"}</p>
              <p className="text-xs text-muted-foreground truncate">{roleLabel}{user?.identifier ? ` • ${user.identifier}` : ""}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hasPassword && (
              <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                <KeyRound className="mr-2 h-4 w-4" /> পাসওয়ার্ড পরিবর্তন
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> লগআউট
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>পাসওয়ার্ড পরিবর্তন</DialogTitle>
          </DialogHeader>
          <ChangePasswordForm onSuccess={() => setChangePasswordOpen(false)} />
        </DialogContent>
      </Dialog>
    </header>
  );
}
