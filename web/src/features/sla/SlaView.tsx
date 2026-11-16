import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, GaugeIcon } from "lucide-react";

import { EstadoVazio } from "@/components/EstadoVazio";
import { ReportTable, type ReportColumn } from "@/components/ReportTable";
import { StatsLine } from "@/components/StatsLine";
import { StatusPill } from "@/components/StatusPill";
import { Skeleton } from "@/components/ui/skeleton";
import { useFerramentas } from "@/app/faixa";
import { useMigalhas } from "@/app/migalhas";
import { useUsuario } from "@/app/sessao";
import { api } from "@/lib/api";
import type { LinhaSla, Sla } from "@/lib/tipos";

const PERIODOS = [
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
  { dias: 365, label: "12 meses" },
  { dias: 0, label: "Tudo" },
];

const num = (v: number | null) => (v === null ? "—" : String(v).replace(".", ","));

export function PillSla({ valor }: { valor: number | null }) {
  if (valor === null) return <StatusPill tone="neutro">Sem dados</StatusPill>;
  return <StatusPill tone={valor >= 85 ? "concluido" : valor >= 60 ? "aguardando" : "negativo"}>{valor}%</StatusPill>;
}

/** O SLA: dentro do prazo por consultor, processo e etapa. Dias corridos. */
export function SlaView({ pagina }: { pagina: "consultores" | "processos" | "etapas" }) {
  const eu = useUsuario();
  const [dias, setDias] = useState(90);
  const nomes = { consultores: "Consultores", processos: "Processos", etapas: "Etapas" };
  useMigalhas([{ label: "Painel", caminho: "/painel" }, { label: `SLA: ${nomes[pagina]}` }]);
  const consulta = useQuery({ queryKey: ["sla", dias], queryFn: () => api<Sla>(`/sla?dias=${dias}`) });
  const d = consulta.data;

  useFerramentas([
    {
      titulo: "Filtrar",
      ferramentas: [
        {
          id: "periodo",
          label: PERIODOS.find((p) => p.dias === dias)?.label ?? "Período",
          icon: CalendarIcon,
          tom: "cinza",
          menu: PERIODOS.map((p) => ({ id: String(p.dias), label: p.label, ativo: p.dias === dias, run: () => setDias(p.dias) })),
        },
      ],
    },
  ]);

  const colunasGrupo: ReportColumn<LinhaSla>[] = [
    { id: "nome", header: pagina === "etapas" ? "Etapa" : "Processo", primary: true, cell: (l) => <span className="font-medium">{l.nome}</span> },
    { id: "sla", header: "SLA", width: "7rem", center: true, cell: (l) => <PillSla valor={l.sla} /> },
    { id: "total", header: "Medidas", width: "7rem", type: "number", cell: (l) => l.total },
    { id: "dentro", header: "No prazo", width: "7rem", type: "number", cell: (l) => l.dentro },
    { id: "fora", header: "Fora do prazo", width: "8rem", type: "number", cell: (l) => l.fora },
    { id: "abertas", header: "Em aberto", width: "7rem", type: "number", cell: (l) => l.abertas },
    { id: "medio", header: "Tempo médio (dias)", width: "10rem", type: "number", cell: (l) => num(l.tempo_medio) },
    { id: "prazo", header: "Prazo médio (dias)", width: "10rem", type: "number", cell: (l) => num(l.prazo_medio) },
  ];
  const consultores = d?.consultores ?? [];
  const colunasConsultor: ReportColumn<(typeof consultores)[number]>[] = [
    { id: "nome", header: "Consultor", primary: true, cell: (c) => <span className="font-medium">{c.nome}</span> },
    { id: "sla", header: "SLA", width: "7rem", center: true, cell: (c) => <PillSla valor={c.sla} /> },
    { id: "periodos", header: "Períodos em etapa", width: "10rem", type: "number", cell: (c) => c.periodos },
    { id: "dentro", header: "No prazo", width: "7rem", type: "number", cell: (c) => c.dentro },
    { id: "fora", header: "Fora do prazo", width: "8rem", type: "number", cell: (c) => c.fora },
    { id: "atraso", header: "Atrasadas agora", width: "9rem", type: "number", cell: (c) => c.atrasadas_agora },
    { id: "medio", header: "Tempo médio (dias)", width: "10rem", type: "number", cell: (c) => num(c.tempo_medio) },
  ];
  const vazio = <EstadoVazio compact icon={<GaugeIcon />} title="Sem medição neste período" description="O SLA aparece conforme as operações passam pelas etapas." />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {consulta.isPending ? (
        <Skeleton className="m-4 h-40" />
      ) : pagina === "consultores" ? (
        <ReportTable label={eu.admin ? "SLA dos consultores" : "Meu SLA"} columns={colunasConsultor} rows={consultores} rowKey={(c) => String(c.consultor_id)} empty={vazio} />
      ) : (
        <ReportTable label={`SLA por ${nomes[pagina]}`} columns={colunasGrupo} rows={(pagina === "processos" ? d?.processos : d?.etapas) ?? []} rowKey={(l) => l.nome} empty={vazio} />
      )}
      {d && (
        <StatsLine
          label="SLA geral"
          items={[
            { id: "no", label: "No prazo", value: d.geral.dentro },
            { id: "fora", label: "Fora do prazo", value: d.geral.fora },
          ]}
          summary={[{ id: "geral", label: "SLA geral", value: d.geral.sla === null ? "—" : `${d.geral.sla}%` }]}
        />
      )}
    </div>
  );
}
