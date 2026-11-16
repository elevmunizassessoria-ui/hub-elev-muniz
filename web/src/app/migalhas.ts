import { useEffect } from "react";
import { create } from "zustand";

/** O caminho que a barra de título mostra ("Clientes › Acme › Portuária"). Cada tela diz o seu. */
export interface Migalha {
  label: string;
  caminho?: string;
}

export const useMigalhasStore = create<{ migalhas: Migalha[]; set: (m: Migalha[]) => void }>((set) => ({
  migalhas: [],
  set: (migalhas) => set({ migalhas }),
}));

export function useMigalhas(migalhas: Migalha[]) {
  const set = useMigalhasStore((s) => s.set);
  const chave = JSON.stringify(migalhas);
  useEffect(() => {
    const lista = JSON.parse(chave) as Migalha[];
    set(lista);
    document.title = `${lista.at(-1)?.label ?? "Início"} · Hub Elev Muniz`;
  }, [chave, set]);
}
