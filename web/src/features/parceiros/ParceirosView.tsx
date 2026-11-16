import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HandshakeIcon, PencilIcon, PlusIcon, SearchXIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Escolha } from "@/components/Escolha";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FormField, FormPage, FormSection, YesNo } from "@/components/FormPage";
import { PainelFiltro, ferramentaFiltro } from "@/components/PainelFiltro";
import { Pagination, usePagination } from "@/components/Pagination";
import { MoneyCell, ReportTable, type ReportColumn } from "@/components/ReportTable";
import { StatsLine } from "@/components/StatsLine";
import { StatusPill } from "@/components/StatusPill";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useFerramentas } from "@/app/faixa";
import { useMigalhas } from "@/app/migalhas";
import { usePode } from "@/app/sessao";
import { api } from "@/lib/api";
import { dinheiro, normalizar } from "@/lib/formato";
import { useCredito, type Parceiro } from "@/features/credito/dados";

type Situacao = "ativos" | "inativos" | "todos";
type Linha = Parceiro & ReturnType<ReturnType<typeof useCredito>["indicadores"]>;

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

/**
 * Parceiros (no lugar de Instituições, pedido do dono em 16/11/2026): os bancos e financeiras com quem a
 * empresa trabalha, o contato de cada um e os indicadores (propostas, aprovação, volume, liberado e comissão).
 * O cadastro grava no banco; os indicadores saem das propostas (que ainda não têm tabela própria).
 */
export function ParceirosView() {
  useMigalhas([{ label: "Parceiros" }]);
  const qc = useQueryClient();
  const podeEditar = usePode("instituicoes", "editar");
  const podeExcluir = usePode("instituicoes", "excluir");
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("ativos");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [form, setForm] = useState<{ parceiro: Parceiro | null } | null>(null);
  const [excluir, setExcluir] = useState<Parceiro | null>(null);
  const consulta = useQuery({ queryKey: ["parceiros"], queryFn: () => api<{ parceiros: Parceiro[]; tipos: string[] }>("/parceiros") });
  const { indicadores } = useCredito();

  const todos: Linha[] = useMemo(() => (consulta.data?.parceiros ?? []).map((p) => ({ ...p, ...indicadores(p.nome) })), [consulta.data, indicadores]);
  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return todos.filter((p) => {
      if (situacao === "ativos" && !p.ativo) return false;
      if (situacao === "inativos" && p.ativo) return false;
      return !termo || normalizar([p.nome, p.tipo, p.contato_nome, p.email, p.telefone].join(" ")).includes(termo);
    });
  }, [todos, busca, situacao]);
  const pager = usePagination(filtrados, `${busca}|${situacao}`, "parceiros");

  const apagar = useMutation({
    mutationFn: (p: Parceiro) => api(`/parceiros/${p.id}`, { metodo: "DELETE" }),
    onSuccess: async () => {
      toast.success("Parceiro excluído.");
      await qc.invalidateQueries({ queryKey: ["parceiros"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useFerramentas([
    { titulo: "Filtrar", ferramentas: [ferramentaFiltro(() => setFiltroAberto(true), busca.trim() ? 1 : 0)] },
    ...(podeEditar ? [{ titulo: "Adicionar", ferramentas: [{ id: "novo", label: "Adicionar parceiro", icon: PlusIcon, tom: "cinza" as const, run: () => setForm({ parceiro: null }) }] }] : []),
  ]);

  const colunas: ReportColumn<Linha>[] = [
    {
      id: "nome",
      header: "Parceiro",
      primary: true,
      cell: (p) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{p.nome}</span>
          {!p.ativo && <StatusPill tone="neutro">Inativo</StatusPill>}
        </span>
      ),
    },
    { id: "tipo", header: "Tipo", width: "8rem", cell: (p) => p.tipo },
    { id: "contato", header: "Contato", width: "13rem", cell: (p) => [p.contato_nome, p.contato_cargo].filter(Boolean).join(" · ") || "—" },
    { id: "telefone", header: "Telefone", width: "9.5rem", hideBelow: "xl", cell: (p) => p.telefone || "—" },
    { id: "propostas", header: "Propostas", width: "6.5rem", type: "number", cell: (p) => p.propostas },
    { id: "analise", header: "Em análise", width: "6.5rem", type: "number", hideBelow: "lg", cell: (p) => p.emAnalise },
    { id: "aprovacao", header: "Aprovação", width: "6.5rem", type: "number", cell: (p) => pct(p.aprovacao) },
    { id: "volume", header: "Volume proposto", width: "9.5rem", type: "money", hideBelow: "xl", cell: (p) => <MoneyCell text={dinheiro(p.volume)} /> },
    { id: "liberado", header: "Liberado", width: "9.5rem", type: "money", cell: (p) => <MoneyCell text={dinheiro(p.liberado)} /> },
    { id: "comissao", header: "Comissão", width: "9rem", type: "money", cell: (p) => <MoneyCell text={dinheiro(p.comissao)} /> },
  ];

  const contar = (x: Situacao) => todos.filter((p) => (x === "todos" ? true : x === "ativos" ? p.ativo : !p.ativo)).length;
  const visiveis = filtrados;
  const soma = (f: (p: Linha) => number) => visiveis.reduce((t, p) => t + f(p), 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {consulta.isPending ? (
        <Skeleton className="m-4 h-40" />
      ) : (
        <>
          <ReportTable
            label="Parceiros"
            columns={colunas}
            rows={pager.rows}
            rowKey={(p) => String(p.id)}
            onOpen={podeEditar ? (p) => setForm({ parceiro: p }) : undefined}
            openLabel={(p) => `Editar ${p.nome}`}
            scrollKey={pager.page}
            bulk={[
              podeEditar && { id: "editar", label: "Editar parceiro", icon: PencilIcon, unico: true, run: ([p]) => setForm({ parceiro: p }) },
              podeExcluir && { id: "excluir", label: "Excluir", icon: Trash2Icon, unico: true, destructive: true, run: ([p]) => setExcluir(p) },
            ]}
            empty={
              todos.length === 0 ? (
                <EstadoVazio compact icon={<HandshakeIcon />} title="Nenhum parceiro cadastrado" description="Cadastre os bancos e financeiras com quem você trabalha, com o contato de cada um." />
              ) : (
                <EstadoVazio compact icon={<SearchXIcon />} title="Nenhum parceiro com esses filtros" />
              )
            }
          />
          <Pagination pager={pager} total={filtrados.length} />
          <StatsLine
            label="Números dos parceiros"
            items={[
              { id: "ativos", label: "Ativos", value: contar("ativos"), pressed: situacao === "ativos", onClick: () => setSituacao("ativos") },
              { id: "inativos", label: "Inativos", value: contar("inativos"), pressed: situacao === "inativos", onClick: () => setSituacao("inativos") },
              { id: "todos", label: "Todos", value: contar("todos"), pressed: situacao === "todos", onClick: () => setSituacao("todos") },
            ]}
            summary={[
              { id: "propostas", label: "Propostas", value: String(soma((p) => p.propostas)) },
              { id: "liberado", label: "Liberado", value: dinheiro(soma((p) => p.liberado)) },
              { id: "comissao", label: "Comissão", value: dinheiro(soma((p) => p.comissao)) },
            ]}
          />
        </>
      )}
      <PainelFiltro aberto={filtroAberto} onClose={() => setFiltroAberto(false)} mostrando={filtrados.length} total={todos.length} onLimpar={() => { setBusca(""); setSituacao("ativos"); }}>
        <FormField label="Busca" htmlFor="pa-busca">
          <Input id="pa-busca" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Parceiro, tipo ou contato" />
        </FormField>
      </PainelFiltro>
      {form && <ParceiroForm parceiro={form.parceiro} tipos={consulta.data?.tipos ?? []} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={!!excluir}
        onOpenChange={(v) => !v && setExcluir(null)}
        title="Excluir parceiro?"
        description={`"${excluir?.nome}" sai do cadastro. Para só deixar de usar, edite e marque como inativo.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => excluir && apagar.mutate(excluir)}
      />
    </div>
  );
}

const VAZIO = { nome: "", tipo: "Banco", documento: "", contato_nome: "", contato_cargo: "", telefone: "", email: "", comissao_padrao: "", prazo_resposta_dias: "", observacao: "", ativo: true };

function ParceiroForm({ parceiro, tipos, onClose }: { parceiro: Parceiro | null; tipos: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [dados, setDados] = useState(() =>
    parceiro
      ? { ...VAZIO, ...parceiro, comissao_padrao: String(parceiro.comissao_padrao).replace(".", ","), prazo_resposta_dias: parceiro.prazo_resposta_dias ? String(parceiro.prazo_resposta_dias) : "" }
      : VAZIO,
  );
  const [erro, setErro] = useState<string | null>(null);
  const campo = (k: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDados((d) => ({ ...d, [k]: e.target.value }));
  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { ...dados, comissao_padrao: dados.comissao_padrao.replace(",", ".") || 0, prazo_resposta_dias: dados.prazo_resposta_dias || 0 };
      return parceiro ? api(`/parceiros/${parceiro.id}`, { metodo: "PUT", corpo }) : api("/parceiros", { corpo });
    },
    onSuccess: async () => {
      toast.success(parceiro ? "Parceiro salvo." : "Parceiro cadastrado.");
      await qc.invalidateQueries({ queryKey: ["parceiros"] });
      onClose();
    },
    onError: (e) => setErro((e as Error).message),
  });
  return (
    <FormPage
      title={parceiro ? `Editar ${parceiro.nome}` : "Novo parceiro"}
      onBack={onClose}
      onSubmit={() => {
        if (!dados.nome.trim()) return setErro("Preencha o nome do parceiro.");
        setErro(null);
        salvar.mutate();
      }}
      busy={salvar.isPending}
      footerNote={erro && <span className="text-destructive">{erro}</span>}
    >
      <FormSection title="Parceiro">
        <FormField label="Nome" htmlFor="pa-nome" required span={2}>
          <Input id="pa-nome" autoFocus value={dados.nome} onChange={campo("nome")} maxLength={120} placeholder="Ex.: Banco Horizonte" />
        </FormField>
        <FormField label="Tipo">
          <Escolha value={dados.tipo} onChange={(tipo) => setDados((d) => ({ ...d, tipo }))} options={(tipos.length ? tipos : ["Banco"]).map((t) => ({ value: t, label: t }))} />
        </FormField>
        <FormField label="CNPJ" htmlFor="pa-doc">
          <Input id="pa-doc" value={dados.documento} onChange={campo("documento")} maxLength={30} />
        </FormField>
        <FormField label="Comissão padrão (%)" htmlFor="pa-com" help="A comissão que o parceiro paga sobre o valor liberado.">
          <Input id="pa-com" inputMode="decimal" value={dados.comissao_padrao} onChange={campo("comissao_padrao")} placeholder="Ex.: 2,5" />
        </FormField>
        <FormField label="Prazo de resposta (dias)" htmlFor="pa-prazo" help="Quanto o parceiro costuma levar para responder uma proposta.">
          <Input id="pa-prazo" inputMode="numeric" value={dados.prazo_resposta_dias} onChange={campo("prazo_resposta_dias")} />
        </FormField>
        {parceiro && (
          <FormField label="Parceiro ativo">
            <YesNo label="Parceiro ativo" value={dados.ativo} onChange={(ativo) => setDados((d) => ({ ...d, ativo }))} />
          </FormField>
        )}
      </FormSection>
      <FormSection title="Contato">
        <FormField label="Nome do contato" htmlFor="pa-contato">
          <Input id="pa-contato" value={dados.contato_nome} onChange={campo("contato_nome")} maxLength={120} />
        </FormField>
        <FormField label="Cargo" htmlFor="pa-cargo">
          <Input id="pa-cargo" value={dados.contato_cargo} onChange={campo("contato_cargo")} maxLength={80} placeholder="Ex.: Gerente de empresas" />
        </FormField>
        <FormField label="Telefone / WhatsApp" htmlFor="pa-tel">
          <Input id="pa-tel" value={dados.telefone} onChange={campo("telefone")} maxLength={30} />
        </FormField>
        <FormField label="E-mail" htmlFor="pa-email">
          <Input id="pa-email" type="email" value={dados.email} onChange={campo("email")} maxLength={160} />
        </FormField>
        <FormField label="Observação" htmlFor="pa-obs" span="full">
          <Textarea id="pa-obs" value={dados.observacao} onChange={campo("observacao")} maxLength={1000} placeholder="Produtos com que trabalha, exigências, horários" />
        </FormField>
      </FormSection>
    </FormPage>
  );
}
