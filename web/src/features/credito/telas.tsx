import { CheckIcon, FileSignatureIcon, HandCoinsIcon, PencilIcon, RefreshCwIcon, SendIcon, ShieldCheckIcon, XIcon } from "lucide-react";

import { MoneyCell, type ReportColumn } from "@/components/ReportTable";
import { StatusPill, type StatusTone } from "@/components/StatusPill";
import { dataBR, dinheiro } from "@/lib/formato";
import { TelaEsqueleto } from "./TelaEsqueleto";
import { PRODUTOS, useCredito } from "./dados";

const TOM: Record<string, StatusTone> = {
  "Em análise": "andamento", Aprovada: "concluido", Recusada: "negativo", Contraproposta: "aguardando", Rascunho: "neutro",
  Baixo: "concluido", Médio: "aguardando", Alto: "negativo",
  Vigente: "concluido", "Vence em breve": "aguardando", Vencida: "negativo", "Em avaliação": "andamento",
  "Em dia": "concluido", "Em atraso": "negativo", Quitado: "neutro", Renegociado: "aguardando",
  Paga: "concluido", "A vencer": "neutro", Atrasada: "negativo",
  "A receber": "aguardando", Recebida: "andamento", Repassada: "concluido",
  "Em conversa": "andamento", "A contatar": "aguardando", Renovado: "concluido", Perdido: "neutro",
  Regular: "concluido", Pendente: "aguardando", Irregular: "negativo",
  Ativa: "concluido", Inativa: "neutro",
  Ok: "concluido", Falta: "negativo", Atenção: "aguardando",
  Hoje: "aguardando", Próximos: "neutro", Feito: "concluido", Atrasado: "negativo",
};
const Pill = ({ t }: { t: string }) => <StatusPill tone={TOM[t] ?? "neutro"}>{t}</StatusPill>;
const Din = ({ v }: { v: number }) => <MoneyCell text={dinheiro(v)} />;
const pct = (v: number) => `${String(v).replace(".", ",")}%`;

const dinheiroCol = <T,>(id: string, header: string, f: (r: T) => number): ReportColumn<T> => ({ id, header, width: "9rem", type: "money", cell: (r) => <Din v={f(r)} /> });


export function PropostasView() {
  const D = useCredito();
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Operações", caminho: "/operacoes" }, { label: "Propostas" }]}
      rotulo="Propostas"
      abrir={(l) => `/operacoes/${l.operacao_id}`}
      linhas={D.PROPOSTAS}
      chave={(l) => l.codigo}
      situacao={(l) => l.situacao}
      textoBusca={(l) => `${l.codigo} ${l.cliente} ${l.banco} ${l.produto} ${l.consultor}`}
      colunas={[
        { id: "c", header: "Código", width: "6.5rem", cell: (l) => l.codigo },
        { id: "cl", header: "Cliente", primary: true, cell: (l) => <span className="font-medium">{l.cliente}</span> },
        { id: "p", header: "Produto", width: "11rem", hideBelow: "lg", cell: (l) => l.produto },
        { id: "b", header: "Parceiro", width: "9rem", cell: (l) => l.banco },
        dinheiroCol("v", "Valor", (l: (typeof D.PROPOSTAS)[number]) => l.valor),
        { id: "t", header: "Taxa a.m.", width: "6rem", type: "number", cell: (l) => pct(l.taxa) },
        { id: "pz", header: "Prazo", width: "5.5rem", type: "number", hideBelow: "xl", cell: (l) => `${l.prazo}x` },
        { id: "e", header: "Enviada em", width: "7rem", type: "date", hideBelow: "xl", cell: (l) => dataBR(l.enviada) },
        { id: "co", header: "Consultor", width: "9rem", hideBelow: "2xl", cell: (l) => l.consultor },
        { id: "s", header: "Situação", width: "9rem", cell: (l) => <Pill t={l.situacao} /> },
      ]}
      acoes={[
        { id: "resp", label: "Registrar resposta", icon: CheckIcon, main: true },
        { id: "cont", label: "Gerar contrato", icon: FileSignatureIcon },
        { id: "reenv", label: "Enviar a outro banco", icon: SendIcon },
        { id: "rec", label: "Cancelar", icon: XIcon, destructive: true },
      ]}
      form={{
        acao: "Adicionar proposta",
        titulo: "Nova proposta",
        secoes: [
          { titulo: "Operação", campos: [{ label: "Cliente", required: true, opcoes: D.CLIENTES }, { label: "Operação", opcoes: D.OPERACOES }] },
          {
            titulo: "Condições",
            campos: [
              { label: "Parceiro", required: true, opcoes: D.BANCOS },
              { label: "Produto", required: true, opcoes: PRODUTOS.map((p) => p.nome) },
              { label: "Valor (R$)", tipo: "numero", required: true },
              { label: "Prazo (meses)", tipo: "numero" },
              { label: "Taxa a.m. (%)", tipo: "numero" },
              { label: "Garantia", opcoes: ["Imóvel", "Veículo", "Recebíveis", "Aval", "Sem garantia"] },
            ],
          },
          { titulo: "Observação", campos: [{ label: "Observação", tipo: "area" }] },
        ],
      }}
    />
  );
}

export function AnaliseCreditoView() {
  const D = useCredito();
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Operações", caminho: "/operacoes" }, { label: "Análise de crédito" }]}
      rotulo="Análise de crédito"
      abrir={(l) => `/clientes/${l.cliente_id}`}
      linhas={D.ANALISES}
      chave={(l) => l.cliente}
      situacao={(l) => l.risco}
      textoBusca={(l) => `${l.cliente} ${l.risco} ${l.restricoes}`}
      colunas={[
        { id: "cl", header: "Cliente", primary: true, cell: (l) => <span className="font-medium">{l.cliente}</span> },
        dinheiroCol("f", "Faturamento anual", (l: (typeof D.ANALISES)[number]) => l.faturamento),
        { id: "e", header: "Endividamento", width: "8rem", type: "number", cell: (l) => pct(l.endividamento) },
        { id: "sc", header: "Score", width: "5rem", type: "number", cell: (l) => l.score },
        { id: "re", header: "Restrições", width: "11rem", hideBelow: "lg", cell: (l) => l.restricoes },
        dinheiroCol("li", "Limite sugerido", (l: (typeof D.ANALISES)[number]) => l.limite),
        { id: "va", header: "Válida até", width: "7rem", type: "date", hideBelow: "xl", cell: (l) => dataBR(l.validade) },
        { id: "ri", header: "Risco", width: "6rem", cell: (l) => <Pill t={l.risco} /> },
      ]}
      acoes={[
        { id: "ed", label: "Editar análise", icon: PencilIcon },
        { id: "at", label: "Refazer consulta", icon: RefreshCwIcon },
      ]}
      form={{
        acao: "Adicionar análise",
        titulo: "Nova análise de crédito",
        secoes: [
          { titulo: "Cliente", campos: [{ label: "Cliente", required: true, opcoes: D.CLIENTES, inteiro: true }] },
          { titulo: "Financeiro", campos: [{ label: "Faturamento anual (R$)", tipo: "numero" }, { label: "Dívida total (R$)", tipo: "numero" }, { label: "Lucro líquido (R$)", tipo: "numero" }, { label: "Capacidade mensal de pagamento (R$)", tipo: "numero" }] },
          { titulo: "Consultas", campos: [{ label: "Score", tipo: "numero" }, { label: "Restrições", opcoes: ["Nenhuma", "Protesto", "Pefin", "Ação judicial"] }, { label: "Data da consulta", tipo: "data" }, { label: "Válida até", tipo: "data" }] },
          { titulo: "Parecer", campos: [{ label: "Risco", opcoes: ["Baixo", "Médio", "Alto"] }, { label: "Limite sugerido (R$)", tipo: "numero" }, { label: "Parecer", tipo: "area" }] },
        ],
      }}
    />
  );
}

export function GarantiasView() {
  const D = useCredito();
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Operações", caminho: "/operacoes" }, { label: "Garantias" }]}
      rotulo="Garantias"
      abrir={(l) => `/operacoes/${l.operacao_id}`}
      linhas={D.GARANTIAS}
      chave={(l) => l.codigo}
      situacao={(l) => l.situacao}
      textoBusca={(l) => `${l.codigo} ${l.cliente} ${l.tipo} ${l.descricao}`}
      colunas={[
        { id: "c", header: "Código", width: "6.5rem", cell: (l) => l.codigo },
        { id: "cl", header: "Cliente", width: "14rem", cell: (l) => <span className="font-medium">{l.cliente}</span> },
        { id: "t", header: "Tipo", width: "8rem", cell: (l) => l.tipo },
        { id: "d", header: "Descrição", primary: true, cell: (l) => l.descricao },
        dinheiroCol("v", "Valor avaliado", (l: (typeof D.GARANTIAS)[number]) => l.valor),
        { id: "ve", header: "Laudo vence", width: "7rem", type: "date", cell: (l) => dataBR(l.vence) },
        { id: "s", header: "Situação", width: "9rem", cell: (l) => <Pill t={l.situacao} /> },
      ]}
      acoes={[{ id: "ed", label: "Editar garantia", icon: PencilIcon }]}
      form={{
        acao: "Adicionar garantia",
        titulo: "Nova garantia",
        secoes: [{ titulo: "Garantia", campos: [{ label: "Cliente", required: true, opcoes: D.CLIENTES }, { label: "Tipo", required: true, opcoes: ["Imóvel", "Veículo", "Recebíveis", "Aval", "Equipamento"] }, { label: "Descrição", inteiro: true }, { label: "Valor avaliado (R$)", tipo: "numero" }, { label: "Laudo vence em", tipo: "data" }] }],
      }}
    />
  );
}

export function ComplianceView() {
  const D = useCredito();
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Operações", caminho: "/operacoes" }, { label: "Compliance" }]}
      rotulo="Compliance"
      abrir={(l) => `/clientes/${l.cliente_id}`}
      linhas={D.COMPLIANCE}
      chave={(l) => l.cliente}
      situacao={(l) => l.situacao}
      textoBusca={(l) => l.cliente}
      colunas={[
        { id: "cl", header: "Cliente", primary: true, cell: (l) => <span className="font-medium">{l.cliente}</span> },
        { id: "k", header: "Cadastro (KYC)", width: "8rem", cell: (l) => <Pill t={l.kyc} /> },
        { id: "pe", header: "PEP e listas", width: "8rem", cell: (l) => <Pill t={l.listas} /> },
        { id: "lg", header: "Consentimento LGPD", width: "10rem", cell: (l) => <Pill t={l.lgpd} /> },
        { id: "sc", header: "Autorização SCR", width: "9rem", cell: (l) => <Pill t={l.scr} /> },
        { id: "va", header: "Revisar em", width: "7rem", type: "date", cell: (l) => dataBR(l.revisar) },
        { id: "s", header: "Situação", width: "7rem", cell: (l) => <Pill t={l.situacao} /> },
      ]}
      acoes={[
        { id: "rev", label: "Registrar revisão", icon: ShieldCheckIcon, main: true },
        { id: "ped", label: "Pedir autorização", icon: SendIcon },
      ]}
    />
  );
}






export function ComissoesView() {
  const D = useCredito();
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Financeiro", caminho: "/financeiro" }, { label: "Comissões" }]}
      rotulo="Comissões"
      abrir={(l) => `/operacoes/${l.operacao_id}`}
      linhas={D.COMISSOES}
      chave={(l) => l.contrato}
      situacao={(l) => l.situacao}
      textoBusca={(l) => `${l.contrato} ${l.cliente} ${l.banco} ${l.consultor}`}
      colunas={[
        { id: "c", header: "Contrato", width: "7rem", cell: (l) => l.contrato },
        { id: "cl", header: "Cliente", primary: true, cell: (l) => <span className="font-medium">{l.cliente}</span> },
        { id: "b", header: "Parceiro", width: "8rem", hideBelow: "lg", cell: (l) => l.banco },
        { id: "co", header: "Consultor", width: "9rem", cell: (l) => l.consultor },
        dinheiroCol("li", "Liberado", (l: (typeof D.COMISSOES)[number]) => l.liberado),
        { id: "p", header: "%", width: "4.5rem", type: "number", cell: (l) => pct(l.percentual) },
        dinheiroCol("br", "Comissão", (l: (typeof D.COMISSOES)[number]) => l.comissao),
        dinheiroCol("re", "Repasse consultor", (l: (typeof D.COMISSOES)[number]) => l.repasse),
        { id: "pv", header: "Previsão", width: "7rem", type: "date", hideBelow: "xl", cell: (l) => dataBR(l.previsao) },
        { id: "s", header: "Situação", width: "7.5rem", cell: (l) => <Pill t={l.situacao} /> },
      ]}
      acoes={[
        { id: "rec", label: "Marcar recebida", icon: CheckIcon, main: true, varias: true },
        { id: "rep", label: "Marcar repassada", icon: HandCoinsIcon, varias: true },
      ]}
    />
  );
}

export function MetasView() {
  const D = useCredito();
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Painel", caminho: "/painel" }, { label: "Metas" }]}
      rotulo="Metas"
      linhas={D.METAS}
      chave={(l) => l.consultor}
      textoBusca={(l) => l.consultor}
      colunas={[
        { id: "c", header: "Consultor", primary: true, cell: (l) => <span className="font-medium">{l.consultor}</span> },
        dinheiroCol("m", "Meta do mês", (l: (typeof D.METAS)[number]) => l.meta),
        dinheiroCol("r", "Liberado", (l: (typeof D.METAS)[number]) => l.realizado),
        { id: "a", header: "Atingido", width: "7rem", center: true, cell: (l) => <StatusPill tone={l.realizado / l.meta >= 1 ? "concluido" : l.realizado / l.meta >= 0.7 ? "aguardando" : "negativo"}>{Math.round((l.realizado / l.meta) * 100)}%</StatusPill> },
        { id: "p", header: "Propostas", width: "6.5rem", type: "number", cell: (l) => l.propostas },
        { id: "ap", header: "Aprovadas", width: "6.5rem", type: "number", cell: (l) => l.aprovadas },
        { id: "co", header: "Conversão", width: "6.5rem", type: "number", cell: (l) => pct(Math.round((l.aprovadas / l.propostas) * 100)) },
      ]}
      acoes={[{ id: "ed", label: "Definir meta", icon: PencilIcon }]}
      form={{ acao: "Adicionar meta", titulo: "Nova meta", secoes: [{ titulo: "Meta", campos: [{ label: "Consultor", required: true, opcoes: D.CONSULTORES }, { label: "Mês", tipo: "data" }, { label: "Valor liberado (R$)", tipo: "numero" }, { label: "Propostas", tipo: "numero" }] }] }}
    />
  );
}

