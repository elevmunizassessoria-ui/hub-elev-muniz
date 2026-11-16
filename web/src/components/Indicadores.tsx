import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface Indicador {
  id: string;
  label: string;
  valor: ReactNode;
  icon: ReactNode;
  detalhe?: ReactNode;
  /** Cor do número e do círculo do ícone. */
  tom?: "marca" | "aguardando" | "negativo" | "concluido" | "neutro";
}

const CIRCULO = {
  marca: "bg-primary/[0.12] text-primary-text",
  aguardando: "bg-amber-500/[0.14] text-amber-600 dark:text-amber-400",
  negativo: "bg-destructive/[0.12] text-destructive",
  concluido: "bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400",
  neutro: "bg-muted text-muted-foreground",
} as const;

/** Cartões de números no alto da tela (os "Indicators" do Axyn One). */
export function Indicadores({ itens, className }: { itens: Indicador[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4", className)}>
      {itens.map((i) => (
        <div key={i.id} className="flex min-w-0 items-center gap-3 rounded-[12px] border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-full [&>svg]:size-5", CIRCULO[i.tom ?? "marca"])} aria-hidden>
            {i.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{i.label}</p>
            <p className="mt-0.5 text-2xl leading-tight font-bold tracking-tight tabular-nums">{i.valor}</p>
            {i.detalhe && <p className="truncate text-xs text-muted-foreground">{i.detalhe}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
