import { useEffect } from "react";

import { PcToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AcessoRestrito } from "@/components/AcessoRestrito";
import { Carregando } from "@/components/Carregando";
import { AppTabs, FaixaSelecao } from "@/app/AppTabs";
import { TODAS } from "@/app/nav";
import { navegar, useRota } from "@/app/rotas";
import { pode, useSessao } from "@/app/sessao";
import { StatusBar } from "@/components/StatsLine";
import { useApplyTheme } from "@/app/theme";
import { TitleBar } from "@/app/TitleBar";
import { AprovacaoView } from "@/features/aprovacao/AprovacaoView";
import { DocumentosGeralView } from "@/features/documentos/DocumentosGeralView";
import { FinanceiroView } from "@/features/financeiro/FinanceiroView";
import { FinanceiroVisaoView } from "@/features/financeiro/FinanceiroVisaoView";
import { OperacoesView } from "@/features/operacoes/OperacoesView";
import { TransferenciasView } from "@/features/operacoes/TransferenciasView";
import { PainelView } from "@/features/painel/PainelView";
import { FunilView } from "@/features/credito/FunilView";
import { SimuladorView } from "@/features/credito/SimuladorView";
import { AnaliseCreditoView, ComissoesView, ComplianceView, GarantiasView, MetasView, PropostasView } from "@/features/credito/telas";
import { ParceirosView } from "@/features/parceiros/ParceirosView";
import { SlaView } from "@/features/sla/SlaView";
import { ClientesView } from "@/features/clientes/ClientesView";
import { ClienteView } from "@/features/clientes/ClienteView";
import { ConfiguracoesView } from "@/features/configuracoes/ConfiguracoesView";
import { PerfisDocumentoView } from "@/features/documentos/PerfisDocumentoView";
import { TiposDocumentoView } from "@/features/documentos/TiposDocumentoView";
import { Entrar, TrocarSenhaObrigatoria } from "@/features/login/Entrar";
import { OperacaoView } from "@/features/operacao/OperacaoView";
import { PortalEnvio } from "@/features/publico/PortalEnvio";
import { SolicitacoesView } from "@/features/solicitacoes/SolicitacoesView";
import type { Modulo } from "@/lib/tipos";

export function App() {
  useApplyTheme();
  // O portal do cliente (link de envio) vive fora do sistema: sem login e sem barras.
  // "#/enviar/<token>" (o site online só entrega index.html) ou "/enviar/<token>" (links antigos).
  const portal = window.location.hash.match(/^#\/enviar\/([A-Za-z0-9_-]+)\/?$/) ?? window.location.pathname.match(/\/enviar\/([A-Za-z0-9_-]+)\/?$/);
  return (
    <TooltipProvider delayDuration={400}>
      {portal ? <PortalEnvio token={portal[1]} /> : <Portao />}
      <PcToaster />
    </TooltipProvider>
  );
}

function Portao() {
  const sessao = useSessao();
  if (sessao.isPending) {
    return (
      <div className="grid h-full place-items-center bg-background">
        <Carregando compact />
      </div>
    );
  }
  if (sessao.isError) {
    return (
      <div className="grid h-full place-items-center bg-background p-6 text-center text-sm text-muted-foreground">
        Não foi possível falar com o servidor local. Abra o Hub pelo atalho "Iniciar Hub".
      </div>
    );
  }
  if (!sessao.data.usuario) return <Entrar primeiroAcesso={sessao.data.primeiro_acesso} />;
  if (sessao.data.usuario.trocar_senha) return <TrocarSenhaObrigatoria />;
  return <Casca />;
}

function Casca() {
  const { caminho } = useRota();
  const naConfig = caminho.startsWith("/configuracoes");
  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      {naConfig ? <FaixaSelecao /> : <AppTabs />}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <Telas />
      </main>
      <StatusBar />
    </div>
  );
}

function Protegida({ modulo, children }: { modulo: Modulo; children: React.ReactNode }) {
  const { data } = useSessao();
  return pode(data?.usuario, modulo) ? <>{children}</> : <AcessoRestrito />;
}

function Redirecionar({ para }: { para: string }) {
  useEffect(() => navegar(para), [para]);
  return null;
}

/** A primeira aba que o perfil de acesso libera. */
function Inicio() {
  const { data } = useSessao();
  const destino = TODAS.find((x) => pode(data?.usuario, x.modulo));
  return <Redirecionar para={destino?.caminho ?? "/configuracoes/usuarios"} />;
}

function Telas() {
  const { partes } = useRota();
  const [a, b, c, d] = partes;
  const id = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : null);

  if (!a) return <Inicio />;
  if (a === "painel") {
    if (b === "sla") return <Protegida modulo="sla"><SlaView key={c ?? "c"} pagina={c === "processos" ? "processos" : c === "etapas" ? "etapas" : "consultores"} /></Protegida>;
    if (b === "metas") return <Protegida modulo="credito"><MetasView /></Protegida>;
    return <Protegida modulo="dashboard"><PainelView /></Protegida>;
  }
  if (a === "operacoes") {
    if (b === "predefinicoes") return <Protegida modulo="cadastro_documentos"><PerfisDocumentoView /></Protegida>;
    if (b === "transferencias") return <Protegida modulo="operacoes"><TransferenciasView /></Protegida>;
    if (b === "funil") return <Protegida modulo="credito"><FunilView /></Protegida>;
    if (b === "propostas") return <Protegida modulo="credito"><PropostasView /></Protegida>;
    if (b === "simulador") return <Protegida modulo="credito"><SimuladorView /></Protegida>;
    if (b === "analise") return <Protegida modulo="credito"><AnaliseCreditoView /></Protegida>;
    if (b === "garantias") return <Protegida modulo="credito"><GarantiasView /></Protegida>;
    if (b === "compliance") return <Protegida modulo="compliance"><ComplianceView /></Protegida>;
    if (id(b)) return <OperacaoView operacaoId={id(b)!} />;
    return <Protegida modulo="operacoes"><OperacoesView /></Protegida>;
  }
  if (a === "clientes") {
    if (!b) return <Protegida modulo="clientes"><ClientesView /></Protegida>;
    if (b === "analise" || b === "garantias") return <Redirecionar para={`/operacoes/${b}`} />;
    if (id(b) && c === "operacoes" && id(d)) return <Redirecionar para={`/operacoes/${d}`} />;
    if (id(b)) return <ClienteView clienteId={id(b)!} />;
  }
  if (a === "documentos") {
    if (b === "pedidos") return <Protegida modulo="solicitacoes"><SolicitacoesView /></Protegida>;
    if (b === "aprovacao") return <Protegida modulo="aprovacao"><AprovacaoView /></Protegida>;
    if (b === "compliance") return <Redirecionar para="/operacoes/compliance" />;
    if (b === "cadastrados") return <Protegida modulo="cadastro_documentos"><TiposDocumentoView /></Protegida>;
    if (b === "perfis") return <Redirecionar para="/operacoes/predefinicoes" />;
    if (b === "tipos") return <Redirecionar para="/documentos/cadastrados" />;
    return <Protegida modulo="documentos"><DocumentosGeralView /></Protegida>;
  }
  if (a === "parceiros") return <Protegida modulo="instituicoes"><ParceirosView /></Protegida>;
  // Endereços que saíram (16/11/2026): Instituições virou Parceiros; Carteira e Agenda saíram.
  if (a === "instituicoes") return <Redirecionar para="/parceiros" />;
  if (a === "carteira" || a === "agenda") return <Redirecionar para="/operacoes" />;
  if (a === "sla") return <Redirecionar para={b === "metas" ? "/painel/metas" : b ? `/painel/sla/${b}` : "/painel/sla"} />;
  if (a === "financeiro") {
    if (b === "comissoes") return <Protegida modulo="comissoes"><ComissoesView /></Protegida>;
    if (b === "receitas" || b === "despesas" || b === "extrato") return <Protegida modulo="financeiro"><FinanceiroView key={b} pagina={b} /></Protegida>;
    return <Protegida modulo="financeiro"><FinanceiroVisaoView /></Protegida>;
  }
  if (a === "configuracoes") return <ConfiguracoesView />;
  // Endereços antigos
  if (a === "solicitacoes") return <Redirecionar para="/documentos/pedidos" />;
  if (a === "aprovacao") return <Redirecionar para="/documentos/aprovacao" />;
  if (a === "perfil") return <Redirecionar para="/configuracoes/usuarios/eu" />;
  if (a === "acessos") return <Redirecionar para={b === "perfis" ? "/configuracoes/perfis" : "/configuracoes/usuarios"} />;
  return <Redirecionar para="/" />;
}
