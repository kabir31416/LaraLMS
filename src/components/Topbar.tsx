import { Search, Bell, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initial = user?.name?.charAt(0) || "অ";
  const roleLabel = user?.role === "Batch Director" ? "ব্যাচ ডিরেক্টর"
    : user?.role === "Student" ? "শিক্ষার্থী"
    : "প্রশাসক";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="খুঁজুন..."
            className="pl-9 w-64 h-9 bg-muted/50 border-none focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-tight">{user?.name || "অ্যাডমিন"}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="লগআউট">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
