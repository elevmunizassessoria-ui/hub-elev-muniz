import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FilterIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Ferramenta } from "@/app/faixa";

/** A ferramenta "Filtro" da faixa (com quantos filtros estão ligados). */
export function ferramentaFiltro(abrir: () => void, ligados: number): Ferramenta {
  return { id: "filtro", label: ligados > 0 ? `Filtro (${ligados})` : "Filtro", icon: FilterIcon, tom: "cinza", run: abrir };
}

/** O filtro do padrão: painel de 340 px que entra pela direita; as linhas respondem enquanto se escolhe. */
export function PainelFiltro({
  aberto,
  onClose,
  mostrando,
  total,
  onLimpar,
  children,
}: {
  aberto: boolean;
  onClose: () => void;
  mostrando: number;
  total: number;
  onLimpar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=listbox]")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto, onClose]);
  if (!aberto) return null;
  return createPortal(
    <>
      <div aria-hidden onClick={onClose} className="fixed inset-x-0 top-14 bottom-0 z-40 bg-black/10" />
      <aside aria-label="Filtro" className="fixed top-14 right-0 bottom-0 z-40 flex w-[340px] max-w-full flex-col bg-background shadow-[-8px_0_32px_-12px_rgb(0_0_0/0.25)] duration-200 animate-in slide-in-from-right-8 motion-reduce:animate-none">
        <header className="flex h-[52px] shrink-0 items-center border-b bg-card pr-3 pl-5">
          <h2 className="flex-1 text-[15px] font-semibold">Filtro</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="grid size-[34px] place-items-center rounded-full outline-none hover:bg-foreground/[0.07] focus-visible:ring-2 focus-visible:ring-ring">
            <XIcon className="size-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">{children}</div>
        <footer className="flex shrink-0 items-center gap-2 border-t bg-card px-5 py-3">
          <span className="mr-auto text-[13px] text-muted-foreground tabular-nums">
            {mostrando} de {total}
          </span>
          <Button type="button" variant="secondary" onClick={onLimpar}>
            Limpar
          </Button>
          <Button type="button" onClick={onClose}>
            Concluir
          </Button>
        </footer>
      </aside>
    </>,
    document.body,
  );
}
