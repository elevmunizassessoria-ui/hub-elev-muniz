import {
  BanknoteArrowDownIcon,
  CalculatorIcon,
  ChartColumnIcon,
  FileSearchIcon,
  FileSignatureIcon,
  FolderKanbanIcon,
  GaugeIcon,
  HandshakeIcon,
  KanbanIcon,
  LayersIcon,
  ListChecksIcon,
  SearchCheckIcon,
  TargetIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import type { Modulo } from "@/lib/tipos";

/** Uma das escolhas do menu de uma ferramenta (ex.: o SLA por consultor, processo ou etapa). */
export interface NavOpcao {
  label: string;
  caminho: string;
  modulo: Modulo;
}

/** Uma ferramenta da faixa: abre uma tela; com `opcoes`, abre um menu com as telas dela. */
export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** O desenho do Prezyn (IconeApp) e a cor, quando o desenho não traz a dele. */
  arte?: string;
  cor?: string;
  caminho: string;
  /** Os endereços que contam como esta ferramenta (para ela ficar acesa). */
  prefixos: string[];
  modulo: Modulo;
  opcoes?: NavOpcao[];
}

export interface NavGrupo {
  titulo: string;
  itens: NavItem[];
}

/**
 * A navegação (pedido do dono, 16/11/2026: "não precisa das abas, ter apenas as ferramentas divididas por grupo").
 * Clientes só cadastra; tudo da operação fica em Operações; Parceiros no lugar de Instituições; sem Carteira nem Agenda.
 */
export const NAV: NavGrupo[] = [
  {
    titulo: "Painel",
    itens: [
      { id: "painel", label: "Painel", icon: ChartColumnIcon, arte: "painel", caminho: "/painel", prefixos: ["/painel"], modulo: "dashboard" },
      {
        id: "sla",
        label: "SLA",
        icon: GaugeIcon,
        arte: "relatorios",
        caminho: "/painel/sla",
        prefixos: ["/painel/sla"],
        modulo: "sla",
        opcoes: [
          { label: "Por consultor", caminho: "/painel/sla", modulo: "sla" },
          { label: "Por processo", caminho: "/painel/sla/processos", modulo: "sla" },
          { label: "Por etapa", caminho: "/painel/sla/etapas", modulo: "sla" },
        ],
      },
      { id: "metas", label: "Metas", icon: TargetIcon, arte: "investimentos", caminho: "/painel/metas", prefixos: ["/painel/metas"], modulo: "credito" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { id: "clientes", label: "Clientes", icon: UsersIcon, arte: "clientes", caminho: "/clientes", prefixos: ["/clientes"], modulo: "clientes" },
      { id: "parceiros", label: "Parceiros", icon: HandshakeIcon, arte: "socios", caminho: "/parceiros", prefixos: ["/parceiros"], modulo: "instituicoes" },
    ],
  },
  {
    titulo: "Operações",
    itens: [
      {
        id: "operacoes",
        label: "Operações",
        icon: FolderKanbanIcon,
        arte: "orcamentos",
        caminho: "/operacoes",
        prefixos: ["/operacoes"],
        modulo: "operacoes",
        opcoes: [
          { label: "Todas as operações", caminho: "/operacoes", modulo: "operacoes" },
          { label: "Transferências", caminho: "/operacoes/transferencias", modulo: "operacoes" },
        ],
      },
      { id: "funil", label: "Funil", icon: KanbanIcon, arte: "vendas", caminho: "/operacoes/funil", prefixos: ["/operacoes/funil"], modulo: "credito" },
      { id: "propostas", label: "Propostas", icon: FileSignatureIcon, arte: "send", cor: "#0A84FF", caminho: "/operacoes/propostas", prefixos: ["/operacoes/propostas"], modulo: "credito" },
      {
        id: "documentos",
        label: "Documentos",
        icon: FileSearchIcon,
        arte: "copy",
        cor: "#0A84FF",
        caminho: "/documentos",
        prefixos: ["/documentos"],
        modulo: "documentos",
        opcoes: [
          { label: "Todos os documentos", caminho: "/documentos", modulo: "documentos" },
          { label: "Pedidos ao cliente", caminho: "/documentos/pedidos", modulo: "solicitacoes" },
          { label: "Aprovação", caminho: "/documentos/aprovacao", modulo: "aprovacao" },
        ],
      },
      {
        id: "credito",
        label: "Crédito",
        icon: SearchCheckIcon,
        arte: "relatorios",
        caminho: "/operacoes/analise",
        prefixos: ["/operacoes/analise", "/operacoes/garantias", "/operacoes/compliance"],
        modulo: "credito",
        opcoes: [
          { label: "Análise de crédito", caminho: "/operacoes/analise", modulo: "credito" },
          { label: "Garantias", caminho: "/operacoes/garantias", modulo: "credito" },
          { label: "Compliance", caminho: "/operacoes/compliance", modulo: "compliance" },
        ],
      },
      { id: "simulador", label: "Simulador", icon: CalculatorIcon, arte: "calculadora", caminho: "/operacoes/simulador", prefixos: ["/operacoes/simulador"], modulo: "credito" },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      {
        id: "financeiro",
        label: "Financeiro",
        icon: WalletIcon,
        arte: "financeiro",
        caminho: "/financeiro",
        prefixos: ["/financeiro"],
        modulo: "financeiro",
        opcoes: [
          { label: "Visão geral", caminho: "/financeiro", modulo: "financeiro" },
          { label: "Receitas", caminho: "/financeiro/receitas", modulo: "financeiro" },
          { label: "Despesas", caminho: "/financeiro/despesas", modulo: "financeiro" },
          { label: "Extrato", caminho: "/financeiro/extrato", modulo: "financeiro" },
        ],
      },
      { id: "comissoes", label: "Comissões", icon: BanknoteArrowDownIcon, arte: "receber", caminho: "/financeiro/comissoes", prefixos: ["/financeiro/comissoes"], modulo: "comissoes" },
    ],
  },
  {
    titulo: "Modelos",
    itens: [
      { id: "predefinicoes", label: "Predefinições", icon: LayersIcon, arte: "produtos", caminho: "/operacoes/predefinicoes", prefixos: ["/operacoes/predefinicoes"], modulo: "cadastro_documentos" },
      { id: "tipos", label: "Documentos base", icon: ListChecksIcon, arte: "catalogo", caminho: "/documentos/cadastrados", prefixos: ["/documentos/cadastrados"], modulo: "cadastro_documentos" },
    ],
  },
];

/** Todas as telas, na ordem da faixa: a primeira liberada é a de entrada. */
export const TODAS = NAV.flatMap((g) => g.itens.flatMap((i) => [i, ...(i.opcoes ?? [])]));

/** A ferramenta acesa: a de prefixo mais longo que bate com o endereço. */
export function itemAtual(caminho: string): NavItem | undefined {
  let melhor: NavItem | undefined;
  let tamanho = -1;
  for (const g of NAV) {
    for (const i of g.itens) {
      for (const p of i.prefixos) {
        if ((caminho === p || caminho.startsWith(`${p}/`)) && p.length > tamanho) {
          melhor = i;
          tamanho = p.length;
        }
      }
    }
  }
  return melhor;
}
