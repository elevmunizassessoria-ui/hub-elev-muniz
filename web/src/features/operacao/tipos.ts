import type { Envio, Historico, ItemOperacao, Operacao, Resumo, Solicitacao } from "@/lib/tipos";

/** O que o servidor devolve para a pasta de uma operação. */
export interface DadosOperacao {
  operacao: Operacao;
  cliente: { id: number; nome: string; email: string; telefone: string; contato: string };
  caminho: string;
  itens: ItemOperacao[];
  avulsos: Envio[];
  resumo: Resumo;
  pedido_aberto: Solicitacao | null;
  historico: Historico[];
}

export const chaveOperacao = (id: number) => ["operacao", id] as const;
