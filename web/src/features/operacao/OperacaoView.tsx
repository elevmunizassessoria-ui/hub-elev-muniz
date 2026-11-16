import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowRightLeftIcon,
  CalendarIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileStackIcon,
  FileUpIcon,
  FolderOpenIcon,
  HistoryIcon,
  LinkIcon,
  MessageCircleIcon,
  PencilIcon,
  RefreshCwIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";

import { Carregando } from "@/components/Carregando";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Bloco } from "@/components/Bloco";
import { ListaHistorico } from "@/components/Historico";
import { BarraObrigatorios } from "@/components/Resumo";
import { RowActions } from "@/components/RowActions";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { useMigalhas } from "@/app/migalhas";
import { usePode, useUsuario } from "@/app/sessao";
import { CreditoDaOperacao } from "@/features/credito/CreditoDaOperacao";
import { copiar, linkWhatsApp, mensagemDoLink } from "@/lib/acoes";
import { abrirArquivo, api } from "@/lib/api";
import { ESTADO_ITEM, ESTADO_NO_PEDIDO, SITUACAO_PEDIDO, SLA_OPERACAO } from "@/lib/estados";
import { dataBR, dataHoraBR, plural, prazoTexto } from "@/lib/formato";
import type { Configuracoes, Envio, ItemOperacao } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { OperacaoDialog } from "@/features/clientes/OperacaoDialog";
import { MudarEtapaDialog, PrazoPill, TransferirDialog } from "@/features/operacoes/OperacoesView";
import { EnviarArquivoDialog } from "./EnviarArquivoDialog";
import { LinkGerado, PedirDocumentosDialog } from "./PedirDocumentosDialog";
import { PerfilOperacaoForm } from "./PerfilOperacaoForm";
import type { DadosOperacao } from "./tipos";
import { IconeArquivo, ValidadeDialog, VersoesDialog } from "./VersoesDialog";

type Filtro = "todos" | "pendentes";

export function OperacaoView({ operacaoId }: { operacaoId: number }) {
  const qc = useQueryClient();
  const podeOp = usePode("operacoes", "editar");
  const podeCli = usePode("clientes", "editar");
  const podeEditar = podeOp || podeCli;
  const podePedir = usePode("solicitacoes", "editar");
  const podeCredito = usePode("credito");
  const [enviar, setEnviar] = useState<{ item: ItemOperacao | null } | null>(null);
  const [versoes, setVersoes] = useState<{ titulo: string; envios: Envio[] } | null>(null);
  const [validade, setValidade] = useState<Envio | null>(null);
  const [pedir, setPedir] = useState(false);
  const [verLink, setVerLink] = useState(false);
  const [perfil, setPerfil] = useState(false);
  const [editar, setEditar] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [transferir, setTransferir] = useState(false);
  const [mudarEtapa, setMudarEtapa] = useState(false);
  const eu = useUsuario();

  const consulta = useQuery({ queryKey: ["operacao", operacaoId], queryFn: () => api<DadosOperacao>(`/operacoes/${operacaoId}`) });
  const config = useQuery({ queryKey: ["configuracoes"], queryFn: () => api<{ configuracoes: Configuracoes }>("/configuracoes") });
  const d = consulta.data;
  const clienteId = d?.cliente.id ?? 0;
  useMigalhas([
    { label: "Operações", caminho: "/operacoes" },
    { label: d?.operacao.nome ?? "…" },
  ]);

  const atualizar = async () => {
    await qc.invalidateQueries({ queryKey: ["operacao", operacaoId] });
    await qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
    await qc.invalidateQueries({ queryKey: ["solicitacoes"] });
    await qc.invalidateQueries({ queryKey: ["clientes"] });
  };
  const erro = (e: unknown) => toast.error((e as Error).message);
  const renovar = useMutation({
    mutationFn: (id: number) => api(`/solicitacoes/${id}/reenviar`, { corpo: {} }),
    onSuccess: async () => {
      toast.success("Prazo do link renovado.");
      await atualizar();
    },
    onError: erro,
  });
  const cancelarPedido = useMutation({
    mutationFn: (id: number) => api(`/solicitacoes/${id}/cancelar`, { corpo: {} }),
    onSuccess: async () => {
      toast.success("Pedido cancelado. Os arquivos já enviados continuam na pasta.");
      await atualizar();
    },
    onError: erro,
  });
  const situacao = useMutation({
    mutationFn: () =>
      api(`/operacoes/${operacaoId}`, { metodo: "PUT", corpo: { nome: d!.operacao.nome, descricao: d!.operacao.descricao, situacao: d!.operacao.situacao === "ativa" ? "encerrada" : "ativa" } }),
    onSuccess: atualizar,
    onError: erro,
  });

  const grupos = useMemo(() => {
    const m = new Map<string, ItemOperacao[]>();
    for (const i of d?.itens ?? []) {
      if (filtro === "pendentes" && (i.estado === "aprovado" || (!i.obrigatorio && i.estado === "falta"))) continue;
      m.set(i.grupo, [...(m.get(i.grupo) ?? []), i]);
    }
    return [...m.entries()];
  }, [d, filtro]);

  if (consulta.isPending) return <Carregando />;
  if (consulta.isError || !d) return <EstadoVazio title="Operação não encontrada" description={(consulta.error as Error)?.message} />;
  const { operacao: o, resumo, pedido_aberto: pedido } = d;
  const ativa = o.situacao === "ativa";

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex w-full flex-col gap-4 p-4 lg:p-5">
        {/* Cabeçalho da operação */}
        <section className="flex flex-wrap items-start gap-4 rounded-[14px] bg-card p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary-text [&>svg]:size-6" aria-hidden>
            <FolderOpenIcon />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-[-0.011em]">{o.nome}</h1>
              {!ativa && <StatusPill tone="neutro">Encerrada</StatusPill>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {o.codigo} · {d.cliente.nome}
              {` · ${o.consultor_nome || "Sem consultor"}`}
              {o.perfil_documento_nome && ` · ${o.perfil_documento_nome}`}
              {o.descricao && ` · ${o.descricao}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {podeEditar && (
              <Button variant="secondary" onClick={() => setPerfil(true)}>
                <FileStackIcon data-icon="inline-start" />
                Documentos exigidos
              </Button>
            )}
            {podePedir && ativa && (
              <Button  onClick={() => setPedir(true)} disabled={d.itens.length === 0}>
                <SendIcon data-icon="inline-start" />
                Pedir documentos
              </Button>
            )}
            <RowActions
              label="Mais ações da operação"
              items={[
                podeEditar && { label: "Enviar outro arquivo", icon: <FileUpIcon />, onSelect: () => setEnviar({ item: null }) },
                podeEditar && { label: "Editar operação", icon: <PencilIcon />, onSelect: () => setEditar(true) },
                podeEditar && { label: ativa ? "Encerrar operação" : "Reabrir operação", icon: ativa ? <ArchiveIcon /> : <ArchiveRestoreIcon />, onSelect: () => situacao.mutate() },
              ]}
            />
          </div>
        </section>

        {/* Etapas: onde a operação está e o prazo */}
        <section className="flex flex-col gap-3 rounded-[14px] bg-card p-4">
          <ol className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
            {o.etapas.map((e, i) => {
              const feita = e.ordem < o.etapa_ordem;
              const agora = e.id === o.etapa_id;
              return (
                <li key={e.id} className="flex shrink-0 items-center gap-1">
                  {i > 0 && <span aria-hidden className={cn("h-px w-6", feita || agora ? "bg-primary" : "bg-border")} />}
                  <span className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-[13px] whitespace-nowrap", agora ? "bg-primary font-medium text-primary-foreground" : feita ? "bg-primary/[0.14] text-primary-ink" : "bg-foreground/[0.06] text-muted-foreground")}>
                    {e.nome}
                    {!e.final && <span className="text-xs opacity-75">{e.prazo_dias}d</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <PrazoPill o={o} />
            <span className="text-[13px] text-muted-foreground">{SLA_OPERACAO[o.sla].label} em {o.etapa_nome}</span>
            <span className="ml-auto flex items-center gap-2">
              {podeEditar && (
                <Button variant="secondary" size="sm" onClick={() => setMudarEtapa(true)}>
                  Mudar de etapa
                </Button>
              )}
              {eu.admin && (
                <Button variant="secondary" size="sm" onClick={() => setTransferir(true)}>
                  <ArrowRightLeftIcon data-icon="inline-start" />
                  Transferir
                </Button>
              )}
            </span>
          </div>
        </section>

        {/* Números da pasta */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Numero rotulo="Obrigatórios" valor={<BarraObrigatorios resumo={resumo} compacta />} />
          <Numero rotulo="Para aprovar" valor={resumo.aguardando} tom={resumo.aguardando > 0 ? "aguardando" : undefined} />
          <Numero rotulo="Vencidos" valor={resumo.vencidos} tom={resumo.vencidos > 0 ? "negativo" : undefined} />
          <Numero rotulo="Vencem em breve" valor={resumo.vencendo} tom={resumo.vencendo > 0 ? "aguardando" : undefined} />
          <Numero rotulo="Faltam enviar" valor={(resumo.faltando ?? 0) + resumo.recusados} />
        </div>

        {/* O crédito da operação: proposta, parceiro, garantia, contrato e comissão */}
        {podeCredito && <CreditoDaOperacao operacaoId={o.id} />}

        {/* Pedido aberto ao cliente */}
        {pedido && (
          <section className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/[0.05] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <LinkIcon className="size-4 text-primary-text" />
              <span className="text-sm font-semibold">Pedido aberto ao cliente</span>
              <StatusPill tone={SITUACAO_PEDIDO[pedido.situacao].tone}>{SITUACAO_PEDIDO[pedido.situacao].label}</StatusPill>
              <span className="text-sm text-muted-foreground">
                {pedido.enviados} de {pedido.itens.length} enviados · {pedido.situacao === "vencida" ? "venceu em" : "vale até"} {dataBR(pedido.expira_em)}
              </span>
              {podePedir && (
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  {pedido.link && pedido.situacao !== "vencida" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => void copiar(pedido.link!, "Link copiado.")}>
                        <CopyIcon data-icon="inline-start" />
                        Copiar link
                      </Button>
                      {d.cliente.telefone && (
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={linkWhatsApp(
                              d.cliente.telefone,
                              mensagemDoLink({ empresa: config.data?.configuracoes.empresa_nome ?? "", contato: d.cliente.contato, operacao: o.nome, link: pedido.link, prazo: dataBR(pedido.expira_em) }),
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircleIcon data-icon="inline-start" />
                            WhatsApp
                          </a>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setVerLink(true)}>
                        <ExternalLinkIcon data-icon="inline-start" />
                        Ver link
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => renovar.mutate(pedido.id)} disabled={renovar.isPending}>
                    <RefreshCwIcon data-icon="inline-start" />
                    Renovar prazo
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setCancelar(true)}>
                    <XCircleIcon data-icon="inline-start" />
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pedido.itens.map((i) => (
                <StatusPill key={i.id} tone={ESTADO_NO_PEDIDO[i.estado].tone}>
                  {i.nome}
                </StatusPill>
              ))}
            </div>
            {pedido.mensagem && <p className="text-xs text-muted-foreground">Recado: {pedido.mensagem}</p>}
          </section>
        )}

        {/* Documentos exigidos, por grupo */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Documentos da operação</h2>
          <span className="text-sm text-muted-foreground">{plural(d.itens.length, "documento", "documentos")}</span>
          <div className="ml-auto inline-flex gap-0.5 rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Mostrar">
            {(
              [
                ["todos", "Todos"],
                ["pendentes", "Só pendências"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={filtro === v}
                onClick={() => setFiltro(v)}
                className="h-7 rounded-md px-2.5 text-xs font-medium text-muted-foreground outline-none hover:text-foreground aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-[0_1px_2px_rgb(0_0_0/0.18)] dark:aria-checked:bg-accent"
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {d.itens.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EstadoVazio
              compact
              icon={<FileStackIcon />}
              title="Esta operação ainda não exige documentos"
              description="Escolha um perfil pronto ou marque os documentos que esta operação exige."
              action={
                podeEditar && (
                  <Button variant="secondary" onClick={() => setPerfil(true)}>
                    <FileStackIcon data-icon="inline-start" />
                    Escolher os documentos
                  </Button>
                )
              }
            />
          </div>
        ) : grupos.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EstadoVazio compact title="Nenhuma pendência" description="Todos os documentos obrigatórios estão aprovados." />
          </div>
        ) : (
          grupos.map(([grupo, itens]) => (
            <Bloco key={grupo} title={grupo}>
              {itens.map((i) => (
                <LinhaDocumento
                  key={i.id}
                  item={i}
                  podeEditar={podeEditar}
                  onEnviar={() => setEnviar({ item: i })}
                  onVersoes={() => setVersoes({ titulo: i.nome, envios: i.versoes })}
                  onValidade={() => i.atual && setValidade(i.atual)}
                />
              ))}
            </Bloco>
          ))
        )}

        {d.avulsos.length > 0 && (
          <Bloco title={`Outros arquivos (${d.avulsos.length})`}>
            {d.avulsos.map((e) => (
              <div key={e.envio_id} className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
                <IconeArquivo tipo={e.arquivos[0]?.arquivo_tipo ?? ""} className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{e.arquivos.map((a) => a.arquivo_nome).join(", ")}</span>
                <span className="text-xs text-muted-foreground">
                  {dataHoraBR(e.criado_em)} · {e.enviado_por}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setVersoes({ titulo: "Outros arquivos", envios: [e] })}>
                  Abrir
                </Button>
              </div>
            ))}
          </Bloco>
        )}

        <Bloco title="Histórico da operação" className="max-h-96 overflow-y-auto">
          <ListaHistorico itens={d.historico} />
        </Bloco>
      </div>

      {transferir && <TransferirDialog operacao={o} onClose={() => setTransferir(false)} />}
      {mudarEtapa && <MudarEtapaDialog operacao={o} onClose={() => setMudarEtapa(false)} />}
      {enviar && <EnviarArquivoDialog operacaoId={o.id} item={enviar.item} onClose={() => setEnviar(null)} />}
      {versoes && <VersoesDialog titulo={versoes.titulo} envios={versoes.envios} operacaoId={o.id} onClose={() => setVersoes(null)} />}
      {validade && <ValidadeDialog envio={validade} operacaoId={o.id} onClose={() => setValidade(null)} />}
      {pedir && <PedirDocumentosDialog dados={d} onClose={() => setPedir(false)} />}
      {verLink && pedido && <LinkGerado solicitacao={pedido} onClose={() => setVerLink(false)} />}
      {perfil && <PerfilOperacaoForm dados={d} onClose={() => setPerfil(false)} />}
      {editar && <OperacaoDialog clienteId={clienteId} operacao={o} onClose={() => setEditar(false)} onSaved={() => setEditar(false)} />}
      <ConfirmDialog
        open={cancelar}
        onOpenChange={setCancelar}
        title="Cancelar o pedido?"
        description="O link para de funcionar. Os arquivos que o cliente já enviou continuam na pasta."
        confirmLabel="Cancelar pedido"
        destructive
        onConfirm={() => pedido && cancelarPedido.mutate(pedido.id)}
      />
    </div>
  );
}

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: React.ReactNode; tom?: "aguardando" | "negativo" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[14px] bg-card px-4 py-3">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span
        className={cn(
          "text-xl leading-tight font-bold tracking-tight tabular-nums",
          tom === "aguardando" && "text-amber-600 dark:text-amber-400",
          tom === "negativo" && "text-destructive",
        )}
      >
        {valor}
      </span>
    </div>
  );
}

function LinhaDocumento({
  item: i,
  podeEditar,
  onEnviar,
  onVersoes,
  onValidade,
}: {
  item: ItemOperacao;
  podeEditar: boolean;
  onEnviar: () => void;
  onVersoes: () => void;
  onValidade: () => void;
}) {
  const estado = ESTADO_ITEM[i.estado];
  const atual = i.atual;
  const primeiro = (i.pendente ?? atual)?.arquivos[0];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1 basis-64">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{i.nome}</span>
          {i.obrigatorio && <span className="text-xs text-destructive">obrigatório</span>}
          {i.frente_verso && <span className="text-xs text-muted-foreground">· frente e verso</span>}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {atual
            ? [
                `Enviado em ${dataBR(atual.criado_em)}`,
                atual.validade ? `vence em ${dataBR(atual.validade)}${i.dias_para_vencer !== null ? ` (${prazoTexto(i.dias_para_vencer)})` : ""}` : i.exige_validade ? "sem validade informada" : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : i.pendente
              ? `O cliente enviou em ${dataHoraBR(i.pendente.criado_em)}`
              : i.recusado
                ? `Recusado: ${i.recusado.motivo_recusa}`
                : i.descricao || (i.exige_validade ? "Documento com validade" : "Ainda não enviado")}
        </p>
      </div>
      <StatusPill tone={estado.tone}>{i.estado === "vencendo" ? prazoTexto(i.dias_para_vencer).replace(/^v/, "V") : estado.label}</StatusPill>
      <div className="flex shrink-0 items-center gap-1">
        {primeiro && (
          <Button size="sm" variant="ghost" asChild>
            <button type="button" onClick={() => abrirArquivo(primeiro.id).catch((e) => toast.error((e as Error).message))}>
              <ExternalLinkIcon data-icon="inline-start" />
              Abrir
            </button>
          </Button>
        )}
        {podeEditar && (
          <Button size="sm" variant={i.estado === "falta" || i.estado === "vencido" || i.estado === "recusado" ? "outline" : "ghost"} onClick={onEnviar}>
            <FileUpIcon data-icon="inline-start" />
            {atual ? "Nova versão" : "Enviar"}
          </Button>
        )}
        <RowActions
          label={`Mais ações de ${i.nome}`}
          items={[
            i.versoes.length > 0 && { label: `Versões e arquivos (${i.versoes.length})`, icon: <HistoryIcon />, onSelect: onVersoes },
            podeEditar && atual && { label: "Alterar validade", icon: <CalendarIcon />, onSelect: onValidade },
          ]}
        />
      </div>
    </div>
  );
}
