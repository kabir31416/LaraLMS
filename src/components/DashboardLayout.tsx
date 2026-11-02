import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Topbar } from "@/components/Topbar";

/**
 * App shell for every signed-in page. The content column is capped at a
 * readable width on very large screens (1920px+) and keeps a consistent
 * gutter on phones; `min-w-0` lets wide tables scroll inside their own
 * container instead of pushing the page into horizontal overflow.
 */
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 min-w-0 overflow-x-hidden px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
            <div className="mx-auto w-full max-w-[1600px] min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
