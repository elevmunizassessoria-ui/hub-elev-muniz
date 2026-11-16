import { useState } from "react";

import { dinheiro, nomeMesCurto } from "@/lib/formato";

export interface MesValores {
  mes: string;
  receita: number;
  despesa: number;
}

/** Receita e despesa por mês: duas barras finas por mês, um eixo só, legenda em cima e valor ao passar o mouse. */
export function BarrasMes({ meses }: { meses: MesValores[] }) {
  const [foco, setFoco] = useState<string | null>(null);
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.receita, m.despesa]));
  const atual = meses.find((m) => m.mes === foco);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex min-h-5 flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-money-in-bar" aria-hidden />
          Receita
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-money-out-bar" aria-hidden />
          Despesa
        </span>
        {atual && (
          <span className="ml-auto text-foreground tabular-nums">
            {nomeMesCurto(atual.mes)}: {dinheiro(atual.receita)} · {dinheiro(atual.despesa)}
          </span>
        )}
      </div>
      <div className="grid min-h-40 flex-1 items-stretch gap-2 border-b" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }} onMouseLeave={() => setFoco(null)}>
        {meses.map((m) => (
          <button
            key={m.mes}
            type="button"
            onMouseEnter={() => setFoco(m.mes)}
            onFocus={() => setFoco(m.mes)}
            aria-label={`${nomeMesCurto(m.mes)}: receita ${dinheiro(m.receita)}, despesa ${dinheiro(m.despesa)}`}
            className="flex items-end justify-center gap-0.5 rounded-t-md outline-none hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="w-3 rounded-t-[4px] bg-money-in-bar" style={{ height: `${(m.receita / maximo) * 100}%` }} />
            <span className="w-3 rounded-t-[4px] bg-money-out-bar" style={{ height: `${(m.despesa / maximo) * 100}%` }} />
          </button>
        ))}
      </div>
      <div className="grid gap-2 text-center text-xs text-muted-foreground" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}>
        {meses.map((m) => (
          <span key={m.mes}>{nomeMesCurto(m.mes)}</span>
        ))}
      </div>
    </div>
  );
}
