import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeftIcon } from "lucide-react";

import { EstadoVazio } from "@/components/EstadoVazio";
import { Pagination, usePagination } from "@/components/Pagination";
import { ReportTable, type ReportColumn } from "@/components/ReportTable";
import { Skeleton } from "@/components/ui/skeleton";
import { useMigalhas } from "@/app/migalhas";
import { navegar } from "@/app/rotas";
import { api } from "@/lib/api";
import { dataHoraBR } from "@/lib/formato";
import type { Transferencia } from "@/lib/tipos";

/** O histórico de quem passou o quê para quem, e por quê. */
export function TransferenciasView() {
  useMigalhas([{ label: "Operações", caminho: "/operacoes" }, { label: "Transferências" }]);
  const consulta = useQuery({ queryKey: ["transferencias"], queryFn: () => api<{ transferencias: Transferencia[] }>("/transferencias") });
  const lista = consulta.data?.transferencias ?? [];
  const pager = usePagination(lista, "", "transferencias");
  const colunas: ReportColumn<Transferencia>[] = [
    { id: "quando", header: "Quando", width: "11rem", cell: (t) => dataHoraBR(t.quando) },
    { id: "codigo", header: "Código", width: "6.5rem", cell: (t) => t.codigo },
    { id: "op", header: "Cliente · Operação", primary: true, width: "20rem", cell: (t) => `${t.cliente_nome} · ${t.operacao_nome}` },
    { id: "de", header: "De", width: "10rem", cell: (t) => t.de_nome || "Sem consultor" },
    { id: "para", header: "Para", width: "10rem", cell: (t) => <span className="font-medium">{t.para_nome}</span> },
    { id: "motivo", header: "Motivo", cell: (t) => <span title={t.motivo}>{t.motivo}</span> },
    { id: "por", header: "Feita por", width: "10rem", hideBelow: "xl", cell: (t) => t.por },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      {consulta.isPending ? (
        <Skeleton className="m-4 h-40" />
      ) : (
        <>
          <ReportTable
            label="Transferências"
            columns={colunas}
            rows={pager.rows}
            rowKey={(t) => String(t.id)}
            onOpen={(t) => navegar(`/operacoes/${t.operacao_id}`)}
            openLabel={(t) => `Abrir ${t.operacao_nome}`}
            scrollKey={pager.page}
            empty={<EstadoVazio compact icon={<ArrowRightLeftIcon />} title="Nenhuma transferência" description="O administrador transfere pela lista de Operações, informando o motivo." />}
          />
          <Pagination pager={pager} total={lista.length} />
        </>
      )}
    </div>
  );
}
