import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon, FileSearchIcon, FolderOpenIcon, SearchXIcon } from "lucide-react";

import { Escolha } from "@/components/Escolha";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FormField } from "@/components/FormPage";
import { PainelFiltro, ferramentaFiltro } from "@/components/PainelFiltro";
import { Pagination, usePagination } from "@/components/Pagination";
import { ReportTable, type ReportColumn } from "@/components/ReportTable";
import { StatsLine } from "@/components/StatsLine";
import { StatusPill } from "@/components/StatusPill";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFerramentas } from "@/app/faixa";
import { useMigalhas } from "@/app/migalhas";
import { navegar } from "@/app/rotas";
import { useUsuario } from "@/app/sessao";
import { abrirArquivo, api } from "@/lib/api";
import { ESTADO_ITEM } from "@/lib/estados";
import { dataBR, normalizar, prazoTexto } from "@/lib/formato";
import type { DocumentoGeral, EstadoItem } from "@/lib/tipos";

/** A área de Documentos: tudo o que as operações exigem, num lugar só. */
export function DocumentosGeralView() {
  useMigalhas([{ label: "Documentos" }]);
  const eu = useUsuario();
  const [estado, setEstado] = useState<EstadoItem | "">("");
  const [busca, setBusca] = useState("");
  const [consultor, setConsultor] = useState("");
  const [so, setSo] = useState("");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const consulta = useQuery({ queryKey: ["documentos-geral"], queryFn: () => api<{ itens: DocumentoGeral[] }>("/documentos-geral") });
  const itens = consulta.data?.itens ?? [];
  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return itens.filter((i) => {
      if (estado && i.estado !== estado) return false;
      if (consultor && (i.consultor_nome || "Sem consultor") !== consultor) return false;
      if (so === "obrigatorios" && !i.obrigatorio) return false;
      return !termo || normalizar(`${i.nome} ${i.cliente_nome} ${i.operacao_nome} ${i.operacao_codigo}`).includes(termo);
    });
  }, [itens, estado, busca, consultor, so]);
  const pager = usePagination(filtrados, `${estado}|${busca}|${consultor}|${so}`, "documentos-geral");
  const limpar = () => {
    setEstado("");
    setBusca("");
    setConsultor("");
    setSo("");
  };
  useFerramentas([{ titulo: "Filtrar", ferramentas: [ferramentaFiltro(() => setFiltroAberto(true), [estado, busca.trim(), consultor, so].filter(Boolean).length)] }]);

  const contar = (e: EstadoItem) => itens.filter((i) => i.estado === e).length;
  const contagem = (id: EstadoItem) => ({ id, label: ESTADO_ITEM[id].label, value: contar(id), pressed: estado === id, onClick: () => setEstado(estado === id ? "" : id) });
  const abrirPasta = (i: DocumentoGeral) => navegar(`/operacoes/${i.operacao_id}`);

  const colunas: ReportColumn<DocumentoGeral>[] = [
    {
      id: "doc",
      header: "Documento",
      primary: true,
      cell: (i) => (
        <span className="truncate">
          <span className="font-medium">{i.nome}</span>
          {i.obrigatorio && <span className="ml-1 text-destructive">*</span>}
        </span>
      ),
    },
    { id: "cliente", header: "Cliente", width: "13rem", wideWidth: "18%", cell: (i) => i.cliente_nome },
    { id: "op", header: "Operação", width: "13rem", wideWidth: "18%", cell: (i) => i.operacao_nome },
    ...(eu.admin ? [{ id: "consultor", header: "Consultor", width: "9.5rem", hideBelow: "xl", cell: (i: DocumentoGeral) => i.consultor_nome || "—" } as ReportColumn<DocumentoGeral>] : []),
    { id: "estado", header: "Situação", width: "11rem", cell: (i) => <StatusPill tone={ESTADO_ITEM[i.estado].tone}>{ESTADO_ITEM[i.estado].label}</StatusPill> },
    {
      id: "validade",
      header: "Vence em",
      width: "11rem",
      cell: (i) => (i.validade ? <span title={prazoTexto(i.dias_para_vencer)}>{dataBR(i.validade)}</span> : <span className="text-muted-foreground">—</span>),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {consulta.isPending ? (
        <Skeleton className="m-4 h-40" />
      ) : (
        <>
          <ReportTable
            label="Documentos"
            columns={colunas}
            bulk={[
              { id: "arquivo", label: "Abrir o arquivo", icon: ExternalLinkIcon, unico: true, applies: (i) => !!i.arquivo_id, run: ([i]) => void abrirArquivo(i.arquivo_id!).catch((e) => toast.error((e as Error).message)) },
              { id: "pasta", label: "Abrir a pasta", icon: FolderOpenIcon, unico: true, run: ([i]) => abrirPasta(i) },
            ]}
            rows={pager.rows}
            rowKey={(i) => String(i.id)}
            onOpen={abrirPasta}
            openLabel={(i) => `Abrir a pasta de ${i.operacao_nome}`}
            scrollKey={pager.page}
            empty={
              estado || busca || consultor || so ? (
                <EstadoVazio compact icon={<SearchXIcon />} title="Nenhum documento com esses filtros" />
              ) : (
                <EstadoVazio compact icon={<FileSearchIcon />} title="Nenhum documento exigido" description="Os documentos aparecem quando há operações ativas com predefinição." />
              )
            }
          />
          <Pagination pager={pager} total={filtrados.length} />
          <StatsLine label="Números dos documentos" items={[contagem("falta"), contagem("aguardando"), contagem("recusado"), contagem("vencendo"), contagem("vencido"), contagem("aprovado")]} />
        </>
      )}
      <PainelFiltro aberto={filtroAberto} onClose={() => setFiltroAberto(false)} mostrando={filtrados.length} total={itens.length} onLimpar={limpar}>
        <FormField label="Busca" htmlFor="dg-busca">
          <Input id="dg-busca" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Documento, cliente ou operação" />
        </FormField>
        <FormField label="Situação">
          <Escolha value={estado} onChange={(v) => setEstado(v as EstadoItem | "")} vazio="Todas" options={(Object.keys(ESTADO_ITEM) as EstadoItem[]).map((e) => ({ value: e, label: ESTADO_ITEM[e].label }))} />
        </FormField>
        <FormField label="Documentos">
          <Escolha value={so} onChange={setSo} vazio="Todos" options={[{ value: "obrigatorios", label: "Só obrigatórios" }]} />
        </FormField>
        {eu.admin && (
          <FormField label="Consultor">
            <Escolha value={consultor} onChange={setConsultor} vazio="Todos" options={[...new Set(itens.map((i) => i.consultor_nome || "Sem consultor"))].sort().map((c) => ({ value: c, label: c }))} />
          </FormField>
        )}
      </PainelFiltro>
    </div>
  );
}
