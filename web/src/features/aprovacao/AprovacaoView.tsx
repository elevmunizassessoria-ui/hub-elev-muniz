import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckIcon, FileCheck2Icon, FolderOpenIcon, HourglassIcon, XIcon } from "lucide-react";

import { EstadoVazio } from "@/components/EstadoVazio";
import { FormField } from "@/components/FormPage";
import { PainelFiltro, ferramentaFiltro } from "@/components/PainelFiltro";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFerramentas } from "@/app/faixa";
import { useMigalhas } from "@/app/migalhas";
import { navegar } from "@/app/rotas";
import { usePode } from "@/app/sessao";
import { api } from "@/lib/api";
import { dataBR, dataHoraBR, normalizar, plural } from "@/lib/formato";
import type { EnvioAprovacao } from "@/lib/tipos";
import { LinhaArquivo } from "@/features/operacao/VersoesDialog";

type Situacao = "pendente" | "aprovado" | "recusado";

/** O que os clientes mandaram pelo link, agrupado por operação: aprovar ou recusar. */
export function AprovacaoView() {
  useMigalhas([{ label: "Documentos", caminho: "/documentos" }, { label: "Aprovação" }]);
  const qc = useQueryClient();
  const podeEditar = usePode("aprovacao", "editar");
  const [situacao, setSituacao] = useState<Situacao>("pendente");
  const [busca, setBusca] = useState("");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [recusar, setRecusar] = useState<EnvioAprovacao | null>(null);
  const [aprovarComData, setAprovarComData] = useState<EnvioAprovacao | null>(null);
  const consulta = useQuery({
    queryKey: ["aprovacao", situacao],
    queryFn: () => api<{ envios: EnvioAprovacao[] }>(`/aprovacao?situacao=${situacao}`),
  });

  const atualizar = async () => {
    await qc.invalidateQueries({ queryKey: ["aprovacao"] });
    await qc.invalidateQueries({ queryKey: ["operacao"] });
    await qc.invalidateQueries({ queryKey: ["solicitacoes"] });
    await qc.invalidateQueries({ queryKey: ["clientes"] });
  };
  const analisar = useMutation({
    mutationFn: ({ envio, acao, motivo, validade }: { envio: EnvioAprovacao; acao: "aprovar" | "recusar"; motivo?: string; validade?: string }) =>
      api(`/aprovacao/${envio.envio_id}`, { corpo: { acao, motivo, ...(validade !== undefined ? { validade } : {}) } }),
    onSuccess: async (_r, v) => {
      toast.success(v.acao === "aprovar" ? `${v.envio.item_nome} aprovado.` : `${v.envio.item_nome} recusado. O link volta a pedir esse documento.`);
      setRecusar(null);
      setAprovarComData(null);
      await atualizar();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const grupos = useMemo(() => {
    const termo = normalizar(busca.trim());
    const m = new Map<number, { cliente: string; operacao: string; clienteId: number; operacaoId: number; envios: EnvioAprovacao[] }>();
    for (const e of consulta.data?.envios ?? []) {
      if (termo && !normalizar(`${e.cliente_nome} ${e.operacao_nome} ${e.item_nome}`).includes(termo)) continue;
      if (!m.has(e.operacao_id)) m.set(e.operacao_id, { cliente: e.cliente_nome, operacao: e.operacao_nome, clienteId: e.cliente_id, operacaoId: e.operacao_id, envios: [] });
      m.get(e.operacao_id)!.envios.push(e);
    }
    return [...m.values()];
  }, [consulta.data, busca]);

  useFerramentas([
    {
      titulo: "Situação",
      ferramentas: [
        { id: "pendente", label: "Aguardando", icon: HourglassIcon, tom: "cinza", ativo: situacao === "pendente", run: () => setSituacao("pendente") },
        { id: "aprovado", label: "Aprovados", icon: CheckIcon, tom: "verde", ativo: situacao === "aprovado", run: () => setSituacao("aprovado") },
        { id: "recusado", label: "Recusados", icon: XIcon, tom: "vermelho", ativo: situacao === "recusado", run: () => setSituacao("recusado") },
      ],
    },
    { titulo: "Filtrar", ferramentas: [ferramentaFiltro(() => setFiltroAberto(true), busca.trim() ? 1 : 0)] },
  ]);

  const aprovar = (e: EnvioAprovacao) => {
    if (e.exige_validade && !e.validade) setAprovarComData(e);
    else analisar.mutate({ envio: e, acao: "aprovar" });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
        {consulta.isPending ? (
          <div className="flex flex-col gap-3 pt-1">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : grupos.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EstadoVazio
              icon={<FileCheck2Icon />}
              title={situacao === "pendente" ? "Nada para aprovar" : situacao === "aprovado" ? "Nenhum documento aprovado" : "Nenhum documento recusado"}
              description={situacao === "pendente" ? "Quando o cliente enviar documentos pelo link, eles aparecem aqui." : undefined}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {grupos.map((g) => (
              <section key={g.operacaoId} className="rounded-xl border bg-card">
                <div className="flex flex-wrap items-center gap-2 rounded-t-xl border-b bg-muted/60 px-4 py-2 dark:bg-white/[0.035]">
                  <button type="button" onClick={() => navegar(`/operacoes/${g.operacaoId}`)} className="min-w-0 truncate text-left text-sm outline-none hover:underline focus-visible:underline">
                    <span className="font-semibold">{g.cliente}</span>
                    <span className="text-muted-foreground"> · {g.operacao}</span>
                  </button>
                  <span className="text-xs text-muted-foreground">{plural(g.envios.length, "documento", "documentos")}</span>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => navegar(`/operacoes/${g.operacaoId}`)}>
                    <FolderOpenIcon data-icon="inline-start" />
                    Abrir pasta
                  </Button>
                </div>
                {g.envios.map((e) => (
                  <div key={e.envio_id} className="flex flex-wrap items-start gap-4 border-b px-4 py-3 last:border-b-0">
                    <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{e.item_nome}</span>
                        <span className="text-xs text-muted-foreground">enviado em {dataHoraBR(e.criado_em)}</span>
                        {e.validade && <span className="text-xs text-muted-foreground">· vence em {dataBR(e.validade)}</span>}
                      </p>
                      {e.arquivos.map((a) => (
                        <LinhaArquivo key={a.id} a={a} />
                      ))}
                      {e.situacao !== "pendente" && e.analisado_por && (
                        <p className="text-xs text-muted-foreground">
                          {e.situacao === "aprovado" ? "Aprovado" : "Recusado"} por {e.analisado_por} em {dataHoraBR(e.analisado_em)}
                        </p>
                      )}
                      {e.motivo_recusa && <p className="rounded-md bg-destructive/[0.08] px-2.5 py-1.5 text-xs text-destructive">Motivo: {e.motivo_recusa}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {e.situacao === "pendente" ? (
                        podeEditar && (
                          <>
                            <Button size="sm" className="bg-[#28B14C] text-white hover:bg-[#28B14C]/85" onClick={() => aprovar(e)} disabled={analisar.isPending}>
                              <CheckIcon data-icon="inline-start" />
                              Aprovar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setRecusar(e)} disabled={analisar.isPending}>
                              <XIcon data-icon="inline-start" />
                              Recusar
                            </Button>
                          </>
                        )
                      ) : (
                        <StatusPill tone={e.situacao === "aprovado" ? "concluido" : "negativo"}>{e.situacao === "aprovado" ? "Aprovado" : "Recusado"}</StatusPill>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
      <PainelFiltro aberto={filtroAberto} onClose={() => setFiltroAberto(false)} mostrando={grupos.reduce((t, g) => t + g.envios.length, 0)} total={consulta.data?.envios.length ?? 0} onLimpar={() => setBusca("")}>
        <FormField label="Busca" htmlFor="ap-busca">
          <Input id="ap-busca" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente, operação ou documento" />
        </FormField>
      </PainelFiltro>
      {recusar && <RecusarDialog envio={recusar} ocupado={analisar.isPending} onClose={() => setRecusar(null)} onConfirm={(motivo) => analisar.mutate({ envio: recusar, acao: "recusar", motivo })} />}
      {aprovarComData && (
        <AprovarComValidade envio={aprovarComData} ocupado={analisar.isPending} onClose={() => setAprovarComData(null)} onConfirm={(validade) => analisar.mutate({ envio: aprovarComData, acao: "aprovar", validade })} />
      )}
    </div>
  );
}

function RecusarDialog({ envio, ocupado, onClose, onConfirm }: { envio: EnvioAprovacao; ocupado: boolean; onClose: () => void; onConfirm: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (motivo.trim().length >= 3) onConfirm(motivo.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>Recusar {envio.item_nome}</DialogTitle>
            <DialogDescription>O cliente vê este motivo no link e pode enviar de novo.</DialogDescription>
          </DialogHeader>
          <FormField label="Motivo" htmlFor="rec-motivo" required help={`${motivo.length}/300`}>
            <Textarea id="rec-motivo" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} placeholder="Ex.: documento vencido, foto cortada, falta a última página." />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={ocupado || motivo.trim().length < 3}>
              {ocupado && <Spinner data-icon="inline-start" />}
              Recusar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AprovarComValidade({ envio, ocupado, onClose, onConfirm }: { envio: EnvioAprovacao; ocupado: boolean; onClose: () => void; onConfirm: (validade: string) => void }) {
  const [validade, setValidade] = useState(envio.validade ?? "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (validade) onConfirm(validade);
          }}
        >
          <DialogHeader>
            <DialogTitle>Aprovar {envio.item_nome}</DialogTitle>
            <DialogDescription>Este documento tem validade. Confira no arquivo e informe a data.</DialogDescription>
          </DialogHeader>
          <FormField label="Vence em" htmlFor="apr-validade" required>
            <Input id="apr-validade" type="date" autoFocus value={validade} onChange={(e) => setValidade(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={ocupado || !validade}>
              {ocupado && <Spinner data-icon="inline-start" />}
              Aprovar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
