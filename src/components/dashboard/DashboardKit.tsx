import { type ReactNode } from "react";
import { type LucideIcon, Inbox, RefreshCw, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Building blocks shared by every dashboard (Admin, Director, Student,
 * Mess): one section-header style, one panel style, one empty/error/loading
 * treatment, one chart tooltip and one set of formatters, so every
 * dashboard reads as part of the same product.
 */

export function SectionHeader({ title, description, action, icon: Icon }: { title: string; description?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-primary" aria-hidden />}
          {title}
        </h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** A titled panel (chart, list, table). Header is a hairline row, not a second card. */
export function Panel({ title, description, action, children, className, bodyClassName, icon: Icon }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; icon?: LucideIcon }) {
  return (
    <Card className={cn("flex flex-col min-w-0", className)}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold leading-tight">{Icon && <Icon className="h-4 w-4 text-primary" aria-hidden />}{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <CardContent className={cn("flex-1 px-4 pb-4 sm:px-5 sm:pb-5", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}

export function PanelLink({ to, children = "বিস্তারিত" }: { to: string; children?: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-4">
      {children}
      <ArrowRight className="h-3 w-3" aria-hidden />
    </Link>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, compact }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-6" : "py-10")}>
      <span className="rounded-full bg-muted p-3 mb-3"><Icon className="h-5 w-5 text-muted-foreground" aria-hidden /></span>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />আবার চেষ্টা করুন</Button>}
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="flex items-end gap-2" style={{ height }} aria-hidden>
      {[40, 65, 50, 80, 55, 70, 45, 85, 60, 75].map((h, i) => <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />)}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-2.5 w-1/3" /></div></div>
      ))}
    </div>
  );
}

/** Recharts tooltip in the app's own surface/typography — values in text ink, a small colour key beside them. */
export function ChartTooltip({ active, payload, label, format, labelFormat }: { active?: boolean; payload?: { value: number; name?: string; color?: string }[]; label?: string; format: (v: number) => string; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground mb-1">{labelFormat && label ? labelFormat(label) : label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} aria-hidden />
          {p.name && <span>{p.name}:</span>}
          <span className="font-semibold text-foreground tabular-nums">{format(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Ranked single-hue horizontal bars — used instead of pies/donuts for
 * "share by category" (course-wise, method-wise, batch-wise): magnitude is
 * read by length, every bar is direct-labelled, so no colour legend is needed.
 */
export function RankedBars({ rows, format, max, emptyText = "কোনো তথ্য নেই", tone = "primary", onRowClick }: { rows: { key: string; label: string; value: number; sub?: string }[]; format: (v: number) => string; max?: number; emptyText?: string; tone?: "primary" | "success" | "destructive" | "warning" | "neutral"; onRowClick?: (key: string) => void }) {
  if (rows.length === 0) return <EmptyState compact title={emptyText} />;
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  const fill = { primary: "bg-primary", success: "bg-success", destructive: "bg-destructive", warning: "bg-warning", neutral: "bg-foreground/70" }[tone];
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-foreground">{r.label}{r.sub && <span className="text-muted-foreground"> · {r.sub}</span>}</span>
              <span className="shrink-0 font-semibold tabular-nums">{format(r.value)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.max(2, (r.value / top) * 100)}%` }} />
            </div>
          </>
        );
        return (
          <li key={r.key}>
            {onRowClick ? <button type="button" className="w-full text-left rounded-sm hover:bg-muted/50 -mx-1 px-1 py-0.5" onClick={() => onRowClick(r.key)}>{content}</button> : content}
          </li>
        );
      })}
    </ul>
  );
}

/** Two-part meter (part vs. remainder) with both parts direct-labelled — identity is never colour-alone. */
export function SplitMeter({ a, b, format }: { a: { label: string; value: number; className: string }; b: { label: string; value: number; className: string }; format: (v: number) => string }) {
  const total = a.value + b.value;
  const pa = total ? (a.value / total) * 100 : 0;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted gap-[2px]" role="img" aria-label={`${a.label} ${format(a.value)}, ${b.label} ${format(b.value)}`}>
        {a.value > 0 && <div className={cn("h-full", a.className)} style={{ width: `${pa}%` }} />}
        {b.value > 0 && <div className={cn("h-full flex-1", b.className)} />}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-sm", a.className)} aria-hidden />{a.label} <b className="tabular-nums">{format(a.value)}</b>{total ? <span className="text-muted-foreground">({Math.round(pa)}%)</span> : null}</span>
        <span className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-sm", b.className)} aria-hidden />{b.label} <b className="tabular-nums">{format(b.value)}</b>{total ? <span className="text-muted-foreground">({100 - Math.round(pa)}%)</span> : null}</span>
      </div>
    </div>
  );
}
