import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface SearchOption {
  value: string;
  label: string;
  /** Secondary text shown under the label (also searchable). */
  sub?: string;
}

/**
 * Searchable dropdown (Popover + Command) for long lists — courses, batches,
 * exams, institutions. `allLabel` adds a "clear" first row that sets "".
 */
export function SearchSelect({ value, onChange, options, placeholder, allLabel, label, disabled, className }: {
  value: string;
  onChange: (v: string) => void;
  options: SearchOption[];
  placeholder: string;
  allLabel?: string;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={label} disabled={disabled}
          className={cn("w-full justify-between font-normal", !current && "text-muted-foreground", current && allLabel && "border-primary/40 bg-primary/[0.03]", className)}>
          <span className="truncate">{current?.label ?? (value ? value : allLabel ?? placeholder)}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="খুঁজুন..." />
          <CommandList>
            <CommandEmpty>কিছু পাওয়া যায়নি</CommandEmpty>
            <CommandGroup>
              {allLabel !== undefined && (
                <CommandItem value="__all__" onSelect={() => { onChange(""); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value ? "opacity-0" : "opacity-100")} />{allLabel}
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem key={o.value} value={`${o.label} ${o.sub ?? ""} ${o.value}`} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0"><span className="block truncate">{o.label}</span>{o.sub && <span className="block truncate text-xs text-muted-foreground">{o.sub}</span>}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
