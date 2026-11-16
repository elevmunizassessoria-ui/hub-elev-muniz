import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderKanbanIcon, MailIcon, PencilIcon, PhoneIcon, Trash2Icon, UserRoundIcon } from "lucide-react";

import { Bloco } from "@/components/Bloco";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/Carregando";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ListaHistorico } from "@/components/Historico";
import { StatusPill } from "@/components/StatusPill";
import { useFerramentas } from "@/app/faixa";
import { useMigalhas } from "@/app/migalhas";
import { navegar } from "@/app/rotas";
import { usePode } from "@/app/sessao";
import { api } from "@/lib/api";
import { dataBR } from "@/lib/formato";
import type { Cliente, Historico, Operacao } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { ClienteForm } from "./ClienteForm";

interface DadosCliente {
  cliente: Cliente;
  operacoes: Operacao[];
  historico: Historico[];
  caminho: string;
}

/** O cadastro do cliente. As operações dele ficam só em Operações (pedido do dono, 16/11/2026). */
export function ClienteView({ clienteId }: { clienteId: number }) {
  const qc = useQueryClient();
  const podeEditar = usePode("clientes", "editar");
  const podeExcluir = usePode("clientes", "excluir");
  const [editando, setEditando] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const consulta = useQuery({ queryKey: ["cliente", clienteId], queryFn: () => api<DadosCliente>(`/clientes/${clienteId}`) });
  const c = consulta.data?.cliente;
  useMigalhas([{ label: "Clientes", caminho: "/clientes" }, { label: c?.nome ?? "…" }]);

  const apagar = useMutation({
    mutationFn: () => api(`/clientes/${clienteId}`, { metodo: "DELETE" }),
    onSuccess: async () => {
      toast.success("Cliente excluído.");
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      navegar("/clientes");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const semOperacoes = consulta.data?.operacoes.length === 0;
  useFerramentas([
    ...(podeEditar ? [{ titulo: "Cadastro", ferramentas: [{ id: "editar", label: "Editar cliente", icon: PencilIcon, tom: "cinza" as const, run: () => setEditando(true) }] }] : []),
    ...(podeExcluir && semOperacoes ? [{ titulo: "Excluir", ferramentas: [{ id: "excluir", label: "Excluir cliente", icon: Trash2Icon, tom: "vermelho" as const, run: () => setExcluir(true) }] }] : []),
  ]);

  if (consulta.isPending) return <Carregando />;
  if (consulta.isError || !c) return <EstadoVazio title="Cliente não encontrado" description={(consulta.error as Error)?.message} />;
  const { operacoes, historico } = consulta.data;

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex w-full flex-col gap-4 p-4 lg:p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Bloco title="Cadastro" className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
            <Dado rotulo="Cliente">
              <span className="flex items-center gap-2 font-medium">
                {c.nome}
                {!c.ativo && <StatusPill tone="neutro">Inativo</StatusPill>}
              </span>
            </Dado>
            <Dado rotulo="Razão social">{c.razao_social || "—"}</Dado>
            <Dado rotulo="CNPJ/CPF">{c.documento || "—"}</Dado>
            <Dado rotulo="Cadastrado em">
              {dataBR(c.criado_em)}
              {c.criado_por && ` por ${c.criado_por}`}
            </Dado>
            {c.observacao && (
              <div className="sm:col-span-2">
                <Dado rotulo="Observação">
                  <span className="whitespace-pre-wrap">{c.observacao}</span>
                </Dado>
              </div>
            )}
          </Bloco>
          <Bloco title="Contato" className="flex flex-col gap-3 p-4 text-sm">
            <Linha icon={<UserRoundIcon />} texto={c.contato} />
            <Linha icon={<MailIcon />} texto={c.email} />
            <Linha icon={<PhoneIcon />} texto={c.telefone} />
          </Bloco>
        </div>

        <Bloco title="Operações" className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span className="text-muted-foreground">
            {operacoes.length === 0 ? "Nenhuma operação deste cliente." : `${operacoes.length} ${operacoes.length === 1 ? "operação" : "operações"} deste cliente. Tudo sobre elas fica em Operações.`}
          </span>
          {operacoes.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                // Operações abre já filtrada por este cliente.
                try {
                  sessionStorage.setItem("hub-operacoes-busca", c.nome);
                } catch {
                  /* sem armazenamento: abre sem o filtro */
                }
                navegar("/operacoes");
              }}
            >
              <FolderKanbanIcon data-icon="inline-start" />
              Ver em Operações
            </Button>
          )}
        </Bloco>

        <Bloco title="Histórico do cliente" className="max-h-80 overflow-y-auto">
          <ListaHistorico itens={historico} />
        </Bloco>
      </div>

      {editando && <ClienteForm cliente={c} onClose={() => setEditando(false)} onSaved={() => setEditando(false)} />}
      <ConfirmDialog
        open={excluir}
        onOpenChange={setExcluir}
        title="Excluir cliente?"
        description={`"${c.nome}" sai do sistema e a pasta vazia dele é apagada.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => apagar.mutate()}
      />
    </div>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <div className="truncate">{children}</div>
    </div>
  );
}

function Linha({ icon, texto }: { icon: React.ReactNode; texto: string }) {
  return (
    <p className="flex items-center gap-2.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
      {icon}
      <span className={cn("truncate", !texto && "text-muted-foreground")}>{texto || "—"}</span>
    </p>
  );
}
