import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarIcon, DownloadIcon, ExternalLinkIcon, FileIcon, FileImageIcon, FileTextIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormField } from "@/components/FormPage";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { usePode } from "@/app/sessao";
import { abrirArquivo, api } from "@/lib/api";
import { dataBR, dataHoraBR, tamanho } from "@/lib/formato";
import type { Arquivo, Envio } from "@/lib/tipos";

export function IconeArquivo({ tipo, className }: { tipo: string; className?: string }) {
  if (tipo.startsWith("image/")) return <FileImageIcon className={className} />;
  if (tipo === "application/pdf") return <FileTextIcon className={className} />;
  return <FileIcon className={className} />;
}

/** Um arquivo: abrir (nova aba) ou baixar. */
export function LinhaArquivo({ a }: { a: Arquivo }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
      <IconeArquivo tipo={a.arquivo_tipo} className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        {a.lado && <span className="font-medium">{a.lado} · </span>}
        {a.arquivo_nome}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{tamanho(a.arquivo_tamanho)}</span>
      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Abrir ${a.arquivo_nome}`} title="Abrir" onClick={() => abrirArquivo(a.id).catch((e) => toast.error((e as Error).message))}>
        <ExternalLinkIcon />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Baixar ${a.arquivo_nome}`} title="Baixar" onClick={() => abrirArquivo(a.id, true).catch((e) => toast.error((e as Error).message))}>
        <DownloadIcon />
      </Button>
    </div>
  );
}

const SITUACAO = {
  aprovado: { label: "Aprovado", tone: "concluido" },
  pendente: { label: "Aguardando aprovação", tone: "aguardando" },
  recusado: { label: "Recusado", tone: "negativo" },
} as const;

/** Todas as versões de um documento: a atual primeiro, depois as antigas. */
export function VersoesDialog({ titulo, envios, operacaoId, onClose }: { titulo: string; envios: Envio[]; operacaoId: number; onClose: () => void }) {
  const [validade, setValidade] = useState<Envio | null>(null);
  const [excluir, setExcluir] = useState<Envio | null>(null);
  const qc = useQueryClient();
  const podeEditar = usePode("clientes", "editar");
  const podeExcluir = usePode("clientes", "excluir");
  const apagar = useMutation({
    mutationFn: (e: Envio) => api(`/documentos/envio/${e.envio_id}`, { metodo: "DELETE" }),
    onSuccess: async () => {
      toast.success("Versão excluída. O arquivo foi para a pasta _Excluídos.");
      await qc.invalidateQueries({ queryKey: ["operacao", operacaoId] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const atual = envios.find((e) => e.situacao === "aprovado");

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{envios.length === 1 ? "1 versão" : `${envios.length} versões`} · a mais nova em cima</DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-3">
            {envios.map((e) => {
              const s = SITUACAO[e.situacao];
              const substituida = e.situacao === "aprovado" && atual && atual.envio_id !== e.envio_id;
              return (
                <li key={e.envio_id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {substituida ? <StatusPill tone="neutro">Substituída</StatusPill> : <StatusPill tone={s.tone}>{s.label}</StatusPill>}
                    {atual?.envio_id === e.envio_id && <StatusPill tone="andamento">Versão atual</StatusPill>}
                    <span className="text-xs text-muted-foreground">
                      {dataHoraBR(e.criado_em)} · {e.origem === "link" ? "pelo link do cliente" : `por ${e.enviado_por}`}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      {podeEditar && (
                        <Button type="button" variant="ghost" size="icon-sm" title="Validade e observação" aria-label="Validade e observação" onClick={() => setValidade(e)}>
                          <CalendarIcon />
                        </Button>
                      )}
                      {podeExcluir && (
                        <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" title="Excluir versão" aria-label="Excluir versão" onClick={() => setExcluir(e)}>
                          <Trash2Icon />
                        </Button>
                      )}
                    </span>
                  </div>
                  {(e.validade || e.observacao) && (
                    <p className="text-xs text-muted-foreground">
                      {e.validade && <>Vence em {dataBR(e.validade)}</>}
                      {e.validade && e.observacao && " · "}
                      {e.observacao}
                    </p>
                  )}
                  {e.analisado_por && e.origem === "link" && (
                    <p className="text-xs text-muted-foreground">
                      {e.situacao === "recusado" ? "Recusado" : "Aprovado"} por {e.analisado_por} em {dataHoraBR(e.analisado_em)}
                    </p>
                  )}
                  {e.motivo_recusa && <p className="rounded-md bg-destructive/[0.08] px-2.5 py-1.5 text-xs text-destructive">Motivo: {e.motivo_recusa}</p>}
                  <div className="flex flex-col gap-1">
                    {e.arquivos.map((a) => (
                      <LinhaArquivo key={a.id} a={a} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
          <DialogFooter>
            <Button type="button" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {validade && <ValidadeDialog envio={validade} operacaoId={operacaoId} onClose={() => setValidade(null)} />}
      <ConfirmDialog
        open={!!excluir}
        onOpenChange={(o) => !o && setExcluir(null)}
        title="Excluir esta versão?"
        description="Ela sai da pasta do sistema. O arquivo não é apagado: vai para a pasta _Excluídos da operação."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => excluir && apagar.mutate(excluir)}
      />
    </>
  );
}

export function ValidadeDialog({ envio, operacaoId, onClose }: { envio: Envio; operacaoId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [validade, setValidade] = useState(envio.validade ?? "");
  const [observacao, setObservacao] = useState(envio.observacao ?? "");
  const salvar = useMutation({
    mutationFn: () => api(`/documentos/envio/${envio.envio_id}`, { metodo: "PUT", corpo: { validade, observacao } }),
    onSuccess: async () => {
      toast.success("Validade salva.");
      await qc.invalidateQueries({ queryKey: ["operacao", operacaoId] });
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Validade do documento</DialogTitle>
            <DialogDescription>Deixe em branco se o documento não vence.</DialogDescription>
          </DialogHeader>
          <FormField label="Vence em" htmlFor="val-data">
            <Input id="val-data" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </FormField>
          <FormField label="Observação" htmlFor="val-obs">
            <Textarea id="val-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending && <Spinner data-icon="inline-start" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
