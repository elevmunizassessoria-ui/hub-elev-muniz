import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2Icon, PencilIcon, PlusIcon, SearchXIcon } from "lucide-react";

import { EstadoVazio } from "@/components/EstadoVazio";
import { FormField } from "@/components/FormPage";
import { PainelFiltro, ferramentaFiltro } from "@/components/PainelFiltro";
import { StatsLine } from "@/components/StatsLine";
import { Input } from "@/components/ui/input";
import { Pagination, usePagination } from "@/components/Pagination";
import { ReportTable, type ReportColumn } from "@/components/ReportTable";
import { BarraObrigatorios, Pendencias } from "@/components/Resumo";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFerramentas } from "@/app/faixa";
import { useMigalhas } from "@/app/migalhas";
import { normalizar } from "@/lib/formato";
import { navegar } from "@/app/rotas";
import { usePode } from "@/app/sessao";
import { api } from "@/lib/api";
import type { Cliente } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { ClienteForm } from "./ClienteForm";

type Situacao = "ativos" | "inativos" | "todos";

export function ClientesView() {
  useMigalhas([{ label: "Clientes" }]);
  const podeEditar = usePode("clientes", "editar");
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("ativos");
  const [form, setForm] = useState<{ cliente: Cliente | null } | null>(null);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const consulta = useQuery({ queryKey: ["clientes"], queryFn: () => api<{ clientes: Cliente[] }>("/clientes") });

  const todos = consulta.data?.clientes ?? [];
  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return todos.filter((c) => {
      if (situacao === "ativos" && !c.ativo) return false;
      if (situacao === "inativos" && c.ativo) return false;
      if (!termo) return true;
      return normalizar([c.nome, c.razao_social, c.documento, c.contato, c.email].join(" ")).includes(termo);
    });
  }, [todos, busca, situacao]);
  const pager = usePagination(filtrados, `${busca}|${situacao}`, "clientes");
  useFerramentas([
    { titulo: "Filtrar", ferramentas: [ferramentaFiltro(() => setFiltroAberto(true), busca.trim() ? 1 : 0)] },
    ...(podeEditar ? [{ titulo: "Adicionar", ferramentas: [{ id: "novo", label: "Adicionar cliente", icon: PlusIcon, tom: "cinza" as const, run: () => setForm({ cliente: null }) }] }] : []),
  ]);

  const colunas: ReportColumn<Cliente>[] = [
    {
      id: "cliente",
      header: "Cliente",
      primary: true,
      cell: (c) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate font-medium", !c.ativo && "text-muted-foreground")}>{c.nome}</span>
          {!c.ativo && <StatusPill tone="neutro">Inativo</StatusPill>}
        </span>
      ),
    },
    { id: "documento", header: "CNPJ/CPF", width: "11rem", hideBelow: "lg", cell: (c) => c.documento || <span className="text-muted-foreground">—</span> },
    { id: "operacoes", header: "Operações", width: "7rem", type: "number", cell: (c) => c.operacoes ?? 0 },
    { id: "obrigatorios", header: "Obrigatórios", width: "11rem", cell: (c) => <BarraObrigatorios resumo={c.resumo} compacta /> },
    { id: "pendencias", header: "Pendências", width: "16rem", wideWidth: "22%", cell: (c) => <Pendencias resumo={c.resumo} umaLinha /> },
    {
      id: "contato",
      header: "Contato",
      width: "14rem",
      hideBelow: "xl",
      cell: (c) => [c.contato, c.telefone].filter(Boolean).join(" · ") || <span className="text-muted-foreground">—</span>,
    },
  ];

  const filtrado = busca.trim() !== "" || situacao !== "ativos";

  const contar = (x: Situacao) => todos.filter((c) => (x === "todos" ? true : x === "ativos" ? c.ativo : !c.ativo)).length;
  return (
    <div className="flex h-full min-h-0 flex-col">
      {consulta.isPending ? (
          <div className="flex flex-col gap-2 pt-1">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <ReportTable
              label="Clientes"
              columns={colunas}
              bulk={[
                { id: "abrir", label: "Abrir", icon: Building2Icon, unico: true, run: ([c]) => navegar(`/clientes/${c.id}`) },
                podeEditar && { id: "editar", label: "Editar cliente", icon: PencilIcon, unico: true, run: ([c]) => setForm({ cliente: c }) },
              ]}
              rows={pager.rows}
              rowKey={(c) => String(c.id)}
              onOpen={(c) => navegar(`/clientes/${c.id}`)}
              openLabel={(c) => `Abrir ${c.nome}`}
              scrollKey={pager.page}
              empty={
                filtrado ? (
                  <EstadoVazio
                    compact
                    icon={<SearchXIcon />}
                    title="Nenhum cliente com esses filtros"
                    action={
                      <Button variant="outline" className="h-9" onClick={() => { setBusca(""); setSituacao("ativos"); }}>
                        Limpar filtros
                      </Button>
                    }
                  />
                ) : (
                  <EstadoVazio
                    compact
                    icon={<Building2Icon />}
                    title="Nenhum cliente cadastrado"
                    description="Cadastre aqui o cliente. As operações dele são criadas na aba Operações."
                    action={
                      podeEditar && (
                        <Button variant="outline" className="h-9" onClick={() => setForm({ cliente: null })}>
                          <PlusIcon data-icon="inline-start" />
                          Novo cliente
                        </Button>
                      )
                    }
                  />
                )
              }
            />
            <Pagination pager={pager} total={filtrados.length} />
            <StatsLine
              label="Números dos clientes"
              items={[
                { id: "ativos", label: "Ativos", value: contar("ativos"), pressed: situacao === "ativos", onClick: () => setSituacao("ativos") },
                { id: "inativos", label: "Inativos", value: contar("inativos"), pressed: situacao === "inativos", onClick: () => setSituacao("inativos") },
                { id: "todos", label: "Todos", value: contar("todos"), pressed: situacao === "todos", onClick: () => setSituacao("todos") },
              ]}
            />
          </>
        )}
      <PainelFiltro aberto={filtroAberto} onClose={() => setFiltroAberto(false)} mostrando={filtrados.length} total={todos.length} onLimpar={() => { setBusca(""); setSituacao("ativos"); }}>
        <FormField label="Busca" htmlFor="cl-busca">
          <Input id="cl-busca" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente, CNPJ ou contato" />
        </FormField>
      </PainelFiltro>
      {form && (
        <ClienteForm
          cliente={form.cliente}
          onClose={() => setForm(null)}
          onSaved={(c, novo) => {
            setForm(null);
            if (novo) navegar(`/clientes/${c.id}`);
          }}
        />
      )}
    </div>
  );
}
