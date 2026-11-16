import { HistoryIcon } from "lucide-react";

import { EstadoVazio } from "@/components/EstadoVazio";
import { dataHoraBR } from "@/lib/formato";
import type { Historico } from "@/lib/tipos";

/** A linha do tempo do que foi feito (quem, quando, o quê). */
export function ListaHistorico({ itens, mostrarOnde }: { itens: Historico[]; mostrarOnde?: boolean }) {
  if (itens.length === 0) return <EstadoVazio compact icon={<HistoryIcon />} title="Nada registrado ainda" />;
  return (
    <ol className="flex flex-col">
      {itens.map((h) => (
        <li key={h.id} className="flex gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="min-w-0">
              <span className="font-medium">{h.acao}</span>
              {h.detalhe && <span className="text-muted-foreground"> · {h.detalhe}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {dataHoraBR(h.quando)}
              {h.usuario && ` · ${h.usuario}`}
              {mostrarOnde && (h.cliente_nome || h.operacao_nome) && ` · ${[h.cliente_nome, h.operacao_nome].filter(Boolean).join(" › ")}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
