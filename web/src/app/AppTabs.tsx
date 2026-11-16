import { Fragment, useEffect, useState } from "react";
import { ChevronUpIcon, PinIcon } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useReportSelection, type SelectionTool } from "@/components/report-selection";
import { COR_TOM, IconeApp } from "@/components/IconeApp";
import { cn } from "@/lib/utils";
import { useFaixaStore, type Ferramenta, type GrupoFaixa, type TomFaixa } from "./faixa";
import { NAV } from "./nav";
import { navegar, useRota } from "./rotas";
import { pode, useSessao } from "./sessao";


const CHAVE = "hub-faixa-aberta";
function lerFixada() {
  try {
    return localStorage.getItem(CHAVE) !== "0";
  } catch {
    return true;
  }
}

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

/** Abas no topo (só o nome) e a faixa de ferramentas embaixo: primeiro as páginas, depois o que a tela pedir. */
export function AppTabs() {
  const { caminho } = useRota();
  const { data } = useSessao();
  const ferramentas = useFaixaStore((s) => s.grupos);
  const selecao = useGrupoSelecao();
  const [fixada, setFixada] = useState(lerFixada);
  const [aberta, setAberta] = useState(false);
  const abas = NAV.filter((a) => pode(data?.usuario, a.modulo) || a.paginas.some((p) => pode(data?.usuario, p.modulo)));
  const aqui = abas.find((a) => a.prefixos.some((p) => caminho === p || caminho.startsWith(`${p}/`)));

  useEffect(() => setAberta(false), [caminho]);

  const fixar = (v: boolean) => {
    setFixada(v);
    setAberta(false);
    try {
      localStorage.setItem(CHAVE, v ? "1" : "0");
    } catch {
      /* só esquece a escolha na próxima vez */
    }
  };

  const paginas = (aqui?.paginas ?? []).filter((p) => pode(data?.usuario, p.modulo));
  const grupos: GrupoFaixa[] = [
    ...(paginas.length > 1
      ? [
          {
            titulo: "Páginas",
            ferramentas: paginas.map(
              (p): Ferramenta => ({
                id: p.id,
                label: p.label,
                icon: p.icon,
                tom: p.tom ?? "marca",
                arte: p.arte,
                cor: p.cor,
                ativo: caminho === p.caminho,
                run: () => navegar(p.caminho),
              }),
            ),
          },
        ]
      : []),
    ...ferramentas,
    ...selecao,
  ];
  const mostra = grupos.length > 0 && (fixada || aberta);

  return (
    <div className="relative z-30 shrink-0">
      <div className="flex h-9 items-stretch gap-3 border-b glass pr-4 pl-2">
        <nav aria-label="Navegação principal" className="flex min-w-0 items-stretch gap-0.5">
          {abas.map((a) => {
            const ativa = a.id === aqui?.id;
            return (
              <div key={a.id} className="relative flex items-center">
                <button
                  type="button"
                  aria-current={ativa ? "page" : undefined}
                  onClick={() => {
                    if (ativa) setAberta((v) => !v);
                    else {
                      const destino = pode(data?.usuario, a.modulo) ? a.caminho : (a.paginas.find((p) => pode(data?.usuario, p.modulo))?.caminho ?? a.caminho);
                      navegar(destino);
                    }
                  }}
                  className={cn(
                    "relative flex h-7 shrink-0 items-center rounded-md px-2.5 text-[13px] whitespace-nowrap text-foreground/80 outline-none transition-colors duration-150",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    ativa ? "font-bold text-foreground" : "font-normal hover:bg-foreground/[0.06] hover:text-foreground",
                  )}
                >
                  {a.label}
                </button>
              </div>
            );
          })}
        </nav>
      </div>
      {mostra && (
        <div
          className={cn(
            "flex items-stretch border-b glass px-2 pt-2 pb-1",
            !fixada && "absolute inset-x-0 top-full shadow-[0_12px_24px_-12px_rgb(0_0_0/0.25)]",
          )}
        >
          <GruposFaixa grupos={grupos} />
          <button
            type="button"
            onClick={() => fixar(!fixada)}
            aria-label={fixada ? "Recolher a faixa" : "Manter a faixa aberta"}
            title={fixada ? "Recolher a faixa" : "Manter a faixa aberta"}
            className="ml-2 flex size-7 shrink-0 items-center justify-center self-end rounded-md text-muted-foreground outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
          >
            {fixada ? <ChevronUpIcon /> : <PinIcon />}
          </button>
        </div>
      )}
    </div>
  );
}

function BotaoFaixa({ t }: { t: Ferramenta }) {
  const visual = cn(
    "group flex min-w-[68px] flex-col items-center gap-1 rounded-md border px-2 pt-1.5 pb-1 text-xs whitespace-nowrap outline-none transition-colors duration-150",
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
