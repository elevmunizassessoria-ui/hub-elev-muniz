import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api, guardarToken } from "@/lib/api";
import type { Modulo, Nivel, Usuario } from "@/lib/tipos";

export interface Sessao {
  usuario: Usuario | null;
  primeiro_acesso: boolean;
  empresa_nome: string;
}

export const CHAVE_SESSAO = ["sessao"] as const;

export function useSessao() {
  return useQuery({ queryKey: CHAVE_SESSAO, queryFn: () => api<Sessao>("/sessao"), staleTime: 60_000 });
}

/** O usuário logado (as telas internas só aparecem com ele). */
export function useUsuario(): Usuario {
  const { data } = useSessao();
  if (!data?.usuario) throw new Error("Sem sessão");
  return data.usuario;
}

const PESO: Record<Nivel, number> = { ver: 1, editar: 2, excluir: 3 };

export function pode(usuario: Usuario | null | undefined, modulo: Modulo, nivel: Nivel = "ver"): boolean {
  if (!usuario) return false;
  if (usuario.admin) return true;
  const tem = usuario.permissoes[modulo];
  return !!tem && PESO[tem] >= PESO[nivel];
}

export function usePode(modulo: Modulo, nivel: Nivel = "ver"): boolean {
  const { data } = useSessao();
  return pode(data?.usuario, modulo, nivel);
}

export function useSair() {
  const qc = useQueryClient();
  return async () => {
    await api("/sessao/sair", { corpo: {} }).catch(() => undefined);
    guardarToken(null);
    qc.clear();
    window.location.hash = "/";
    await qc.invalidateQueries({ queryKey: CHAVE_SESSAO });
  };
}
