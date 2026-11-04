import { useEffect, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowLeft, FileText, Globe, GraduationCap, LogIn, MapPin, Phone, Search, UserPen, type LucideIcon } from "lucide-react";
import { usePublicInstitution } from "@/lib/publicInstitution";
import { cn } from "@/lib/utils";

/**
 * Shared shell for the public, no-login pages (/info, /info/search,
 * /marksheet, /studententry): institution header with section navigation,
 * a page hero, and a footer with public contact details. Only the public
 * /public/institution branding is read here.
 */
const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/info/search", label: "তথ্য অনুসন্ধান", icon: Search },
  { to: "/marksheet", label: "মার্কশিট", icon: FileText },
  { to: "/studententry", label: "তথ্য পূরণ", icon: UserPen },
];

export function PublicShell({
  title,
  description,
  icon: Icon,
  back,
  children,
  width = "md",
  heroExtra,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  back?: { to: string; label: string };
  children: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  heroExtra?: ReactNode;
}) {
  const institution = usePublicInstitution();
  const name = institution?.name || "LaraLMS";
  useEffect(() => { document.title = `${title} — ${name}`; }, [title, name]);
  const max = { sm: "max-w-md", md: "max-w-3xl", lg: "max-w-5xl", xl: "max-w-7xl" }[width];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link to="/info" className="flex min-w-0 items-center gap-2.5" aria-label={`${name} — শিক্ষার্থী তথ্য কেন্দ্র`}>
            {institution?.logoUrl ? (
              <img src={institution.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="h-5 w-5" aria-hidden /></span>
            )}
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold sm:text-base">{name}</span>
              <span className="block text-[11px] text-muted-foreground">শিক্ষার্থী তথ্য কেন্দ্র</span>
            </span>
          </Link>
          <nav aria-label="পাবলিক পেজ" className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn("inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors", isActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <n.icon className="h-4 w-4" aria-hidden />{n.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/" className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary md:ml-2">
            <LogIn className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">লগইন</span>
          </Link>
        </div>
        {/* Mobile section nav */}
        <nav aria-label="পাবলিক পেজ" className="flex gap-1 overflow-x-auto border-t px-3 py-1.5 md:hidden">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => cn("inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors", isActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground")}>
              <n.icon className="h-3.5 w-3.5" aria-hidden />{n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b bg-card">
          <div aria-hidden className="absolute inset-0 opacity-60 [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
          <div className={cn("relative mx-auto px-4 py-7 sm:px-6 sm:py-10", max)}>
            {back && (
              <Link to={back.to} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary">
                <ArrowLeft className="h-4 w-4" aria-hidden />{back.label}
              </Link>
            )}
            <div className="flex items-start gap-3 sm:gap-4">
              {Icon && <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:h-12 sm:w-12"><Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden /></span>}
              <div className="min-w-0">
                <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
                {description && <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p>}
              </div>
            </div>
            {heroExtra}
          </div>
        </section>
        <div className={cn("mx-auto space-y-4 px-4 py-6 sm:px-6 sm:py-8", max)}>{children}</div>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <p className="font-medium text-foreground">{name}</p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {institution?.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{institution.address}</span>}
              {institution?.phone && <a href={`tel:${institution.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="h-3.5 w-3.5" aria-hidden />{institution.phone}</a>}
              {institution?.website && <a href={institution.website.startsWith("http") ? institution.website : `https://${institution.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><Globe className="h-3.5 w-3.5" aria-hidden />{institution.website}</a>}
            </p>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} {name} • Powered by LaraLMS</p>
        </div>
      </footer>
    </div>
  );
}

/** Standard card surface for the public pages. */
export function PublicCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card p-4 shadow-sm sm:p-6", className)}>{children}</div>;
}

/** Inline status block (empty / error / info) with an icon. */
export function PublicNotice({ icon: Icon, title, description, tone = "muted", action }: { icon: LucideIcon; title: string; description?: string; tone?: "muted" | "error" | "warning" | "success"; action?: ReactNode }) {
  const tones = {
    muted: "border-border bg-card text-muted-foreground",
    error: "border-destructive/25 bg-destructive/5 text-destructive",
    warning: "border-warning/30 bg-warning/10 text-warning",
    success: "border-success/25 bg-success/10 text-success",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex flex-col items-center gap-2 rounded-xl border px-4 py-10 text-center", tones)}>
      <Icon className="h-9 w-9 opacity-70" aria-hidden />
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
