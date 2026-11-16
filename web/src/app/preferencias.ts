import { create } from "zustand";

/** Preferências deste navegador (tema). Ficam no localStorage, que pode faltar: tudo em try/catch. */

export type Tema = "dark" | "light" | "system";

const CHAVE = "hub-elev-muniz:preferencias";

function lerTema(): Tema {
  try {
    const t = JSON.parse(localStorage.getItem(CHAVE) ?? "{}").tema;
    return t === "light" || t === "system" || t === "dark" ? t : "light";
  } catch {
    return "light";
  }
}

interface Preferencias {
  tema: Tema;
  setTema: (tema: Tema) => void;
}

export const usePreferencias = create<Preferencias>((set) => ({
  tema: lerTema(),
  setTema: (tema) => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ tema }));
    } catch {
      /* sem armazenamento: vale só nesta aba */
    }
    set({ tema });
  },
}));
