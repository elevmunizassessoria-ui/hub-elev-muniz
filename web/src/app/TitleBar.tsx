import { Fragment } from "react";
import { BellIcon, ChevronDownIcon, ChevronRightIcon, LogOutIcon, SettingsIcon, UserRoundIcon } from "lucide-react";

import { AppLogo } from "@/components/AppMark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_NAME } from "@/lib/brand";
import { iniciais } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { useMigalhasStore } from "./migalhas";
import { navegar } from "./rotas";
import { useSair, useUsuario } from "./sessao";

function Breadcrumb() {
  const migalhas = useMigalhasStore((s) => s.migalhas);
  return (
    <ol className="flex min-w-0 items-center gap-2 text-[15px]">
      {migalhas.map((m, i) => {
        const ultima = i === migalhas.length - 1;
        return (
          <Fragment key={`${m.label}-${i}`}>
            {i > 0 && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />}
            <li className="min-w-0">
              {m.caminho && !ultima ? (
                <button type="button" onClick={() => navegar(m.caminho!)} className="block max-w-[16rem] truncate rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                  {m.label}
                </button>
              ) : (
                <span className={cn("block truncate", ultima ? "font-medium text-foreground" : "text-muted-foreground")}>{m.label}</span>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

const BOTAO_TOPO = "flex h-9 items-center rounded-md text-sm text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-foreground/[0.07] aria-expanded:text-foreground";

/** A barra do título: logo, onde a pessoa está (a tela não tem título próprio), notificações e o perfil. */
export function TitleBar() {
  const usuario = useUsuario();
  const sair = useSair();
  return (
    <header className="flex h-14 shrink-0 items-center border-b glass text-foreground">
      <div className="flex h-full min-w-0 flex-1 items-center overflow-hidden pr-4">
        <button type="button" aria-label="Ir para o início" onClick={() => navegar("/")} className="ml-5 shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <AppLogo label={APP_NAME} className="h-8" />
        </button>
        <span aria-hidden className="ml-5 h-6 w-px shrink-0 bg-border" />
        <div className="ml-5 min-w-0">
          <Breadcrumb />
        </div>
      </div>
      <div className="ml-auto flex h-full shrink-0 items-center gap-2 pr-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Notificações" title="Notificações" className={cn(BOTAO_TOPO, "w-9 justify-center")}>
              <BellIcon className="size-[18px]" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="py-1.5 text-sm font-medium text-foreground">Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhuma notificação</p>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`Perfil de ${usuario.nome}`} className={cn(BOTAO_TOPO, "gap-2 pr-2 pl-1.5 font-medium text-foreground")}>
              <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary/[0.18] text-[11px] font-semibold text-primary-ink">
                {iniciais(usuario.nome)}
              </span>
              Perfil
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
              <span className="truncate text-sm font-medium text-foreground">{usuario.nome}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{usuario.email}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{usuario.perfil_acesso_nome}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navegar("/configuracoes/usuarios/eu")}>
              <UserRoundIcon />
              Meu usuário
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navegar("/configuracoes")}>
              <SettingsIcon />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => void sair()}>
              <LogOutIcon />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
