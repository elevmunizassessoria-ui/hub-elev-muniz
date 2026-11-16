import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, ArrowRightLeftIcon, CalendarXIcon, ChevronRightIcon, FileCheck2Icon, FolderKanbanIcon, GaugeIcon, HandCoinsIcon, HourglassIcon, UserRoundXIcon, WalletIcon } from "lucide-react";

import { BarrasMes, type MesValores } from "@/components/BarrasMes";
import { Carregando } from "@/components/Carregando";
import { EstadoVazio } from "@/components/EstadoVazio";
import { StatusPill } from "@/components/StatusPill";
import { useMigalhas } from "@/app/migalhas";
import { navegar } from "@/app/rotas";
import { usePode } from "@/app/sessao";
import { useCredito } from "@/features/credito/dados";
import { api } from "@/lib/api";
import { dinheiro, plural } from "@/lib/formato";
import { cn } from "@/lib/utils";

interface Painel {
  ve_tudo: boolean;
  operacoes: { ativas: number; atrasadas: number; perto: number; sem_consultor: number; concluidas_mes: number };
  documentos: { para_aprovar: number; vencidos: number; vencendo: number; faltando: number; recusados: number };
  sla: {
    geral: { sla: number | null; total: number; dentro: number; fora: number };
    consultores: { consultor_id: number; nome: string; sla: number | null; periodos: number; atrasadas_agora: number }[];
    gargalo: { nome: string; sla: number | null; tempo_medio: number | null; prazo_medio: number | null } | null;
  };
  carga: { nome: string; ativas: number; atrasadas: number }[];
  atrasadas: { id: number; cliente_id: number; codigo: string; nome: string; cliente_nome: string; consultor_nome: string; etapa_nome: string; dias_atraso: number }[];
  transferencias_mes: number;
  financeiro: { receita_mes: number; despesa_mes: number; receber_atrasado: number; pagar_atrasado: number; meses: MesValores[] } | null;
}

const virgula = (v: number) => String(v).replace(".", ",");

/** O painel: primeiro o que pede decisão; cada número abre a lista que o explica. */
export function PainelView() {
  const consulta = useQuery({ queryKey: ["painel"], queryFn: () => api<Painel>("/painel"), refetchInterval: 60_000 });
  const d = consulta.data;
  const podeCredito = usePode("credito");
  const { COMISSOES, FUNIL, PARCELAS, PROPOSTAS } = useCredito();
  useMigalhas([{ label: d && !d.ve_tudo ? "Meu painel" : "Painel" }]);
  if (consulta.isPending) return <Carregando />;
  if (!d) return <EstadoVazio title="Não foi possível abrir o painel" description={(consulta.error as Error)?.message} />;

  const f = d.financeiro;
  const noFunil = FUNIL.filter((c) => c.etapa < 6).reduce((t, c) => t + c.valor, 0);
  const decididas = PROPOSTAS.filter((p) => p.situacao === "Aprovada" || p.situacao === "Recusada" || p.encerrada);
  const aprovacao = decididas.length ? Math.round((decididas.filter((p) => p.situacao !== "Recusada").length / decididas.length) * 100) : null;
  const decisoes: { id: string; icon: ReactNode; texto: string; detalhe: string; tom: "negativo" | "aguardando"; ir: string }[] = [];
  const add = (cond: unknown, x: (typeof decisoes)[number]) => cond && decisoes.push(x);
  add(d.operacoes.sem_consultor, { id: "sem", icon: <UserRoundXIcon />, texto: `${plural(d.operacoes.sem_consultor, "operação", "operações")} sem consultor`, detalhe: "Defina quem cuida", tom: "negativo", ir: "/operacoes" });
  add(d.documentos.vencidos, { id: "ven", icon: <CalendarXIcon />, texto: `${plural(d.documentos.vencidos, "documento vencido", "documentos vencidos")}`, detalhe: "Peça a nova versão ao cliente", tom: "negativo", ir: "/documentos" });
  add(f?.receber_atrasado, { id: "rec", icon: <HandCoinsIcon />, texto: `${dinheiro(f?.receber_atrasado ?? 0)} a receber em atraso`, detalhe: "Cobrar os clientes", tom: "negativo", ir: "/financeiro/receitas" });
  add(f?.pagar_atrasado, { id: "pag", icon: <WalletIcon />, texto: `${dinheiro(f?.pagar_atrasado ?? 0)} a pagar em atraso`, detalhe: "Regularizar", tom: "negativo", ir: "/financeiro/despesas" });
  add(d.documentos.para_aprovar, { id: "apr", icon: <FileCheck2Icon />, texto: `${plural(d.documentos.para_aprovar, "documento", "documentos")} para aprovar`, detalhe: "Enviados pelo link", tom: "aguardando", ir: "/documentos/aprovacao" });
  add(d.sla.gargalo && (d.sla.gargalo.sla ?? 100) < 85, { id: "gar", icon: <HourglassIcon />, texto: `Gargalo: ${d.sla.gargalo?.nome}`, detalhe: `${d.sla.gargalo?.sla}% no prazo`, tom: "aguardando", ir: "/painel/sla/etapas" });

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-4 p-4 lg:p-5">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Numero icon={<GaugeIcon />} rotulo="SLA (90 dias)" valor={d.sla.geral.sla === null ? "—" : `${d.sla.geral.sla}%`} detalhe={`${d.sla.geral.fora} fora do prazo de ${d.sla.geral.total}`} tom={d.sla.geral.sla !== null && d.sla.geral.sla < 85 ? "aguardando" : undefined} ir="/painel/sla" />
          <Numero icon={<AlertTriangleIcon />} rotulo="Operações atrasadas" valor={d.operacoes.atrasadas} detalhe={`${d.operacoes.perto} perto do prazo · ${d.operacoes.ativas} ativas`} tom={d.operacoes.atrasadas ? "negativo" : undefined} ir="/operacoes" />
          <Numero icon={<FolderKanbanIcon />} rotulo="Documentos pendentes" valor={d.documentos.faltando + d.documentos.recusados} detalhe={`${d.documentos.vencendo} vencem em breve`} ir="/documentos" />
          {f ? (
            <Numero icon={<WalletIcon />} rotulo="Resultado do mês" valor={dinheiro(f.receita_mes - f.despesa_mes)} detalhe={`Receitas ${dinheiro(f.receita_mes)}`} tom={f.receita_mes - f.despesa_mes < 0 ? "negativo" : undefined} ir="/financeiro" />
          ) : (
            <Numero icon={<ArrowRightLeftIcon />} rotulo="Concluídas no mês" valor={d.operacoes.concluidas_mes} detalhe={`${plural(d.transferencias_mes, "transferência", "transferências")}`} ir="/operacoes" />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <Cartao titulo="Precisa de decisão">
            {decisoes.length === 0 ? (
              <EstadoVazio compact title="Nada pendente" />
            ) : (
              <ul className="flex flex-col">
                {decisoes.map((x) => (
                  <li key={x.id}>
                    <button type="button" onClick={() => navegar(x.ir)} className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left outline-none last:border-b-0 hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.05]">
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full [&>svg]:size-4", x.tom === "negativo" ? "bg-destructive/[0.12] text-destructive" : "bg-amber-500/[0.14] text-amber-600 dark:text-amber-400")}>{x.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{x.texto}</span>
                        <span className="block truncate text-xs text-muted-foreground">{x.detalhe}</span>
                      </span>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao titulo="Operações mais atrasadas" acao="Ver todas" ir="/operacoes">
            {d.atrasadas.length === 0 ? (
              <EstadoVazio compact title="Nenhuma operação atrasada" />
            ) : (
              <ul className="flex flex-col">
                {d.atrasadas.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => navegar(`/operacoes/${o.id}`)} className="flex w-full items-center gap-3 border-b px-4 py-2 text-left text-sm outline-none last:border-b-0 hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.05]">
                      <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{o.codigo}</span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{o.nome}</span>
                        <span className="text-muted-foreground"> · {o.cliente_nome}</span>
                      </span>
                      <span className="hidden w-28 shrink-0 truncate text-muted-foreground lg:block">{o.consultor_nome || "Sem consultor"}</span>
                      <span className="hidden w-28 shrink-0 truncate text-muted-foreground lg:block">{o.etapa_nome}</span>
                      <StatusPill tone="negativo">{virgula(o.dias_atraso)} dias</StatusPill>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>

        {podeCredito && (
          <Cartao titulo="Crédito" acao="Funil" ir="/operacoes/funil" corpo="grid grid-cols-2 gap-px bg-border xl:grid-cols-4">
            <Mini rotulo="No funil" valor={dinheiro(noFunil)} ir="/operacoes/funil" />
            <Mini rotulo="Taxa de aprovação" valor={aprovacao === null ? "—" : `${aprovacao}%`} ir="/operacoes/propostas" />
            <Mini rotulo="Parcelas em atraso" valor={String(PARCELAS.filter((p) => p.situacao === "Atrasada").length)} ir="/carteira/parcelas" />
            <Mini rotulo="Comissão a receber" valor={dinheiro(COMISSOES.filter((c) => c.situacao === "A receber").reduce((t, c) => t + c.comissao, 0))} ir="/financeiro/comissoes" />
          </Cartao>
        )}

        <div className={cn("grid grid-cols-1 gap-4", f ? "xl:grid-cols-3" : "xl:grid-cols-2")}>
          <Cartao titulo={d.ve_tudo ? "SLA por consultor" : "Meu SLA"} acao="Detalhes" ir="/painel/sla" corpo="p-4">
            <Barras
              itens={d.sla.consultores.map((c) => ({ id: c.nome, nome: c.nome, valor: c.sla ?? 0, texto: c.sla === null ? "—" : `${c.sla}%`, alerta: (c.sla ?? 100) < 60 }))}
              maximo={100}
              vazio="Sem medição ainda"
            />
          </Cartao>
          <Cartao titulo={d.ve_tudo ? "Carga por consultor" : "Minha carga"} acao="Operações" ir="/operacoes" corpo="p-4">
            <Barras
              itens={d.carga.map((c) => ({ id: c.nome, nome: c.nome, valor: c.ativas, texto: c.atrasadas ? `${c.ativas} · ${c.atrasadas} atrasadas` : String(c.ativas) }))}
              maximo={Math.max(1, ...d.carga.map((c) => c.ativas))}
              vazio="Nenhuma operação ativa"
            />
          </Cartao>
          {f && (
            <Cartao titulo="Receitas e despesas (6 meses)" acao="Financeiro" ir="/financeiro" corpo="p-4 h-[248px]">
              <BarrasMes meses={f.meses} />
            </Cartao>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ rotulo, valor, ir }: { rotulo: string; valor: string; ir: string }) {
  return (
    <button type="button" onClick={() => navegar(ir)} className="min-w-0 bg-card px-4 py-3 text-left outline-none hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
      <span className="block truncate text-[13px] text-muted-foreground">{rotulo}</span>
      <span className="block truncate text-xl font-semibold tracking-tight tabular-nums">{valor}</span>
    </button>
  );
}

function Numero({ icon, rotulo, valor, detalhe, tom, ir }: { icon: ReactNode; rotulo: string; valor: ReactNode; detalhe: string; tom?: "negativo" | "aguardando"; ir: string }) {
  return (
    <button type="button" onClick={() => navegar(ir)} className="flex min-w-0 items-center gap-3 rounded-[14px] bg-card p-4 text-left outline-none transition-colors hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full [&>svg]:size-5", tom === "negativo" ? "bg-destructive/[0.12] text-destructive" : tom === "aguardando" ? "bg-amber-500/[0.14] text-amber-600 dark:text-amber-400" : "bg-primary/[0.14] text-primary-ink")}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-muted-foreground">{rotulo}</span>
        <span className="block truncate text-2xl leading-tight font-semibold tracking-tight tabular-nums">{valor}</span>
        <span className="block truncate text-xs text-muted-foreground">{detalhe}</span>
      </span>
    </button>
  );
}

function Cartao({ titulo, acao, ir, corpo, children }: { titulo: string; acao?: string; ir?: string; corpo?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[14px] bg-card">
      <header className="flex h-11 items-center border-b px-4">
        <h2 className="flex-1 truncate text-[15px] font-semibold">{titulo}</h2>
        {acao && ir && (
          <button type="button" onClick={() => navegar(ir)} className="rounded-sm text-[13px] text-primary-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            {acao}
          </button>
        )}
      </header>
      <div className={corpo}>{children}</div>
    </section>
  );
}

function Barras({ itens, maximo, vazio }: { itens: { id: string; nome: string; valor: number; texto: string; alerta?: boolean }[]; maximo: number; vazio: string }) {
  if (itens.length === 0) return <EstadoVazio compact title={vazio} />;
  return (
    <ul className="flex flex-col gap-3">
      {itens.map((i) => (
        <li key={i.id} title={`${i.nome}: ${i.texto}`}>
          <div className="mb-1 flex items-baseline gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{i.nome}</span>
            <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">{i.texto}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
            <div className={cn("h-full rounded-full", i.alerta ? "bg-destructive" : "bg-primary")} style={{ width: `${(i.valor / maximo) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
