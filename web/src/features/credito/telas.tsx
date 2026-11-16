import { BanIcon, BellRingIcon, CheckIcon, FileSignatureIcon, HandCoinsIcon, PencilIcon, RefreshCwIcon, SendIcon, ShieldCheckIcon, XIcon } from "lucide-react";

import { MoneyCell, type ReportColumn } from "@/components/ReportTable";
import { StatusPill, type StatusTone } from "@/components/StatusPill";
import { dataBR, dinheiro } from "@/lib/formato";
import { TelaEsqueleto } from "./TelaEsqueleto";
import { BANCOS, PRODUTOS, useCredito } from "./dados";

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
        { id: "b", header: "Instituição", width: "9rem", cell: (l) => l.banco },
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
              { label: "Instituição", required: true, opcoes: BANCOS },
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
      migalhas={[{ label: "Clientes", caminho: "/clientes" }, { label: "Análise de crédito" }]}
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
      migalhas={[{ label: "Clientes", caminho: "/clientes" }, { label: "Garantias" }]}
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
      migalhas={[{ label: "Documentos", caminho: "/documentos" }, { label: "Compliance" }]}
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

export function InstituicoesView() {
  const D = useCredito();
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Instituições" }]}
      rotulo="Instituições"
      linhas={D.INSTITUICOES}
      chave={(l) => l.nome}
      situacao={(l) => l.situacao}
      textoBusca={(l) => `${l.nome} ${l.tipo} ${l.gerente}`}
      colunas={[
        { id: "n", header: "Instituição", primary: true, cell: (l) => <span className="font-medium">{l.nome}</span> },
        { id: "t", header: "Tipo", width: "8rem", cell: (l) => l.tipo },
        { id: "g", header: "Gerente", width: "13rem", hideBelow: "lg", cell: (l) => l.gerente },
        { id: "p", header: "Propostas (12m)", width: "8rem", type: "number", cell: (l) => l.propostas },
        { id: "a", header: "Aprovação", width: "7rem", type: "number", cell: (l) => pct(l.aprovacao) },
        { id: "r", header: "Resposta (dias)", width: "8rem", type: "number", hideBelow: "xl", cell: (l) => l.resposta },
        { id: "c", header: "Comissão padrão", width: "8.5rem", type: "number", hideBelow: "xl", cell: (l) => pct(l.comissao) },
        { id: "s", header: "Situação", width: "6.5rem", cell: (l) => <Pill t={l.situacao} /> },
      ]}
      acoes={[{ id: "ed", label: "Editar instituição", icon: PencilIcon }, { id: "ina", label: "Inativar", icon: BanIcon, destructive: true }]}
      form={{
        acao: "Adicionar instituição",
        titulo: "Nova instituição",
        secoes: [
          { titulo: "Instituição", campos: [{ label: "Nome", required: true }, { label: "Tipo", opcoes: ["Banco", "Cooperativa", "Fintech", "FIDC"] }, { label: "CNPJ" }, { label: "Comissão padrão (%)", tipo: "numero" }] },
          { titulo: "Contato", campos: [{ label: "Gerente" }, { label: "Telefone" }, { label: "E-mail", inteiro: true }] },
        ],
      }}
    />
  );
}

export function ProdutosView() {
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Instituições", caminho: "/instituicoes" }, { label: "Produtos e taxas" }]}
      rotulo="Produtos e taxas"
      linhas={PRODUTOS}
      chave={(l) => `${l.nome}-${l.banco}`}
      situacao={(l) => l.modalidade}
      textoBusca={(l) => `${l.nome} ${l.banco} ${l.modalidade} ${l.garantia}`}
      colunas={[
        { id: "n", header: "Produto", primary: true, cell: (l) => <span className="font-medium">{l.nome}</span> },
        { id: "b", header: "Instituição", width: "10rem", cell: (l) => l.banco },
        { id: "m", header: "Modalidade", width: "9rem", cell: (l) => l.modalidade },
        { id: "t", header: "Taxa a.m.", width: "9rem", type: "number", cell: (l) => `${pct(l.taxaMin)} a ${pct(l.taxaMax)}` },
        { id: "pz", header: "Prazo máx.", width: "6.5rem", type: "number", cell: (l) => `${l.prazo}x` },
        dinheiroCol("v", "Valor máx.", (l: (typeof PRODUTOS)[number]) => l.teto),
        { id: "g", header: "Garantia", width: "9rem", hideBelow: "xl", cell: (l) => l.garantia },
        { id: "c", header: "Comissão", width: "6.5rem", type: "number", hideBelow: "xl", cell: (l) => pct(l.comissao) },
      ]}
      acoes={[{ id: "ed", label: "Editar produto", icon: PencilIcon }]}
      form={{
        acao: "Adicionar produto",
        titulo: "Novo produto de crédito",
        secoes: [{ titulo: "Produto", campos: [{ label: "Nome", required: true }, { label: "Instituição", required: true, opcoes: BANCOS }, { label: "Modalidade", opcoes: ["Capital de giro", "Antecipação", "Financiamento", "Home equity", "Crédito rural"] }, { label: "Garantia", opcoes: ["Imóvel", "Veículo", "Recebíveis", "Aval", "Sem garantia"] }, { label: "Taxa mínima a.m. (%)", tipo: "numero" }, { label: "Taxa máxima a.m. (%)", tipo: "numero" }, { label: "Prazo máximo (meses)", tipo: "numero" }, { label: "Valor máximo (R$)", tipo: "numero" }, { label: "Comissão (%)", tipo: "numero" }] }],
      }}
    />
  );
}

export function ContratosView() {
  const D = useCredito();
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Carteira", caminho: "/carteira" }, { label: "Contratos" }]}
      rotulo="Contratos"
      abrir={(l) => `/operacoes/${l.operacao_id}`}
      linhas={D.CONTRATOS}
      chave={(l) => l.codigo}
      situacao={(l) => l.situacao}
      textoBusca={(l) => `${l.codigo} ${l.cliente} ${l.banco} ${l.produto} ${l.consultor}`}
      colunas={[
        { id: "c", header: "Código", width: "6.5rem", cell: (l) => l.codigo },
        { id: "cl", header: "Cliente", primary: true, cell: (l) => <span className="font-medium">{l.cliente}</span> },
        { id: "b", header: "Instituição", width: "9rem", cell: (l) => l.banco },
        { id: "pr", header: "Produto", width: "10rem", hideBelow: "xl", cell: (l) => l.produto },
        dinheiroCol("v", "Liberado", (l: (typeof D.CONTRATOS)[number]) => l.liberado),
        dinheiroCol("sd", "Saldo devedor", (l: (typeof D.CONTRATOS)[number]) => l.saldo),
        { id: "pa", header: "Parcelas", width: "6rem", type: "number", cell: (l) => `${l.pagas}/${l.total}` },
        { id: "pv", header: "Próx. vencimento", width: "8rem", type: "date", hideBelow: "lg", cell: (l) => dataBR(l.proximo) },
        { id: "s", header: "Situação", width: "7.5rem", cell: (l) => <Pill t={l.situacao} /> },
      ]}
      acoes={[
        { id: "bx", label: "Ver parcelas", icon: HandCoinsIcon },
        { id: "ren", label: "Renegociar", icon: RefreshCwIcon },
        { id: "cob", label: "Cobrar cliente", icon: BellRingIcon },
      ]}
      form={{
        acao: "Adicionar contrato",
        titulo: "Novo contrato",
        secoes: [
          { titulo: "Contrato", campos: [{ label: "Cliente", required: true, opcoes: D.CLIENTES }, { label: "Instituição", required: true, opcoes: BANCOS }, { label: "Produto", opcoes: PRODUTOS.map((p) => p.nome) }, { label: "Número no banco" }] },
          { titulo: "Valores", campos: [{ label: "Valor liberado (R$)", tipo: "numero", required: true }, { label: "Data de liberação", tipo: "data" }, { label: "Parcelas", tipo: "numero" }, { label: "Taxa a.m. (%)", tipo: "numero" }] },
        ],
      }}
    />
  );
}

export function ParcelasView() {
  const D = useCredito();
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Carteira", caminho: "/carteira" }, { label: "Parcelas" }]}
      rotulo="Parcelas"
      abrir={(l) => `/operacoes/${l.operacao_id}`}
      linhas={D.PARCELAS}
      chave={(l) => `${l.contrato}-${l.numero}`}
      situacao={(l) => l.situacao}
      textoBusca={(l) => `${l.contrato} ${l.cliente}`}
      colunas={[
        { id: "c", header: "Contrato", width: "7rem", cell: (l) => l.contrato },
        { id: "cl", header: "Cliente", primary: true, cell: (l) => <span className="font-medium">{l.cliente}</span> },
        { id: "n", header: "Parcela", width: "6rem", type: "number", cell: (l) => `${l.numero}/${l.total}` },
        { id: "v", header: "Vencimento", width: "7rem", type: "date", cell: (l) => dataBR(l.vencimento) },
        dinheiroCol("va", "Valor", (l: (typeof D.PARCELAS)[number]) => l.valor),
        { id: "s", header: "Situação", width: "7rem", cell: (l) => <Pill t={l.situacao} /> },
      ]}
      acoes={[
        { id: "pg", label: "Baixar", icon: CheckIcon, main: true, varias: true },
        { id: "cob", label: "Cobrar cliente", icon: BellRingIcon, varias: true },
      ]}
    />
  );
}

export function RenovacoesView() {
  const D = useCredito();
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Carteira", caminho: "/carteira" }, { label: "Renovações" }]}
      rotulo="Renovações"
      abrir={(l) => `/operacoes/${l.operacao_id}`}
      linhas={D.RENOVACOES}
      chave={(l) => l.contrato}
      situacao={(l) => l.situacao}
      textoBusca={(l) => `${l.contrato} ${l.cliente} ${l.consultor}`}
      colunas={[
        { id: "c", header: "Contrato", width: "7rem", cell: (l) => l.contrato },
        { id: "cl", header: "Cliente", primary: true, cell: (l) => <span className="font-medium">{l.cliente}</span> },
        { id: "t", header: "Termina em", width: "7rem", type: "date", cell: (l) => dataBR(l.termina) },
        dinheiroCol("sd", "Saldo devedor", (l: (typeof D.RENOVACOES)[number]) => l.saldo),
        dinheiroCol("po", "Potencial", (l: (typeof D.RENOVACOES)[number]) => l.potencial),
        { id: "co", header: "Consultor", width: "9rem", cell: (l) => l.consultor },
        { id: "s", header: "Situação", width: "7.5rem", cell: (l) => <Pill t={l.situacao} /> },
      ]}
      acoes={[
        { id: "prop", label: "Criar proposta", icon: FileSignatureIcon, main: true },
        { id: "con", label: "Registrar contato", icon: BellRingIcon },
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
        { id: "b", header: "Instituição", width: "8rem", hideBelow: "lg", cell: (l) => l.banco },
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

export function AgendaView() {
  const D = useCredito();
  return (
    <TelaEsqueleto
      migalhas={[{ label: "Agenda" }]}
      rotulo="Agenda"
      abrir={(l) => `/operacoes/${l.operacao_id}`}
      linhas={D.AGENDA}
      chave={(l) => `${l.quando}-${l.assunto}`}
      situacao={(l) => l.situacao}
      textoBusca={(l) => `${l.cliente} ${l.assunto} ${l.responsavel} ${l.tipo}`}
      colunas={[
        { id: "q", header: "Data", width: "7rem", type: "date", cell: (l) => dataBR(l.quando) },
        { id: "t", header: "Tipo", width: "9rem", cell: (l) => l.tipo },
        { id: "a", header: "Assunto", primary: true, cell: (l) => <span className="font-medium">{l.assunto}</span> },
        { id: "c", header: "Cliente", width: "14rem", cell: (l) => l.cliente },
        { id: "r", header: "Responsável", width: "9rem", cell: (l) => l.responsavel },
        { id: "s", header: "Situação", width: "7rem", cell: (l) => <Pill t={l.situacao} /> },
      ]}
      acoes={[
        { id: "ok", label: "Concluir", icon: CheckIcon, main: true, varias: true },
        { id: "ed", label: "Editar", icon: PencilIcon },
      ]}
      form={{ acao: "Adicionar compromisso", titulo: "Novo compromisso", secoes: [{ titulo: "Compromisso", campos: [{ label: "Assunto", required: true, inteiro: true }, { label: "Tipo", opcoes: ["Ligação", "Reunião", "Cobrar documentos", "Retorno do banco", "Renovação"] }, { label: "Data", tipo: "data", required: true }, { label: "Cliente", opcoes: D.CLIENTES }, { label: "Responsável", opcoes: D.CONSULTORES }, { label: "Observação", tipo: "area" }] }] }}
    />
  );
}
