import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface IconSwitchOption<T extends string> {
  value: T;
  /** The name (read by screen readers and shown as the tooltip). */
  label: string;
  icon: ReactNode;
}

/**
 * Two or three views of the same page as icons only (the Conecta's
 * AbasOrganograma): Lista / Mapa, Lista / Painel SLA, Escrever / Ver. It sits
 * on the page header's title row (`PageHeader.trailing`); the current one is
 * a soft blue.
 */
export function IconSwitch<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  /** What the group chooses ("Ver o cérebro como"). */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly IconSwitchOption<T>[];
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg border bg-card p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            onClick={() => !on && onChange(o.value)}
            className={cn(
              "grid h-full place-items-center rounded-md px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0",
              on ? "bg-primary/[0.12] text-primary-text" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {o.icon}
          </button>
        );
      })}
    </div>
  );
}
