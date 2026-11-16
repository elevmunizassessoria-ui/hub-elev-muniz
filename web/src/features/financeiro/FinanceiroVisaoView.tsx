import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { BarrasMes } from "@/components/BarrasMes";
import { Carregando } from "@/components/Carregando";
import { StatsLine } from "@/components/StatsLine";
import { useMigalhas } from "@/app/migalhas";
import { navegar } from "@/app/rotas";
import { api } from "@/lib/api";
import { dinheiro, hojeISO, nomeMes } from "@/lib/formato";
import type { Lancamento } from "@/lib/tipos";

/** O resultado: 12 meses em barras e o que está em aberto por categoria. */
export function FinanceiroVisaoView() {
  useMigalhas([{ label: "Financeiro", caminho: "/financeiro" }, { label: "Visão geral" }]);
  const consulta = useQuery({ queryKey: ["financeiro-visao"], queryFn: () => api<{ lancamentos: Lancamento[] }>("/financeiro/lancamentos") });
  const lista = useMemo(() => consulta.data?.lancamentos ?? [], [consulta.data]);
  const dados = useMemo(() => {
    const soma = (l: Lancamento[]) => l.reduce((t, x) => t + x.valor_centavos, 0);
    const hoje = new Date();
    const meses = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 10 + i, 1);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const doMes = lista.filter((l) => l.vencimento.startsWith(mes));
      return { mes, receita: soma(doMes.filter((l) => l.tipo === "receita")), despesa: soma(doMes.filter((l) => l.tipo === "despesa")) };
    });
    const categorias = new Map<string, number>();
    for (const l of lista) if (l.tipo === "despesa" && l.vencimento.startsWith(hojeISO().slice(0, 7))) categorias.set(l.categoria || "Sem categoria", (categorias.get(l.categoria || "Sem categoria") ?? 0) + l.valor_centavos);
    return {
      meses,
      categorias: [...categorias.entries()].sort((a, b) => b[1] - a[1]),
      receber: soma(lista.filter((l) => l.tipo === "receita" && !l.pago_em)),
      pagar: soma(lista.filter((l) => l.tipo === "despesa" && !l.pago_em)),
      recebido: soma(lista.filter((l) => l.tipo === "receita" && l.pago_em)),
      pago: soma(lista.filter((l) => l.tipo === "despesa" && l.pago_em)),
      atrasadoR: lista.filter((l) => l.tipo === "receita" && l.situacao === "atrasado").length,
      atrasadoD: lista.filter((l) => l.tipo === "despesa" && l.situacao === "atrasado").length,
    };
  }, [lista]);
  if (consulta.isPending) return <Carregando />;
  const maior = Math.max(1, ...dados.categorias.map((c) => c[1]));
  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-1 gap-4 p-4 lg:p-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="flex h-[360px] min-w-0 flex-col gap-3 rounded-[14px] bg-card p-4">
          <h2 className="text-[15px] font-semibold">Receitas e despesas por vencimento</h2>
          <div className="min-h-0 flex-1">
            <BarrasMes meses={dados.meses} />
          </div>
        </section>
        <section className="min-w-0 rounded-[14px] bg-card p-4">
          <h2 className="mb-3 text-[15px] font-semibold">Despesas de {nomeMes(hojeISO().slice(0, 7))}</h2>
          {dados.categorias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma despesa neste mês.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {dados.categorias.map(([nome, valor]) => (
                <li key={nome}>
                  <div className="mb-1 flex items-baseline gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{nome}</span>
                    <span className="text-[13px] text-muted-foreground tabular-nums">{dinheiro(valor)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
                    <div className="h-full rounded-full bg-money-out-bar" style={{ width: `${(valor / maior) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <StatsLine
        label="Totais do financeiro"
        items={[
          { id: "r", label: "Receitas atrasadas", value: dados.atrasadoR, onClick: () => navegar("/financeiro/receitas") },
          { id: "d", label: "Despesas atrasadas", value: dados.atrasadoD, onClick: () => navegar("/financeiro/despesas") },
        ]}
        summary={[
          { id: "ar", label: "A receber", value: dinheiro(dados.receber) },
          { id: "ap", label: "A pagar", value: dinheiro(dados.pagar) },
          { id: "s", label: "Saldo realizado", value: dinheiro(dados.recebido - dados.pago) },
        ]}
      />
    </div>
  );
}
