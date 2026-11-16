import { useState } from "react";
import { CalendarClockIcon, UserRoundIcon } from "lucide-react";

import { StatsLine } from "@/components/StatsLine";
import { useMigalhas } from "@/app/migalhas";
import { dinheiro, plural } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { navegar } from "@/app/rotas";
import { FUNIL_ETAPAS, useCredito } from "./dados";

/** O funil de crédito: da prospecção à liberação, com o valor em cada etapa. */
export function FunilView() {
  useMigalhas([{ label: "Operações", caminho: "/operacoes" }, { label: "Funil de crédito" }]);
  const { FUNIL } = useCredito();
  // Arrastar muda só na tela (ainda não grava): guarda para onde cada cartão foi.
  const [movidos, setMovidos] = useState<Record<string, number>>({});
  const cartoes = FUNIL.map((c) => (c.id in movidos ? { ...c, etapa: movidos[c.id] } : c));
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const soma = (e: number) => cartoes.filter((c) => c.etapa === e).reduce((t, c) => t + c.valor, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
        {FUNIL_ETAPAS.map((nome, e) => {
          const lista = cartoes.filter((c) => c.etapa === e);
          return (
            <section
              key={nome}
              aria-label={nome}
              onDragOver={(ev) => {
                ev.preventDefault();
                setSobre(e);
              }}
              onDragLeave={() => setSobre(null)}
              onDrop={() => {
                if (arrastando !== null) setMovidos((m) => ({ ...m, [arrastando]: e }));
                setArrastando(null);
                setSobre(null);
              }}
              className={cn("flex w-64 shrink-0 flex-col rounded-[14px] bg-foreground/[0.04] transition-colors", sobre === e && "bg-primary/[0.12]")}
            >
              <header className="shrink-0 px-3 pt-3 pb-2">
                <p className="flex items-center justify-between gap-2 text-[13px] font-semibold">
                  <span className="truncate">{nome}</span>
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">{lista.length}</span>
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">{dinheiro(soma(e))}</p>
              </header>
              <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {lista.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      draggable
                      onDragStart={() => setArrastando(c.id)}
                      onClick={() => navegar(c.operacao_id ? `/operacoes/${c.operacao_id}` : `/clientes/${c.cliente_id}`)}
                      className="flex w-full cursor-grab flex-col gap-1 rounded-[10px] bg-card p-3 text-left text-sm shadow-[0_1px_2px_rgb(0_0_0/0.12)] outline-none hover:ring-1 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="truncate font-medium">{c.cliente}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {c.produto} · {c.banco}
                      </span>
                      <span className="font-semibold tabular-nums">{dinheiro(c.valor)}</span>
                      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="flex min-w-0 items-center gap-1">
                          <UserRoundIcon className="size-3 shrink-0" />
                          <span className="truncate">{c.consultor}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <CalendarClockIcon className="size-3" />
                          {plural(c.dias, "dia", "dias")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <StatsLine
        label="Números do funil"
        items={[
          { id: "ab", label: "Em andamento", value: cartoes.filter((c) => c.etapa < 6).length },
          { id: "li", label: "Liberadas", value: cartoes.filter((c) => c.etapa === 6).length },
        ]}
        summary={[
          { id: "pi", label: "No funil", value: dinheiro(cartoes.filter((c) => c.etapa < 6).reduce((t, c) => t + c.valor, 0)) },
          { id: "lb", label: "Liberado", value: dinheiro(soma(6)) },
        ]}
      />
    </div>
  );
}
