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
      { id: "visao", label: "Visão geral", icon: ChartColumnIcon, caminho: "/painel", modulo: "dashboard" },
      { id: "sla", label: "SLA consultores", icon: UsersIcon, caminho: "/painel/sla", modulo: "sla" },
      { id: "sla-processos", label: "SLA processos", icon: FileStackIcon, caminho: "/painel/sla/processos", modulo: "sla" },
      { id: "sla-etapas", label: "SLA etapas", icon: ListIcon, caminho: "/painel/sla/etapas", modulo: "sla" },
      { id: "metas", label: "Metas", icon: TargetIcon, caminho: "/painel/metas", modulo: "credito" },
    ],
  },
  {
    id: "operacoes",
    label: "Operações",
    caminho: "/operacoes",
    prefixos: ["/operacoes"],
    modulo: "operacoes",
    paginas: [
      { id: "lista", label: "Operações", icon: FolderKanbanIcon, caminho: "/operacoes", modulo: "operacoes" },
      { id: "funil", label: "Funil", icon: KanbanIcon, caminho: "/operacoes/funil", modulo: "credito" },
      { id: "propostas", label: "Propostas", icon: FileSignatureIcon, caminho: "/operacoes/propostas", modulo: "credito" },
      { id: "simulador", label: "Simulador", icon: CalculatorIcon, caminho: "/operacoes/simulador", modulo: "credito" },
      { id: "predefinicoes", label: "Predefinições", icon: LayersIcon, caminho: "/operacoes/predefinicoes", modulo: "cadastro_documentos" },
      { id: "transferencias", label: "Transferências", icon: ArrowRightLeftIcon, caminho: "/operacoes/transferencias", modulo: "operacoes" },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    caminho: "/clientes",
    prefixos: ["/clientes"],
    modulo: "clientes",
    paginas: [
      { id: "lista", label: "Clientes", icon: UsersIcon, caminho: "/clientes", modulo: "clientes" },
      { id: "analise", label: "Análise de crédito", icon: SearchCheckIcon, caminho: "/clientes/analise", modulo: "credito" },
      { id: "garantias", label: "Garantias", icon: ScaleIcon, caminho: "/clientes/garantias", modulo: "credito" },
    ],
  },
  {
    id: "documentos",
    label: "Documentos",
    caminho: "/documentos",
    prefixos: ["/documentos"],
    modulo: "documentos",
    paginas: [
      { id: "geral", label: "Documentos", icon: FileSearchIcon, caminho: "/documentos", modulo: "documentos" },
      { id: "pedidos", label: "Pedidos", icon: SendIcon, caminho: "/documentos/pedidos", modulo: "solicitacoes" },
      { id: "aprovacao", label: "Aprovação", icon: ClipboardCheckIcon, caminho: "/documentos/aprovacao", modulo: "aprovacao" },
      { id: "compliance", label: "Compliance", icon: ShieldCheckIcon, caminho: "/documentos/compliance", modulo: "compliance" },
      { id: "cadastrados", label: "Cadastrados", icon: ListChecksIcon, caminho: "/documentos/cadastrados", modulo: "cadastro_documentos" },
    ],
  },
  {
    id: "instituicoes",
    label: "Instituições",
    caminho: "/instituicoes",
    prefixos: ["/instituicoes"],
    modulo: "instituicoes",
    paginas: [
      { id: "lista", label: "Instituições", icon: LandmarkIcon, caminho: "/instituicoes", modulo: "instituicoes" },
      { id: "produtos", label: "Produtos e taxas", icon: BadgePercentIcon, caminho: "/instituicoes/produtos", modulo: "instituicoes" },
    ],
  },
  {
    id: "carteira",
    label: "Carteira",
    caminho: "/carteira",
    prefixos: ["/carteira"],
    modulo: "carteira",
    paginas: [
      { id: "contratos", label: "Contratos", icon: FileBadgeIcon, caminho: "/carteira", modulo: "carteira" },
      { id: "parcelas", label: "Parcelas", icon: WalletCardsIcon, caminho: "/carteira/parcelas", modulo: "carteira" },
      { id: "renovacoes", label: "Renovações", icon: RefreshCwIcon, caminho: "/carteira/renovacoes", modulo: "carteira" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    caminho: "/financeiro",
    prefixos: ["/financeiro"],
    modulo: "financeiro",
    paginas: [
      { id: "visao", label: "Visão geral", icon: ChartColumnIcon, caminho: "/financeiro", modulo: "financeiro" },
      { id: "receitas", label: "Receitas", icon: BanknoteArrowUpIcon, tom: "verde", caminho: "/financeiro/receitas", modulo: "financeiro" },
      { id: "despesas", label: "Despesas", icon: BanknoteArrowDownIcon, tom: "vermelho", caminho: "/financeiro/despesas", modulo: "financeiro" },
      { id: "extrato", label: "Extrato", icon: ReceiptTextIcon, caminho: "/financeiro/extrato", modulo: "financeiro" },
      { id: "comissoes", label: "Comissões", icon: HandshakeIcon, caminho: "/financeiro/comissoes", modulo: "comissoes" },
    ],
  },
  { id: "agenda", label: "Agenda", caminho: "/agenda", prefixos: ["/agenda"], modulo: "credito", paginas: [] },
];
