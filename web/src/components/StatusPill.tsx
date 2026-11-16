import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The five tones of a status, by meaning (the Conecta's catalogue,
 * StatusVariantes): done, in progress, waiting, bad, neutral.
 */
export type StatusTone = "concluido" | "andamento" | "aguardando" | "negativo" | "neutro" | "marca";

const TONE: Record<StatusTone, string> = {
  concluido: "bg-emerald-500/[0.12] text-emerald-700 dark:bg-emerald-400/[0.14] dark:text-emerald-300",
  // Azul próprio: no dourado da marca pareceria "aguardando".
  andamento: "bg-sky-500/[0.12] text-sky-700 dark:bg-sky-400/[0.14] dark:text-sky-300",
  marca: "bg-primary/[0.14] text-primary-ink",
  aguardando: "bg-amber-500/[0.14] text-amber-700 dark:text-amber-300",
  negativo: "bg-destructive/[0.12] text-destructive",
  neutro: "bg-muted text-muted-foreground",
};

/** The dot: below 1024 px the Conecta's red-500 and neutral-400. */
const DOT: Record<StatusTone, string> = {
  concluido: "bg-emerald-500",
  andamento: "bg-sky-500",
  marca: "bg-primary",
  aguardando: "bg-amber-500",
  negativo: "bg-destructive max-lg:bg-red-500",
  neutro: "bg-muted-foreground/60 max-lg:bg-neutral-400 dark:max-lg:bg-neutral-500",
};

/**
 * A record's status on the phone's cards (the Conecta's `StatusPill`): a soft
 * fill, a dot of the tone, 12 px text, 22 px tall, `rounded-md` (removable
 * filter chips are round, a status is not). The map from each record's state
 * to a tone is in the spec (5.5): an entry "A receber" is aguardando, a task
 * "Atrasada" negativo, a debt "em dia" andamento…
 *
 *   <StatusPill tone="aguardando">A receber</StatusPill>
 */
export function StatusPill({ tone, children, icon, className }: { tone: StatusTone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
        TONE[tone],
        className,
      )}
    >
      {icon ?? <span className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} aria-hidden />}
      {children}
    </span>
  );
}
