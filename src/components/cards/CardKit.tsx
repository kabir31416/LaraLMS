import type { ReactNode } from "react";
import { ChevronDown, FileDown, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { EXAM_STATUS_LABEL, type ExamStatus } from "@/types/cards";

/** Numbered workflow strip ("what to do next"), with done/active states. */
export function WorkflowSteps({ steps }: { steps: { label: string; hint?: string; done?: boolean; active?: boolean }[] }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="ধাপসমূহ">
      {steps.map((s, i) => (
        <li key={s.label} className={cn("flex items-start gap-2 rounded-lg border bg-card p-2.5 text-sm transition-colors", s.active && "border-primary/50 bg-primary/[0.04]", s.done && "border-success/30")}>
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums", s.done ? "bg-success text-success-foreground" : s.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {s.done ? "✓" : (i + 1).toLocaleString("bn-BD")}
          </span>
          <span className="min-w-0">
            <span className="block font-medium leading-tight">{s.label}</span>
            {s.hint && <span className="block truncate text-xs text-muted-foreground">{s.hint}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

const STATUS_CLASS: Record<ExamStatus, string> = {
  draft: "border-dashed border-muted-foreground/40 bg-muted/50 text-muted-foreground",
  published: "border-success/30 bg-success/10 text-success",
  completed: "border-info/30 bg-info/10 text-info",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive line-through decoration-1",
};

export function ExamStatusBadge({ status, className }: { status: ExamStatus; className?: string }) {
  return <Badge variant="outline" className={cn("whitespace-nowrap font-medium", STATUS_CLASS[status], className)}>{EXAM_STATUS_LABEL[status]}</Badge>;
}

/** ID-card / admit-card issue state. */
export function IssueBadge({ issued, outdated, label }: { issued: boolean; outdated?: boolean; label?: ReactNode }) {
  if (!issued) return <Badge variant="outline" className="whitespace-nowrap border-dashed text-muted-foreground">ইস্যু হয়নি</Badge>;
  if (outdated) return <Badge variant="outline" className="whitespace-nowrap border-warning/40 bg-warning/10 text-warning">তথ্য পরিবর্তিত</Badge>;
  return <Badge variant="outline" className="whitespace-nowrap border-success/30 bg-success/10 text-success">{label ?? "ইস্যুকৃত"}</Badge>;
}

export type PrintChoice = { key: string; label: string; hint?: string; pdf?: boolean };

/** One "Print" button with a menu of layouts plus PDF. */
export function PrintMenu({ choices, onChoose, disabled, busy, label = "প্রিন্ট / PDF", size }: { choices: PrintChoice[]; onChoose: (c: PrintChoice) => void; disabled?: boolean; busy?: boolean; label?: string; size?: "sm" | "default" }) {
  const print = choices.filter((c) => !c.pdf), pdf = choices.filter((c) => c.pdf);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={disabled || busy}><Printer className="h-4 w-4" aria-hidden />{busy ? "প্রস্তুত হচ্ছে..." : label}<ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">প্রিন্ট</DropdownMenuLabel>
        {print.map((c) => (
          <DropdownMenuItem key={c.key} onClick={() => onChoose(c)} className="flex-col items-start gap-0">
            <span className="flex items-center gap-2"><Printer className="h-3.5 w-3.5" aria-hidden />{c.label}</span>
            {c.hint && <span className="pl-5 text-xs text-muted-foreground">{c.hint}</span>}
          </DropdownMenuItem>
        ))}
        {pdf.length > 0 && <DropdownMenuSeparator />}
        {pdf.map((c) => (
          <DropdownMenuItem key={c.key} onClick={() => onChoose(c)} className="flex-col items-start gap-0">
            <span className="flex items-center gap-2"><FileDown className="h-3.5 w-3.5" aria-hidden />{c.label}</span>
            {c.hint && <span className="pl-5 text-xs text-muted-foreground">{c.hint}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const n = (v: number | undefined | null) => (v === undefined || v === null ? "—" : v.toLocaleString("bn-BD"));

/** Admin and Batch Director reach the same pages under different prefixes. */
export const admitBase = (role?: string) => (role === "Batch Director" ? "/director/admit-cards" : "/admit-cards");
