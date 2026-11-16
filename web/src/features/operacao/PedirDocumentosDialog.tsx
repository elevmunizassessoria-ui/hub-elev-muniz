import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, CopyIcon, MailIcon, MessageCircleIcon } from "lucide-react";

import { FormField, Marcar } from "@/components/FormPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { copiar, linkWhatsApp, mensagemDoLink } from "@/lib/acoes";
import { api } from "@/lib/api";
import { ESTADO_ITEM } from "@/lib/estados";
import { dataBR, plural } from "@/lib/formato";
import type { Configuracoes, Solicitacao } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import type { DadosOperacao } from "./tipos";

/** Estados que pedem envio (marcados de início quando o documento é obrigatório). */
const PEDEM = ["falta", "recusado", "vencido"];

/**
 * Pedir documentos ao cliente: escolhe os itens, escreve um recado e gera o link.
 * Se a operação já tem pedido aberto, os itens se somam a ele (o mesmo link).
 */
export function PedirDocumentosDialog({ dados, onClose }: { dados: DadosOperacao; onClose: () => void }) {
  const qc = useQueryClient();
  const noPedido = useMemo(() => new Set(dados.pedido_aberto?.itens.filter((i) => i.estado !== "aprovado").map((i) => i.id) ?? []), [dados]);
  const [marcados, setMarcados] = useState<Set<number>>(
    () => new Set(dados.itens.filter((i) => i.obrigatorio && PEDEM.includes(i.estado) && !noPedido.has(i.id)).map((i) => i.id)),
  );
  const [mensagem, setMensagem] = useState("");
  const [resultado, setResultado] = useState<{ solicitacao: Solicitacao; acrescentado: boolean } | null>(null);
  const [erro, setErro] = useState("");

  const grupos = useMemo(() => {
    const m = new Map<string, typeof dados.itens>();
    for (const i of dados.itens) m.set(i.grupo, [...(m.get(i.grupo) ?? []), i]);
    return [...m.entries()];
  }, [dados.itens]);

  const pedir = useMutation({
    mutationFn: () =>
      api<{ solicitacao: Solicitacao; acrescentado: boolean }>(`/operacoes/${dados.operacao.id}/solicitacoes`, {
        corpo: { item_ids: [...marcados], mensagem },
      }),
    onSuccess: async (r) => {
      setResultado(r);
      await qc.invalidateQueries({ queryKey: ["operacao", dados.operacao.id] });
      await qc.invalidateQueries({ queryKey: ["solicitacoes"] });
      await qc.invalidateQueries({ queryKey: ["cliente", dados.cliente.id] });
    },
    onError: (e) => setErro((e as Error).message),
  });

  const trocar = (id: number, v: boolean) =>
    setMarcados((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });

  if (resultado) return <LinkGerado solicitacao={resultado.solicitacao} acrescentado={resultado.acrescentado} onClose={onClose} />;

  return (
    <Dialog open onOpenChange={(o) => !o && !pedir.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          noValidate
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (marcados.size === 0) return setErro("Marque pelo menos um documento.");
            setErro("");
            pedir.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Pedir documentos</DialogTitle>
            <DialogDescription>
              {dados.pedido_aberto
                ? "Esta operação já tem um pedido aberto: os documentos marcados entram nele (o mesmo link)."
                : "O cliente recebe um link para enviar os documentos marcados. Depois você aprova cada um."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-1">
            {dados.itens.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Esta operação ainda não exige documentos.</p>}
            {grupos.map(([grupo, itens]) => (
              <div key={grupo} className="mb-3 last:mb-0">
                <p className="pb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{grupo}</p>
                <div className="flex flex-col gap-2">
                  {itens.map((i) => {
                    const travado = noPedido.has(i.id) || i.estado === "aguardando";
                    const estado = ESTADO_ITEM[i.estado];
                    return (
                      <Marcar key={i.id} checked={travado || marcados.has(i.id)} disabled={travado} onChange={(v) => trocar(i.id, v)} className="items-start">
                        <span className="min-w-0 flex-1">
                          <span className="block">
                            {i.nome}
                            {i.obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
                            {i.frente_verso && <span className="text-muted-foreground"> · frente e verso</span>}
                          </span>
                          <span className={cn("block text-xs", estado.tone === "negativo" ? "text-destructive" : "text-muted-foreground")}>
                            {noPedido.has(i.id) ? "Já está no pedido aberto" : i.estado === "aguardando" ? "Já enviado, aguardando aprovação" : estado.label}
                          </span>
                        </span>
                      </Marcar>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <FormField label="Recado para o cliente" htmlFor="ped-msg" help={`${mensagem.length}/500`}>
            <Textarea id="ped-msg" value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={500} placeholder="Opcional. Ex.: envie as certidões atualizadas." />
          </FormField>
          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
          <DialogFooter>
            <span className="mr-auto self-center text-sm text-muted-foreground">{plural(marcados.size, "documento marcado", "documentos marcados")}</span>
            <Button type="button" variant="outline" onClick={onClose} disabled={pedir.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pedir.isPending || marcados.size === 0}>
              {pedir.isPending && <Spinner data-icon="inline-start" />}
              Gerar link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** O link pronto: copiar, mandar pelo WhatsApp ou por e-mail. */
export function LinkGerado({ solicitacao: s, acrescentado, onClose }: { solicitacao: Solicitacao; acrescentado?: boolean; onClose: () => void }) {
  const config = useQuery({ queryKey: ["configuracoes"], queryFn: () => api<{ configuracoes: Configuracoes }>("/configuracoes") });
  const empresa = config.data?.configuracoes.empresa_nome ?? "nossa empresa";
  const link = s.link ?? "";
  const texto = mensagemDoLink({ empresa, contato: s.cliente_contato, operacao: s.operacao_nome, link, prazo: dataBR(s.expira_em) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link pronto</DialogTitle>
          <DialogDescription>
            {acrescentado ? "Os documentos entraram no pedido aberto. " : ""}Vale até {dataBR(s.expira_em)}. Mande para {s.cliente_contato || s.cliente_nome}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2Icon className="size-4 shrink-0" />
          {plural(s.itens.filter((i) => i.estado !== "aprovado").length, "documento pedido", "documentos pedidos")}
        </div>
        <div className="flex items-center gap-2">
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" aria-label="Link para o cliente" />
          <Button type="button" variant="outline" onClick={() => void copiar(link, "Link copiado.")}>
            <CopyIcon data-icon="inline-start" />
            Copiar
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void copiar(texto, "Mensagem copiada.")}>
            <CopyIcon data-icon="inline-start" />
            Copiar mensagem
          </Button>
          {s.cliente_telefone && (
            <Button type="button" variant="outline" asChild>
              <a href={linkWhatsApp(s.cliente_telefone, texto)} target="_blank" rel="noreferrer">
                <MessageCircleIcon data-icon="inline-start" />
                WhatsApp
              </a>
            </Button>
          )}
          {s.cliente_email && (
            <Button type="button" variant="outline" asChild>
              <a href={`mailto:${s.cliente_email}?subject=${encodeURIComponent(`${empresa} | Envio de documentos`)}&body=${encodeURIComponent(texto)}`}>
                <MailIcon data-icon="inline-start" />
                E-mail
              </a>
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          O link abre em qualquer aparelho que alcance este computador pela rede. Para clientes de fora, ajuste o endereço em Configuração.
        </p>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Pronto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
