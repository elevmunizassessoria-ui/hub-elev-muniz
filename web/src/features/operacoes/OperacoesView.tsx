import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeftIcon, FolderKanbanIcon, FolderOpenIcon, ListChecksIcon, PlusIcon, SearchXIcon } from "lucide-react";

import { Escolha } from "@/components/Escolha";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FormField } from "@/components/FormPage";
import { PainelFiltro, ferramentaFiltro } from "@/components/PainelFiltro";
import { Pagination, usePagination } from "@/components/Pagination";
import { ReportTable, type ReportColumn } from "@/components/ReportTable";
import { BarraObrigatorios } from "@/components/Resumo";
import { StatsLine } from "@/components/StatsLine";
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
import { usePode, useUsuario } from "@/app/sessao";
import { api } from "@/lib/api";
import { SLA_OPERACAO } from "@/lib/estados";
import { normalizar } from "@/lib/formato";
import type { Consultor, Operacao } from "@/lib/tipos";
import { OperacaoDialog } from "@/features/clientes/OperacaoDialog";

type Situacao = "" | "ativas" | "atrasadas" | "perto" | "sem_consultor" | "encerradas";

/** Prazo da etapa: "3,5 de 5 dias", com a situação. */
export function PrazoPill({ o }: { o: Pick<Operacao, "sla" | "dias_na_etapa" | "prazo_dias"> }) {
  const s = SLA_OPERACAO[o.sla];
  const dias = String(o.dias_na_etapa).replace(".", ",");
  return <StatusPill tone={s.tone}>{o.sla === "encerrada" || o.sla === "sem_prazo" ? s.label : `${dias} de ${o.prazo_dias} dias`}</StatusPill>;
}

/** As operações, separadas dos clientes: com quem está cada uma, em que etapa e como está o prazo. */
export function OperacoesView() {
  useMigalhas([{ label: "Operações" }]);
  const eu = useUsuario();
  const podeEditar = usePode("operacoes", "editar");
  const [nova, setNova] = useState(false);
  const [filtroAberto, setFiltroAberto] = useState(false);
  // Vindo do cadastro do cliente ("Ver em Operações"): já filtrada por ele.
  const [busca, setBusca] = useState(() => {
    try {
      const v = sessionStorage.getItem("hub-operacoes-busca") ?? "";
      sessionStorage.removeItem("hub-operacoes-busca");
      return v;
    } catch {
      return "";
    }
  });
  const [situacao, setSituacao] = useState<Situacao>("ativas");
  const [consultor, setConsultor] = useState("");
  const [etapa, setEtapa] = useState("");
  const [transferir, setTransferir] = useState<Operacao | null>(null);
  const [mudarEtapa, setMudarEtapa] = useState<Operacao | null>(null);
  const consulta = useQuery({ queryKey: ["operacoes"], queryFn: () => api<{ operacoes: Operacao[] }>("/operacoes") });
  const todas = consulta.data?.operacoes ?? [];

  const passaSituacao = (o: Operacao, s: Situacao) => {
    if (s === "ativas") return o.situacao === "ativa";
    if (s === "atrasadas") return o.sla === "atrasada";
    if (s === "perto") return o.sla === "perto";
    if (s === "sem_consultor") return o.situacao === "ativa" && !o.consultor_id;
    if (s === "encerradas") return o.situacao !== "ativa";
    return true;
  };
  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return todas.filter((o) => {
      if (!passaSituacao(o, situacao)) return false;
      if (consultor && (o.consultor_nome || "Sem consultor") !== consultor) return false;
      if (etapa && o.etapa_nome !== etapa) return false;
      return !termo || normalizar(`${o.codigo} ${o.nome} ${o.cliente_nome} ${o.consultor_nome}`).includes(termo);
    });
  }, [todas, busca, situacao, consultor, etapa]);
  const pager = usePagination(filtradas, `${busca}|${situacao}|${consultor}|${etapa}`, "operacoes");
  const ligados = [busca.trim(), situacao !== "ativas" ? situacao : "", consultor, etapa].filter(Boolean).length;
  const limpar = () => {
    setBusca("");
    setSituacao("ativas");
    setConsultor("");
    setEtapa("");
  };
  const abrir = (o: Operacao) => navegar(`/operacoes/${o.id}`);
  const contar = (s: Situacao) => todas.filter((o) => passaSituacao(o, s)).length;
  const alternar = (s: Situacao) => setSituacao(situacao === s ? "ativas" : s);

  useFerramentas([
    { titulo: "Filtrar", ferramentas: [ferramentaFiltro(() => setFiltroAberto(true), ligados)] },
    ...(podeEditar ? [{ titulo: "Adicionar", ferramentas: [{ id: "nova", label: "Adicionar operação", icon: PlusIcon, tom: "cinza" as const, run: () => setNova(true) }] }] : []),
  ]);

  const colunas: ReportColumn<Operacao>[] = [
    { id: "codigo", header: "Código", width: "6.5rem", cell: (o) => <span className="tabular-nums">{o.codigo}</span> },
    { id: "cliente", header: "Cliente", cell: (o) => o.cliente_nome },
    { id: "operacao", header: "Operação", primary: true, cell: (o) => <span className="font-medium">{o.nome}</span> },
    {
      id: "consultor",
      header: "Consultor",
      width: "11rem",
      cell: (o) => o.consultor_nome || <StatusPill tone="aguardando">Sem consultor</StatusPill>,
    },
    { id: "etapa", header: "Etapa", width: "11rem", cell: (o) => o.etapa_nome },
    { id: "prazo", header: "Prazo da etapa", width: "10rem", cell: (o) => <PrazoPill o={o} /> },
    { id: "docs", header: "Obrigatórios", width: "9rem", hideBelow: "xl", cell: (o) => <BarraObrigatorios resumo={o.resumo} compacta /> },
  ];

  const consultores = [...new Set(todas.map((o) => o.consultor_nome || "Sem consultor"))].sort();
  const etapas = [...new Set(todas.map((o) => o.etapa_nome))].sort();

  return (
    <div className="flex h-full min-h-0 flex-col">
      {consulta.isPending ? (
        <Skeleton className="m-4 h-40" />
      ) : (
        <>
          <ReportTable
            label="Operações"
            columns={colunas}
            bulk={[
              { id: "abrir", label: "Abrir a pasta", icon: FolderOpenIcon, unico: true, run: ([o]) => abrir(o) },
              podeEditar && { id: "etapa", label: "Mudar de etapa", icon: ListChecksIcon, unico: true, run: ([o]) => setMudarEtapa(o) },
              eu.admin && { id: "transferir", label: "Transferir", icon: ArrowRightLeftIcon, unico: true, run: ([o]) => setTransferir(o) },
            ]}
            rows={pager.rows}
            rowKey={(o) => String(o.id)}
            onOpen={abrir}
            openLabel={(o) => `Abrir ${o.nome}`}
            scrollKey={pager.page}
            empty={
              ligados > 0 ? (
                <EstadoVazio
                  compact
                  icon={<SearchXIcon />}
                  title="Nenhuma operação com esses filtros"
                  action={
                    <Button variant="secondary" onClick={limpar}>
                      Limpar filtros
                    </Button>
                  }
                />
              ) : (
                <EstadoVazio compact icon={<FolderKanbanIcon />} title="Nenhuma operação" description="Crie a primeira em Adicionar operação." />
              )
            }
          />
          <Pagination pager={pager} total={filtradas.length} />
          <StatsLine
            label="Números das operações"
            items={[
              { id: "ativas", label: "Ativas", value: contar("ativas"), pressed: situacao === "ativas", onClick: () => setSituacao("ativas") },
              { id: "atrasadas", label: "Atrasadas", value: contar("atrasadas"), pressed: situacao === "atrasadas", onClick: () => alternar("atrasadas") },
              { id: "perto", label: "Perto do prazo", value: contar("perto"), pressed: situacao === "perto", onClick: () => alternar("perto") },
              ...(eu.admin ? [{ id: "sem", label: "Sem consultor", value: contar("sem_consultor"), pressed: situacao === "sem_consultor", onClick: () => alternar("sem_consultor") }] : []),
              { id: "encerradas", label: "Encerradas", value: contar("encerradas"), pressed: situacao === "encerradas", onClick: () => alternar("encerradas") },
            ]}
          />
        </>
      )}
      <PainelFiltro aberto={filtroAberto} onClose={() => setFiltroAberto(false)} mostrando={filtradas.length} total={todas.length} onLimpar={limpar}>
        <FormField label="Busca" htmlFor="op-busca">
          <Input id="op-busca" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código, operação, cliente ou consultor" />
        </FormField>
        <FormField label="Situação">
          <Escolha
            value={situacao}
            onChange={(v) => setSituacao(v as Situacao)}
            vazio="Todas"
            options={[
              { value: "ativas", label: "Ativas" },
              { value: "atrasadas", label: "Atrasadas" },
              { value: "perto", label: "Perto do prazo" },
              ...(eu.admin ? [{ value: "sem_consultor", label: "Sem consultor" }] : []),
              { value: "encerradas", label: "Encerradas" },
            ]}
          />
        </FormField>
        {eu.admin && (
          <FormField label="Consultor">
            <Escolha value={consultor} onChange={setConsultor} vazio="Todos" options={consultores.map((c) => ({ value: c, label: c }))} />
          </FormField>
        )}
        <FormField label="Etapa">
          <Escolha value={etapa} onChange={setEtapa} vazio="Todas" options={etapas.map((e) => ({ value: e, label: e }))} />
        </FormField>
      </PainelFiltro>
      {nova && <OperacaoDialog clienteId={null} operacao={null} onClose={() => setNova(false)} onSaved={(o) => { setNova(false); navegar(`/operacoes/${o.id}`); }} />}
      {transferir && <TransferirDialog operacao={transferir} onClose={() => setTransferir(null)} />}
      {mudarEtapa && <MudarEtapaDialog operacao={mudarEtapa} onClose={() => setMudarEtapa(null)} />}
    </div>
  );
}

function useAtualizarOperacao(o: { id: number; cliente_id: number }) {
  const qc = useQueryClient();
  return async () => {
    for (const k of [["operacoes"], ["operacao", o.id], ["cliente", o.cliente_id], ["transferencias"], ["sla"], ["painel"], ["clientes"]]) await qc.invalidateQueries({ queryKey: k });
  };
}

/** Só o administrador: de um consultor para outro, com o motivo. */
export function TransferirDialog({ operacao: o, onClose }: { operacao: Pick<Operacao, "id" | "cliente_id" | "nome" | "consultor_id" | "consultor_nome">; onClose: () => void }) {
  const atualizar = useAtualizarOperacao(o);
  const [para, setPara] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const consultores = useQuery({ queryKey: ["consultores"], queryFn: () => api<{ consultores: Consultor[] }>("/consultores") });
  const transferir = useMutation({
    mutationFn: () => api(`/operacoes/${o.id}/transferir`, { corpo: { consultor_id: Number(para), motivo } }),
    onSuccess: async () => {
      toast.success("Operação transferida.");
      await atualizar();
      onClose();
    },
    onError: (e) => setErro((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && !transferir.isPending && onClose()}>
      <DialogContent>
        <form
          noValidate
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!para) return setErro("Escolha quem vai receber a operação.");
            if (motivo.trim().length < 5) return setErro("Explique o motivo em poucas palavras.");
            setErro("");
            transferir.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Transferir operação</DialogTitle>
            <DialogDescription>{o.nome}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <FormField label="Está com">
              <Input readOnly value={o.consultor_nome || "Sem consultor"} />
            </FormField>
            <FormField label="Passa para" required help="O tempo até agora fica com o consultor atual. O novo começa um período novo no SLA.">
              <Escolha
                value={para}
                onChange={setPara}
                placeholder="Escolha o consultor"
                options={(consultores.data?.consultores ?? []).filter((c) => c.id !== o.consultor_id).map((c) => ({ value: String(c.id), label: `${c.nome} (${c.operacoes_ativas} ativas)` }))}
              />
            </FormField>
            <FormField label="Motivo" htmlFor="tr-motivo" required help={`${motivo.length}/500`}>
              <Textarea id="tr-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder="Ex.: consultor de férias até o fim do mês." />
            </FormField>
            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={transferir.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={transferir.isPending}>
              {transferir.isPending && <Spinner data-icon="inline-start" />}
              Transferir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MudarEtapaDialog({ operacao: o, onClose }: { operacao: Pick<Operacao, "id" | "cliente_id" | "nome" | "etapas" | "etapa_id">; onClose: () => void }) {
  const atualizar = useAtualizarOperacao(o);
  const [etapa, setEtapa] = useState(String(o.etapa_id ?? ""));
  const mudar = useMutation({
    mutationFn: () => api(`/operacoes/${o.id}/etapa`, { corpo: { etapa_id: Number(etapa) } }),
    onSuccess: async () => {
      toast.success("Etapa alterada.");
      await atualizar();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && !mudar.isPending && onClose()}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            mudar.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Mudar de etapa</DialogTitle>
            <DialogDescription>{o.nome}</DialogDescription>
          </DialogHeader>
          <FormField label="Etapa" help="A última etapa encerra a operação e para o prazo.">
            <Escolha value={etapa} onChange={setEtapa} options={o.etapas.map((e) => ({ value: String(e.id), label: e.final ? e.nome : `${e.nome} (${e.prazo_dias} dias)` }))} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mudar.isPending || etapa === String(o.etapa_id)}>
              {mudar.isPending && <Spinner data-icon="inline-start" />}
              Mudar etapa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
