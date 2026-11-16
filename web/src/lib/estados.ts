import type { StatusTone } from "@/components/StatusPill";
import type { EstadoItem, EstadoNoPedido, SituacaoPedido, SlaOperacao } from "./tipos";

/** Nome e cor de cada estado (as mesmas cores do Conecta: âmbar espera, verde ok, vermelho problema). */

export const ESTADO_ITEM: Record<EstadoItem, { label: string; tone: StatusTone }> = {
  falta: { label: "Falta enviar", tone: "neutro" },
  aguardando: { label: "Aguardando aprovação", tone: "aguardando" },
  aprovado: { label: "Aprovado", tone: "concluido" },
  vencendo: { label: "Vence em breve", tone: "aguardando" },
  vencido: { label: "Vencido", tone: "negativo" },
  recusado: { label: "Recusado", tone: "negativo" },
};

export const ESTADO_NO_PEDIDO: Record<EstadoNoPedido, { label: string; tone: StatusTone }> = {
  faltando: { label: "Aguardando envio", tone: "aguardando" },
  em_analise: { label: "Em análise", tone: "andamento" },
  aprovado: { label: "Aprovado", tone: "concluido" },
  recusado: { label: "Recusado", tone: "negativo" },
};

export const SITUACAO_PEDIDO: Record<SituacaoPedido, { label: string; tone: StatusTone }> = {
  aguardando: { label: "Aguardando cliente", tone: "aguardando" },
  em_analise: { label: "Em análise", tone: "andamento" },
  concluida: { label: "Concluído", tone: "concluido" },
  cancelada: { label: "Cancelado", tone: "neutro" },
  vencida: { label: "Link vencido", tone: "negativo" },
};

export const SLA_OPERACAO: Record<SlaOperacao, { label: string; tone: StatusTone }> = {
  no_prazo: { label: "No prazo", tone: "concluido" },
  perto: { label: "Perto do prazo", tone: "aguardando" },
  atrasada: { label: "Atrasada", tone: "negativo" },
  encerrada: { label: "Encerrada", tone: "neutro" },
  sem_prazo: { label: "Sem prazo", tone: "neutro" },
};
