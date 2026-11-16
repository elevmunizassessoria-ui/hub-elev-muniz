import { FileSignatureIcon } from "lucide-react";

import { StatusPill, type StatusTone } from "@/components/StatusPill";
import { navegar } from "@/app/rotas";
import { dataBR, dinheiro } from "@/lib/formato";
import { FUNIL_ETAPAS, useCredito } from "./dados";

const TOM: Record<string, StatusTone> = {
  "Em análise": "andamento", Aprovada: "concluido", Recusada: "negativo", Contraproposta: "aguardando", Rascunho: "neutro",
  Vigente: "concluido", "Vence em breve": "aguardando", Vencida: "negativo", "Em avaliação": "andamento",
  "Em dia": "concluido", "Em atraso": "negativo", Quitado: "neutro", Renegociado: "aguardando",
  "A receber": "aguardando", Recebida: "andamento", Repassada: "concluido",
};
const pct = (v: number) => `${String(v).replace(".", ",")}%`;

/**
 * Tudo do crédito de uma operação, na tela dela (pedido do dono, 16/11/2026: "tudo deve ficar nessa parte"):
 * a proposta e o parceiro, a etapa no funil, a garantia, o contrato e a comissão.
 */
export function CreditoDaOperacao({ operacaoId }: { operacaoId: number }) {
  const D = useCredito();
  const proposta = D.PROPOSTAS.find((p) => p.operacao_id === operacaoId);
  if (D.carregando || !proposta) return null;
  const funil = D.FUNIL.find((f) => f.operacao_id === operacaoId);
  const garantia = D.GARANTIAS.find((g) => g.operacao_id === operacaoId);
  const contrato = D.CONTRATOS.find((c) => c.operacao_id === operacaoId);
  const comissao = D.COMISSOES.find((c) => c.operacao_id === operacaoId);

  return (
    <section aria-label="Crédito da operação" className="overflow-hidden rounded-xl bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <FileSignatureIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Crédito da operação</h2>
        <span className="text-sm text-muted-foreground">
          {proposta.codigo} · {proposta.produto}
        </span>
        {funil && <StatusPill tone="andamento">{FUNIL_ETAPAS[funil.etapa]}</StatusPill>}
        <button type="button" onClick={() => navegar("/operacoes/propostas")} className="ml-auto text-sm text-primary-text outline-none hover:underline focus-visible:underline">
          Ver todas as propostas
        </button>
      </header>
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Parte titulo="Proposta" situacao={proposta.situacao}>
          <Dado rotulo="Parceiro" valor={proposta.banco} />
          <Dado rotulo="Valor" valor={dinheiro(proposta.valor)} forte />
          <Dado rotulo="Taxa e prazo" valor={`${pct(proposta.taxa)} a.m. · ${proposta.prazo}x`} />
          <Dado rotulo="Enviada em" valor={dataBR(proposta.enviada)} />
        </Parte>
        <Parte titulo="Garantia" situacao={garantia?.situacao} vazio="Sem garantia registrada">
          {garantia && (
            <>
              <Dado rotulo="Tipo" valor={garantia.tipo} />
              <Dado rotulo="Descrição" valor={garantia.descricao} />
              <Dado rotulo="Valor avaliado" valor={dinheiro(garantia.valor)} forte />
              <Dado rotulo="Laudo vence" valor={dataBR(garantia.vence)} />
            </>
          )}
        </Parte>
        <Parte titulo="Contrato" situacao={contrato?.situacao} vazio="Ainda sem contrato">
          {contrato && (
            <>
              <Dado rotulo="Liberado" valor={dinheiro(contrato.liberado)} forte />
              <Dado rotulo="Saldo devedor" valor={dinheiro(contrato.saldo)} />
              <Dado rotulo="Parcelas pagas" valor={`${contrato.pagas} de ${contrato.total}`} />
              <Dado rotulo="Próximo vencimento" valor={dataBR(contrato.proximo)} />
            </>
          )}
        </Parte>
        <Parte titulo="Comissão" situacao={comissao?.situacao} vazio="Sai quando o crédito é liberado">
          {comissao && (
            <>
              <Dado rotulo="Comissão" valor={`${dinheiro(comissao.comissao)} (${pct(comissao.percentual)})`} forte />
              <Dado rotulo="Repasse ao consultor" valor={dinheiro(comissao.repasse)} />
              <Dado rotulo="Previsão" valor={dataBR(comissao.previsao)} />
            </>
          )}
        </Parte>
      </div>
    </section>
  );
}

function Parte({ titulo, situacao, vazio, children }: { titulo: string; situacao?: string; vazio?: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 bg-card p-4">
      <p className="flex items-center justify-between gap-2 text-[13px] font-semibold">
        {titulo}
        {situacao && <StatusPill tone={TOM[situacao] ?? "neutro"}>{situacao}</StatusPill>}
      </p>
      {children ?? <p className="text-sm text-muted-foreground">{vazio}</p>}
    </div>
  );
}

function Dado({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={forte ? "truncate text-sm font-semibold tabular-nums" : "truncate text-sm tabular-nums"}>{valor}</p>
    </div>
  );
}
