import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode; icon?: ReactNode }[];
  /** What the group chooses (read by screen readers). */
  label: string;
  className?: string;
  size?: "sm" | "default";
}

/**
 * One choice among a few, side by side (Lista | Mapa, 7 | 30 | 90 dias…).
 * On the phone the default size is 36 px and 14 px text; a full-width use
 * passes `className="flex w-full [&>button]:flex-1"`.
 */
export function Segmented<T extends string>({ value, onChange, options, label, className, size = "default" }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex shrink-0 gap-0.5 rounded-lg bg-muted p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none",
            "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5 [&_svg]:shrink-0",
            "aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-[0_1px_2px_rgb(0_0_0/0.18)] dark:aria-checked:bg-accent",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px] max-lg:h-9 max-lg:text-sm",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
