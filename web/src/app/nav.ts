import {
  ArrowRightLeftIcon,
  BadgePercentIcon,
  CalculatorIcon,
  FileBadgeIcon,
  FileSignatureIcon,
  HandshakeIcon,
  KanbanIcon,
  LandmarkIcon,
  RefreshCwIcon,
  ScaleIcon,
  SearchCheckIcon,
  ShieldCheckIcon,
  TargetIcon,
  WalletCardsIcon,
  BanknoteArrowDownIcon,
  BanknoteArrowUpIcon,
  ChartColumnIcon,
  ClipboardCheckIcon,
  FileSearchIcon,
  FileStackIcon,
  FolderKanbanIcon,
  LayersIcon,
  ListChecksIcon,
  ListIcon,
  ReceiptTextIcon,
  SendIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import type { Modulo } from "@/lib/tipos";
import type { TomFaixa } from "./faixa";

export interface NavPagina {
  id: string;
  label: string;
  icon: LucideIcon;
  tom?: TomFaixa;
  /** O desenho do Prezyn (IconeApp) e a cor, quando o desenho não traz a dele. */
  arte?: string;
  cor?: string;
  caminho: string;
  modulo: Modulo;
}

/** Uma aba: só o nome. As páginas dela ficam na faixa de ferramentas. */
export interface NavAba {
  id: string;
  label: string;
  caminho: string;
  /** Os endereços que contam como esta aba. */
  prefixos: string[];
  modulo: Modulo;
  paginas: NavPagina[];
}

export const NAV: NavAba[] = [
  {
    id: "painel",
    label: "Painel",
    caminho: "/painel",
    prefixos: ["/painel"],
    modulo: "dashboard",
    paginas: [
      { id: "visao", label: "Visão geral", icon: ChartColumnIcon, arte: "painel", caminho: "/painel", modulo: "dashboard" },
      { id: "sla", label: "SLA consultores", icon: UsersIcon, arte: "relatorios", caminho: "/painel/sla", modulo: "sla" },
      { id: "sla-processos", label: "SLA processos", icon: FileStackIcon, arte: "servicos", caminho: "/painel/sla/processos", modulo: "sla" },
      { id: "sla-etapas", label: "SLA etapas", icon: ListIcon, arte: "calendar", cor: "#FF9F0A", caminho: "/painel/sla/etapas", modulo: "sla" },
      { id: "metas", label: "Metas", icon: TargetIcon, arte: "investimentos", caminho: "/painel/metas", modulo: "credito" },
    ],
  },
  {
    id: "operacoes",
    label: "Operações",
    caminho: "/operacoes",
    prefixos: ["/operacoes"],
    modulo: "operacoes",
    paginas: [
      { id: "lista", label: "Operações", icon: FolderKanbanIcon, arte: "orcamentos", caminho: "/operacoes", modulo: "operacoes" },
      { id: "funil", label: "Funil", icon: KanbanIcon, arte: "vendas", caminho: "/operacoes/funil", modulo: "credito" },
      { id: "propostas", label: "Propostas", icon: FileSignatureIcon, arte: "send", cor: "#0A84FF", caminho: "/operacoes/propostas", modulo: "credito" },
      { id: "simulador", label: "Simulador", icon: CalculatorIcon, arte: "calculadora", caminho: "/operacoes/simulador", modulo: "credito" },
      { id: "predefinicoes", label: "Predefinições", icon: LayersIcon, arte: "produtos", caminho: "/operacoes/predefinicoes", modulo: "cadastro_documentos" },
      { id: "transferencias", label: "Transferências", icon: ArrowRightLeftIcon, arte: "refresh", cor: "#5E5CE6", caminho: "/operacoes/transferencias", modulo: "operacoes" },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    caminho: "/clientes",
    prefixos: ["/clientes"],
    modulo: "clientes",
    paginas: [
      { id: "lista", label: "Clientes", icon: UsersIcon, arte: "clientes", caminho: "/clientes", modulo: "clientes" },
      { id: "analise", label: "Análise de crédito", icon: SearchCheckIcon, arte: "relatorios", caminho: "/clientes/analise", modulo: "credito" },
      { id: "garantias", label: "Garantias", icon: ScaleIcon, arte: "contas", caminho: "/clientes/garantias", modulo: "credito" },
    ],
  },
  {
    id: "documentos",
    label: "Documentos",
    caminho: "/documentos",
    prefixos: ["/documentos"],
    modulo: "documentos",
    paginas: [
      { id: "geral", label: "Documentos", icon: FileSearchIcon, arte: "copy", cor: "#0A84FF", caminho: "/documentos", modulo: "documentos" },
      { id: "pedidos", label: "Pedidos", icon: SendIcon, arte: "send", cor: "#0A84FF", caminho: "/documentos/pedidos", modulo: "solicitacoes" },
      { id: "aprovacao", label: "Aprovação", icon: ClipboardCheckIcon, arte: "check", cor: "#30D158", caminho: "/documentos/aprovacao", modulo: "aprovacao" },
      { id: "compliance", label: "Compliance", icon: ShieldCheckIcon, arte: "eye", cor: "#5E5CE6", caminho: "/documentos/compliance", modulo: "compliance" },
      { id: "cadastrados", label: "Cadastrados", icon: ListChecksIcon, arte: "catalogo", caminho: "/documentos/cadastrados", modulo: "cadastro_documentos" },
    ],
  },
  {
    id: "instituicoes",
    label: "Instituições",
    caminho: "/instituicoes",
    prefixos: ["/instituicoes"],
    modulo: "instituicoes",
    paginas: [
      { id: "lista", label: "Instituições", icon: LandmarkIcon, arte: "financeiro", caminho: "/instituicoes", modulo: "instituicoes" },
      { id: "produtos", label: "Produtos e taxas", icon: BadgePercentIcon, arte: "socios", caminho: "/instituicoes/produtos", modulo: "instituicoes" },
    ],
  },
  {
    id: "carteira",
    label: "Carteira",
    caminho: "/carteira",
    prefixos: ["/carteira"],
    modulo: "carteira",
    paginas: [
      { id: "contratos", label: "Contratos", icon: FileBadgeIcon, arte: "contas", caminho: "/carteira", modulo: "carteira" },
      { id: "parcelas", label: "Parcelas", icon: WalletCardsIcon, arte: "receber", caminho: "/carteira/parcelas", modulo: "carteira" },
      { id: "renovacoes", label: "Renovações", icon: RefreshCwIcon, arte: "refresh", cor: "#30D158", caminho: "/carteira/renovacoes", modulo: "carteira" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    caminho: "/financeiro",
    prefixos: ["/financeiro"],
    modulo: "financeiro",
    paginas: [
      { id: "visao", label: "Visão geral", icon: ChartColumnIcon, arte: "financeiro", caminho: "/financeiro", modulo: "financeiro" },
      { id: "receitas", label: "Receitas", icon: BanknoteArrowUpIcon, tom: "verde", arte: "receber", caminho: "/financeiro/receitas", modulo: "financeiro" },
      { id: "despesas", label: "Despesas", icon: BanknoteArrowDownIcon, tom: "vermelho", arte: "pagar", caminho: "/financeiro/despesas", modulo: "financeiro" },
      { id: "extrato", label: "Extrato", icon: ReceiptTextIcon, arte: "contas", caminho: "/financeiro/extrato", modulo: "financeiro" },
      { id: "comissoes", label: "Comissões", icon: HandshakeIcon, arte: "investimentos", caminho: "/financeiro/comissoes", modulo: "comissoes" },
    ],
  },
  { id: "agenda", label: "Agenda", caminho: "/agenda", prefixos: ["/agenda"], modulo: "credito", paginas: [] },
];
