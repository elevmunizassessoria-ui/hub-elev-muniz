import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CopyIcon, FolderOpenIcon, HistoryIcon, LinkIcon, RefreshCwIcon, SearchXIcon, SendIcon, XCircleIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Pagination, usePagination } from "@/components/Pagination";
import { ReportTable, type ReportColumn } from "@/components/ReportTable";
import { FormField } from "@/components/FormPage";
import { PainelFiltro, ferramentaFiltro } from "@/components/PainelFiltro";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/StatusPill";
import { Skeleton } from "@/components/ui/skeleton";
import { useFerramentas } from "@/app/faixa";
import { useMigalhas } from "@/app/migalhas";
import { navegar } from "@/app/rotas";
import { usePode } from "@/app/sessao";
import { copiar } from "@/lib/acoes";
import { api } from "@/lib/api";
import { SITUACAO_PEDIDO } from "@/lib/estados";
import { dataBR, normalizar } from "@/lib/formato";
import type { Solicitacao } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { LinkGerado } from "@/features/operacao/PedirDocumentosDialog";


/** Acompanhamento dos pedidos de documentos feitos aos clientes. */
export function SolicitacoesView() {
  useMigalhas([{ label: "Documentos", caminho: "/documentos" }, { label: "Pedidos" }]);
  const qc = useQueryClient();
  const podeEditar = usePode("solicitacoes", "editar");
  const [abertas, setAbertas] = useState<"abertas" | "todas">("abertas");
  const [busca, setBusca] = useState("");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [link, setLink] = useState<Solicitacao | null>(null);
  const [cancelar, setCancelar] = useState<Solicitacao | null>(null);
  const consulta = useQuery({
    queryKey: ["solicitacoes", abertas],
    queryFn: () => api<{ solicitacoes: Solicitacao[] }>(`/solicitacoes?abertas=${abertas === "abertas" ? 1 : 0}`),
  });
  const atualizar = async () => {
    await qc.invalidateQueries({ queryKey: ["solicitacoes"] });
    await qc.invalidateQueries({ queryKey: ["operacao"] });
  };
  const renovar = useMutation({
    mutationFn: (s: Solicitacao) => api(`/solicitacoes/${s.id}/reenviar`, { corpo: {} }),
    onSuccess: async () => {
      toast.success("Prazo do link renovado.");
      await atualizar();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const cancelarPedido = useMutation({
    mutationFn: (s: Solicitacao) => api(`/solicitacoes/${s.id}/cancelar`, { corpo: {} }),
    onSuccess: async () => {
      toast.success("Pedido cancelado.");
      await atualizar();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const lista = consulta.data?.solicitacoes ?? [];
  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return lista;
    return lista.filter((s) => normalizar([s.cliente_nome, s.operacao_nome, ...s.itens.map((i) => i.nome)].join(" ")).includes(termo));
  }, [lista, busca]);
  const pager = usePagination(filtrados, `${busca}|${abertas}`, "pedidos");
  useFerramentas([
    {
      titulo: "Filtrar",
      ferramentas: [
        { id: "abertos", label: "Abertos", icon: SendIcon, tom: "cinza", ativo: abertas === "abertas", run: () => setAbertas("abertas") },
        { id: "todos", label: "90 dias", icon: HistoryIcon, tom: "cinza", ativo: abertas === "todas", run: () => setAbertas("todas") },
        ferramentaFiltro(() => setFiltroAberto(true), busca.trim() ? 1 : 0),
      ],
    },
  ]);
  const aberto = (s: Solicitacao) => s.situacao === "aguardando" || s.situacao === "em_analise" || s.situacao === "vencida";

  const colunas: ReportColumn<Solicitacao>[] = [
    {
      id: "cliente",
      header: "Cliente · Operação",
      primary: true,
      cell: (s) => (
        <span className="truncate">
          <span className="font-medium">{s.cliente_nome}</span>
          <span className="text-muted-foreground"> · {s.operacao_nome}</span>
        </span>
      ),
    },
    {
      id: "docs",
      header: "Documentos",
      width: "11rem",
      cell: (s) => (
        <span className="tabular-nums">
          {s.enviados} de {s.itens.length} <span className="text-muted-foreground">enviados</span>
        </span>
      ),
    },
    { id: "situacao", header: "Situação", width: "11rem", cell: (s) => <StatusPill tone={SITUACAO_PEDIDO[s.situacao].tone}>{SITUACAO_PEDIDO[s.situacao].label}</StatusPill> },
    {
      id: "vence",
      header: "Link vale até",
      width: "8.5rem",
      cell: (s) => <span className={cn(s.situacao === "vencida" && "font-medium text-destructive")}>{aberto(s) ? dataBR(s.expira_em) : "—"}</span>,
    },
    {
      id: "pedido",
      header: "Pedido em",
      width: "13rem",
      hideBelow: "lg",
      cell: (s) => (
        <span className="truncate">
          {dataBR(s.criado_em)}
          {s.criado_por && <span className="text-muted-foreground"> · {s.criado_por}</span>}
        </span>
      ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
        {consulta.isPending ? (
          <div className="flex flex-col gap-2 pt-1">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <ReportTable
              label="Pedidos de documentos"
              columns={colunas}
              bulk={[
                { id: "pasta", label: "Abrir a pasta", icon: FolderOpenIcon, unico: true, run: ([s]) => navegar(`/operacoes/${s.operacao_id}`) },
                podeEditar && { id: "copiar", label: "Copiar link", icon: CopyIcon, unico: true, applies: (s) => aberto(s) && s.situacao !== "vencida" && !!s.link, run: ([s]) => void copiar(s.link!, "Link copiado.") },
                podeEditar && { id: "link", label: "Ver link", icon: LinkIcon, unico: true, applies: (s) => aberto(s) && s.situacao !== "vencida" && !!s.link, run: ([s]) => setLink(s) },
                podeEditar && { id: "renovar", label: "Renovar prazo", icon: RefreshCwIcon, unico: true, applies: aberto, run: ([s]) => renovar.mutate(s) },
                podeEditar && { id: "cancelar", label: "Cancelar pedido", icon: XCircleIcon, destructive: true, unico: true, applies: aberto, run: ([s]) => setCancelar(s) },
              ]}
              rows={pager.rows}
              rowKey={(s) => String(s.id)}
              onOpen={(s) => navegar(`/operacoes/${s.operacao_id}`)}
              openLabel={(s) => `Abrir ${s.operacao_nome}`}
              scrollKey={pager.page}
              empty={
                busca ? (
                  <EstadoVazio compact icon={<SearchXIcon />} title="Nenhum pedido com essa busca" />
                ) : (
                  <EstadoVazio
                    compact
                    icon={<SendIcon />}
                    title={abertas === "abertas" ? "Nenhum pedido aberto" : "Nenhum pedido nos últimos 90 dias"}
                    description="Os pedidos nascem na pasta da operação, no botão Pedir documentos."
                  />
                )
              }
            />
            <Pagination pager={pager} total={filtrados.length} />
          </>
        )}
      <PainelFiltro aberto={filtroAberto} onClose={() => setFiltroAberto(false)} mostrando={filtrados.length} total={lista.length} onLimpar={() => setBusca("")}>
        <FormField label="Busca" htmlFor="so-busca">
          <Input id="so-busca" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente, operação ou documento" />
        </FormField>
      </PainelFiltro>
      {link && <LinkGerado solicitacao={link} onClose={() => setLink(null)} />}
      <ConfirmDialog
        open={!!cancelar}
        onOpenChange={(o) => !o && setCancelar(null)}
        title="Cancelar o pedido?"
        description="O link para de funcionar. Os arquivos que o cliente já enviou continuam na pasta."
        confirmLabel="Cancelar pedido"
        destructive
        onConfirm={() => cancelar && cancelarPedido.mutate(cancelar)}
      />
    </div>
  );
}
