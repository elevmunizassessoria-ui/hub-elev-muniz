import { Fragment } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useReportSelection, type SelectionTool } from "@/components/report-selection";
import { COR_TOM, IconeApp } from "@/components/IconeApp";
import { cn } from "@/lib/utils";
import { useFaixaStore, type Ferramenta, type GrupoFaixa, type TomFaixa } from "./faixa";
import { NAV, itemAtual } from "./nav";
import { navegar, useRota } from "./rotas";
import { pode, useSessao } from "./sessao";



const TOM_SELECAO: Record<SelectionTool["tone"], TomFaixa> = { green: "verde", red: "vermelho", gray: "cinza" };

/** As ações das linhas marcadas: ao lado do Adicionar, só enquanto há seleção. */
function useGrupoSelecao(): GrupoFaixa[] {
  const count = useReportSelection((s) => s.count);
  const tools = useReportSelection((s) => s.tools);
  if (count === 0) return [];
  return [
    {
      titulo: count === 1 ? "1 selecionado" : `${count} selecionados`,
      ferramentas: tools.map((t) => ({ id: t.id, label: t.label, icon: t.icon, tom: TOM_SELECAO[t.tone], run: t.run })),
    },
  ];
}

/** Configurações não tem abas: a faixa só aparece enquanto há linhas marcadas. */
export function FaixaSelecao() {
  const grupos = useGrupoSelecao();
  if (grupos.length === 0) return null;
  return (
    <div className="flex shrink-0 items-stretch border-b glass px-2 pt-2 pb-1">
      <GruposFaixa grupos={grupos} />
    </div>
  );
}

function GruposFaixa({ grupos }: { grupos: GrupoFaixa[] }) {
  return (
    <div role="toolbar" aria-label="Ferramentas" className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none]">
      {grupos.map((g, i) => (
        <Fragment key={g.titulo}>
          {i > 0 && <span aria-hidden className="mx-1 my-1 w-px shrink-0 bg-border" />}
          <div role="group" aria-label={g.titulo} className="flex shrink-0 flex-col items-center px-1">
            <div className="flex items-start gap-0.5">
              {g.ferramentas.map((t) => (
                <BotaoFaixa key={t.id} t={t} />
              ))}
            </div>
            <span className="mt-1 text-[11px] leading-4 text-muted-foreground select-none">{g.titulo}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * A faixa (pedido do dono, 16/11/2026: sem abas, só as ferramentas divididas por grupo): os grupos da navegação,
 * depois as ferramentas da tela aberta e as ações das linhas marcadas.
 */
export function AppTabs() {
  const { caminho } = useRota();
  const { data } = useSessao();
  const ferramentas = useFaixaStore((s) => s.grupos);
  const selecao = useGrupoSelecao();
  const atual = itemAtual(caminho);

  const navegacao: GrupoFaixa[] = NAV.map((g) => ({
    titulo: g.titulo,
    ferramentas: g.itens
      .map((i): Ferramenta | null => {
        const opcoes = (i.opcoes ?? []).filter((o) => pode(data?.usuario, o.modulo));
        if (!pode(data?.usuario, i.modulo) && opcoes.length === 0) return null;
        return {
          id: i.id,
          label: i.label,
          icon: i.icon,
          tom: "marca",
          arte: i.arte,
          cor: i.cor,
          ativo: atual?.id === i.id,
          run: () => navegar(i.caminho),
          menu: opcoes.length > 1 ? opcoes.map((o) => ({ id: o.caminho, label: o.label, ativo: caminho === o.caminho, run: () => navegar(o.caminho) })) : undefined,
        };
      })
      .filter((f): f is Ferramenta => f !== null),
  })).filter((g) => g.ferramentas.length > 0);

  return (
    <div className="relative z-30 flex shrink-0 items-stretch border-b glass px-2 pt-2 pb-1">
      <GruposFaixa grupos={[...navegacao, ...ferramentas, ...selecao]} />
    </div>
  );
}

function BotaoFaixa({ t }: { t: Ferramenta }) {
  const visual = cn(
    "group flex min-w-[60px] flex-col items-center gap-1 rounded-md border px-1.5 pt-1.5 pb-1 text-xs whitespace-nowrap outline-none transition-colors duration-150",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40",
    t.ativo ? "border-foreground/15 bg-foreground/[0.07] font-semibold" : "border-transparent hover:bg-foreground/[0.05] aria-expanded:bg-foreground/[0.07]",
  );
  const rosto = (
    <>
      <IconeApp
        arte={t.arte}
        icone={t.icon}
        cor={t.cor ?? (t.arte ? undefined : t.tom === "marca" ? undefined : COR_TOM[t.tom])}
        className="transition-transform duration-150 group-active:scale-95 motion-reduce:transition-none"
      />
      {t.label}
    </>
  );
  if (!t.menu) {
    return (
      <button type="button" aria-pressed={t.ativo} disabled={t.disabled} onClick={t.run} className={visual}>
        {rosto}
      </button>
    );
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={visual}>
          {rosto}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="max-h-80 min-w-44 overflow-y-auto p-1.5">
        {t.menu.map((c) => (
          <DropdownMenuItem key={c.id} className={cn("h-9 px-2 text-sm", c.ativo && "font-semibold")} onSelect={c.run}>
            {c.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
