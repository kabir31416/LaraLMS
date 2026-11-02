import { ArrowDownRight, ArrowUpRight, LucideIcon, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * A comparison against a previous period. Only pass one when both figures
 * come from real data — `null` previous values render no delta at all
 * (never a fabricated percentage).
 */
export interface StatDelta {
  current: number;
  previous: number | null | undefined;
  /** e.g. "গত মাসের একই সময়ের তুলনায়" */
  label?: string;
  /** For "due"-style metrics an increase is bad. Default: an increase is good. */
  increaseIsGood?: boolean;
}

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  /** Legacy free-text trend line (kept for existing call sites). */
  trend?: string;
  /** Short context under the value. */
  description?: string;
  delta?: StatDelta;
  variant: "primary" | "success" | "warning" | "info" | "danger";
  loading?: boolean;
  /** Makes the whole card a click target (e.g. a dashboard alert tile that jumps to the relevant page) — purely additive, every existing call site without it renders exactly as before. */
  onClick?: () => void;
  className?: string;
}

const iconTone: Record<StatCardProps["variant"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-muted text-foreground/70",
  danger: "bg-destructive/10 text-destructive",
};

function DeltaChip({ delta }: { delta: StatDelta }) {
  if (delta.previous === null || delta.previous === undefined) return null;
  const diff = delta.current - delta.previous;
  const increaseIsGood = delta.increaseIsGood !== false;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden /> অপরিবর্তিত{delta.label ? ` · ${delta.label}` : ""}
      </span>
    );
  }
  const up = diff > 0;
  const good = up === increaseIsGood;
  // A % change is only meaningful against a non-zero base; otherwise show the absolute direction only.
  const pct = delta.previous !== 0 ? Math.round((Math.abs(diff) / Math.abs(delta.previous)) * 100) : null;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", good ? "text-success" : "text-destructive")}>
        <Arrow className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{up ? "বৃদ্ধি" : "হ্রাস"}</span>
        {pct !== null ? `${pct}%` : up ? "বেড়েছে" : "কমেছে"}
      </span>
      {delta.label && <span className="text-muted-foreground">{delta.label}</span>}
    </span>
  );
}

export function StatCard({ title, value, icon: Icon, trend, description, delta, variant, loading, onClick, className }: StatCardProps) {
  return (
    <Card
      className={cn(
        "group transition-[border-color,box-shadow]",
        onClick && "cursor-pointer hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground leading-snug">{title}</p>
          <span className={cn("shrink-0 rounded-md p-2", iconTone[variant])}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums break-words">{value}</p>
        )}
        <div className="mt-1.5 min-h-[1rem] space-y-0.5">
          {delta && !loading && <DeltaChip delta={delta} />}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          {trend && <p className="text-xs text-success font-medium">{trend}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
