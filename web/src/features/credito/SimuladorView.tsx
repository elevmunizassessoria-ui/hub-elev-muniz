import { useMemo, useState } from "react";

import { Escolha } from "@/components/Escolha";
import { FormField } from "@/components/FormPage";
import { REPORT_CELL, REPORT_HEAD, REPORT_ROW, REPORT_TABLE } from "@/components/ReportTable";
import { Segmented } from "@/components/Segmented";
import { Input } from "@/components/ui/input";
import { useMigalhas } from "@/app/migalhas";
import { dinheiro } from "@/lib/formato";
import { PRODUTOS } from "./dados";

type Sistema = "price" | "sac";

const numero = (t: string) => Number(t.replace(/\./g, "").replace(",", ".")) || 0;

/** O simulador: conta de verdade, feita aqui na tela. Só a lista de produtos é fictícia. Não grava. */
export function SimuladorView() {
  useMigalhas([{ label: "Operações", caminho: "/operacoes" }, { label: "Simulador" }]);
  const [produto, setProduto] = useState("");
  const [valor, setValor] = useState("500.000,00");
  const [taxa, setTaxa] = useState("1,75");
  const [prazo, setPrazo] = useState("24");
  const [tarifa, setTarifa] = useState("2.500,00");
  const [sistema, setSistema] = useState<Sistema>("price");

  const escolherProduto = (v: string) => {
    setProduto(v);
    const p = PRODUTOS[Number(v)];
    if (p) {
      setTaxa(String((p.taxaMin + p.taxaMax) / 2).replace(".", ","));
      setPrazo(String(Math.min(p.prazo, 60)));
    }
  };

  const r = useMemo(() => {
    const pv = numero(valor);
    const i = numero(taxa) / 100;
    const n = Math.max(1, Math.min(420, Math.trunc(numero(prazo))));
    const linhas: { n: number; parcela: number; juros: number; amort: number; saldo: number }[] = [];
    let saldo = pv;
    const pmt = i > 0 ? (pv * i) / (1 - (1 + i) ** -n) : pv / n;
    for (let k = 1; k <= n; k++) {
      const juros = saldo * i;
      const amort = sistema === "price" ? pmt - juros : pv / n;
      saldo = Math.max(0, saldo - amort);
      linhas.push({ n: k, parcela: amort + juros, juros, amort, saldo });
    }
    const total = linhas.reduce((t, l) => t + l.parcela, 0);
    const liquido = pv - numero(tarifa);
    // Custo efetivo: a taxa que iguala o valor líquido às parcelas.
    let baixo = 0;
    let alto = 1;
    for (let k = 0; k < 60; k++) {
      const meio = (baixo + alto) / 2;
      const vp = linhas.reduce((t, l) => t + l.parcela / (1 + meio) ** l.n, 0);
      if (vp > liquido) baixo = meio;
      else alto = meio;
    }
    return { linhas, total, juros: total - pv, primeira: linhas[0]?.parcela ?? 0, ultima: linhas.at(-1)?.parcela ?? 0, cet: (baixo + alto) / 2 };
  }, [valor, taxa, prazo, tarifa, sistema]);

  const c = (v: number) => dinheiro(Math.round(v * 100));
  const p = (v: number) => `${(v * 100).toFixed(2).replace(".", ",")}%`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:p-5">
        <section className="flex flex-col gap-3 self-start rounded-[14px] bg-card p-4">
          <h2 className="text-[15px] font-semibold">Condições</h2>
          <FormField label="Produto (fictício)">
            <Escolha value={produto} onChange={escolherProduto} vazio="Sem produto" options={PRODUTOS.map((x, i) => ({ value: String(i), label: `${x.nome} · ${x.banco}` }))} />
          </FormField>
          <FormField label="Valor (R$)" htmlFor="si-valor">
            <Input id="si-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Taxa a.m. (%)" htmlFor="si-taxa">
              <Input id="si-taxa" inputMode="decimal" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
            </FormField>
            <FormField label="Prazo (meses)" htmlFor="si-prazo">
              <Input id="si-prazo" inputMode="numeric" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Tarifas e custos (R$)" htmlFor="si-tarifa">
            <Input id="si-tarifa" inputMode="decimal" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
          </FormField>
          <FormField label="Sistema">
            <Segmented<Sistema>
              label="Sistema de amortização"
              value={sistema}
              onChange={setSistema}
              className="w-full [&>button]:flex-1"
              options={[
                { value: "price", label: "Price" },
                { value: "sac", label: "SAC" },
              ]}
            />
          </FormField>
          <p className="text-xs text-muted-foreground">Simulação de referência. Não substitui a proposta da instituição e não é gravada.</p>
        </section>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Numero rotulo={sistema === "price" ? "Parcela" : "Primeira parcela"} valor={c(r.primeira)} detalhe={sistema === "sac" ? `Última: ${c(r.ultima)}` : undefined} />
            <Numero rotulo="Total pago" valor={c(r.total)} />
            <Numero rotulo="Total de juros" valor={c(r.juros)} />
            <Numero rotulo="Custo efetivo a.m." valor={p(r.cet)} detalhe={`${p((1 + r.cet) ** 12 - 1)} ao ano`} />
          </div>
          <section className="min-w-0 overflow-hidden rounded-[14px] bg-card">
            <h2 className="border-b px-4 py-2.5 text-[15px] font-semibold">Parcelas</h2>
            <div className="max-h-[480px] overflow-auto">
              <table className={REPORT_TABLE}>
                <thead>
                  <tr>
                    {["Nº", "Parcela", "Juros", "Amortização", "Saldo"].map((t) => (
                      <th key={t} className={`${REPORT_HEAD} sticky top-0`}>
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.linhas.map((l) => (
                    <tr key={l.n} className={REPORT_ROW}>
                      <td className={REPORT_CELL}>{l.n}</td>
                      <td className={`${REPORT_CELL} tabular-nums`}>{c(l.parcela)}</td>
                      <td className={`${REPORT_CELL} tabular-nums`}>{c(l.juros)}</td>
                      <td className={`${REPORT_CELL} tabular-nums`}>{c(l.amort)}</td>
                      <td className={`${REPORT_CELL} tabular-nums`}>{c(l.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="min-w-0 rounded-[14px] bg-card p-4">
      <p className="truncate text-[13px] text-muted-foreground">{rotulo}</p>
      <p className="truncate text-xl leading-tight font-semibold tracking-tight tabular-nums">{valor}</p>
      {detalhe && <p className="truncate text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}
