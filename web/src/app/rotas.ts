import { useSyncExternalStore } from "react";

/**
 * Navegação pelo endereço depois do "#": #/clientes/3/operacoes/7.
 * Assim o F5 e o Voltar do navegador funcionam sem servidor de rotas.
 */

function ler(): string {
  const h = window.location.hash.replace(/^#/, "");
  return h.startsWith("/") ? h : "/";
}

function assinar(aviso: () => void) {
  window.addEventListener("hashchange", aviso);
  return () => window.removeEventListener("hashchange", aviso);
}

export function useRota(): { caminho: string; partes: string[] } {
  const caminho = useSyncExternalStore(assinar, ler);
  return { caminho, partes: caminho.split("/").filter(Boolean) };
}

export function navegar(caminho: string) {
  if (ler() !== caminho) window.location.hash = caminho;
}

export const linkPara = (caminho: string) => `#${caminho}`;
