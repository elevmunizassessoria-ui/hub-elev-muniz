import { useEffect, useLayoutEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { create } from "zustand";

/** As cores dos quadradinhos da faixa: marca nas páginas, verde receita, vermelho despesa, cinza ferramenta. */
export type TomFaixa = "marca" | "verde" | "vermelho" | "cinza" | "azul" | "laranja";

export interface Ferramenta {
  id: string;
  label: string;
  icon: LucideIcon;
  tom: TomFaixa;
  run?: () => void;
  ativo?: boolean;
  disabled?: boolean;
  /** Com escolhas: abre um menu embaixo do botão. */
  menu?: { id: string; label: string; ativo?: boolean; run: () => void }[];
}

export interface GrupoFaixa {
  titulo: string;
  ferramentas: Ferramenta[];
}

export const useFaixaStore = create<{ grupos: GrupoFaixa[]; set: (g: GrupoFaixa[]) => void }>((set) => ({
  grupos: [],
  set: (grupos) => set({ grupos }),
}));

/** A tela diz as suas ferramentas; a faixa (`AppTabs`) as mostra depois das páginas da aba. */
export function useFerramentas(grupos: GrupoFaixa[]) {
  const set = useFaixaStore((s) => s.set);
  // A cada desenho: as ações usam o estado atual da tela.
  useLayoutEffect(() => {
    set(grupos);
  });
  useEffect(() => () => set([]), [set]);
}
