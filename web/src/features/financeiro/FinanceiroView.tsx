import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarIcon, CheckIcon, PencilIcon, PlusIcon, ReceiptTextIcon, SearchXIcon, Trash2Icon, Undo2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Escolha } from "@/components/Escolha";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FormField, FormPage, FormSection } from "@/components/FormPage";
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
import { usePode, useUsuario } from "@/app/sessao";
import { api } from "@/lib/api";
import { dataBR, dinheiro, hojeISO, nomeMes, normalizar, plural } from "@/lib/formato";
import type { Lancamento, Operacao, TipoLancamento } from "@/lib/tipos";

const CHAVE = ["financeiro"];

function mesesEmVolta() {
  const hoje = new Date();
  return Array.from({ length: 15 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + 2 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

const SITUACAO = {
  pago: { tone: "concluido", receita: "Recebida", despesa: "Paga" },
  aberto: { tone: "aguardando", receita: "A receber", despesa: "A pagar" },
  atrasado: { tone: "negativo", receita: "Atrasada", despesa: "Atrasada" },
} as const;

/** Receitas, despesas e extrato: a mesma tabela, com o filtro de cada página. */
export function FinanceiroView({ pagina }: { pagina: "receitas" | "despesas" | "extrato" }) {
  const nomes = { receitas: "Receitas", despesas: "Despesas", extrato: "Extrato" };
  useMigalhas([{ label: "Financeiro", caminho: "/financeiro" }, { label: nomes[pagina] }]);
  const qc = useQueryClient();
  const eu = useUsuario();
  const podeEditar = usePode("financeiro", "editar");
  const podeExcluir = usePode("financeiro", "excluir");
  const [mes, setMes] = useState(() => hojeISO().slice(0, 7));
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [form, setForm] = useState<{ tipo: TipoLancamento; lancamento: Lancamento | null } | null>(null);
  const [excluir, setExcluir] = useState<Lancamento[] | null>(null);
  const consulta = useQuery({ queryKey: [...CHAVE, mes], queryFn: () => api<{ lancamentos: Lancamento[]; categorias: string[] }>(`/financeiro/lancamentos?mes=${mes}`) });
  const doTipo = useMemo(() => {
    const lista = consulta.data?.lancamentos ?? [];
    return pagina === "extrato" ? lista : lista.filter((l) => l.tipo === (pagina === "receitas" ? "receita" : "despesa"));
  }, [consulta.data, pagina]);
  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return doTipo.filter((l) => {
      if (situacao && l.situacao !== situacao) return false;
      if (categoria && l.categoria !== categoria) return false;
      return !termo || normalizar(`${l.codigo} ${l.descricao} ${l.cliente_nome ?? ""} ${l.operacao_nome ?? ""}`).includes(termo);
    });
  }, [doTipo, busca, situacao, categoria]);
  const pager = usePagination(filtrados, `${mes}|${pagina}|${busca}|${situacao}|${categoria}`, "financeiro");
  const limpar = () => {
    setBusca("");
    setSituacao("");
    setCategoria("");
  };
  const atualizar = async () => {
    await qc.invalidateQueries({ queryKey: CHAVE });
    await qc.invalidateQueries({ queryKey: ["financeiro-visao"] });
    await qc.invalidateQueries({ queryKey: ["painel"] });
  };
  const pagar = useMutation({
    mutationFn: ({ lista, pago_em }: { lista: Lancamento[]; pago_em: string | null }) =>
      Promise.all(lista.map((l) => api(`/financeiro/lancamentos/${l.id}/pagar`, { corpo: { pago_em } }))),
    onSuccess: async (_r, v) => {
      toast.success(v.pago_em ? `${plural(v.lista.length, "lançamento baixado", "lançamentos baixados")}.` : `${plural(v.lista.length, "lançamento voltou", "lançamentos voltaram")} para em aberto.`);
      await atualizar();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const apagar = useMutation({
    mutationFn: (lista: Lancamento[]) => Promise.all(lista.map((l) => api(`/financeiro/lancamentos/${l.id}`, { metodo: "DELETE" }))),
    onSuccess: async (_r, lista) => {
      toast.success(`${plural(lista.length, "lançamento excluído", "lançamentos excluídos")}.`);
      await atualizar();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useFerramentas([
    {
      titulo: "Filtrar",
      ferramentas: [
        { id: "mes", label: nomeMes(mes), icon: CalendarIcon, tom: "cinza", menu: mesesEmVolta().map((m) => ({ id: m, label: nomeMes(m), ativo: m === mes, run: () => setMes(m) })) },
        ferramentaFiltro(() => setFiltroAberto(true), [busca.trim(), situacao, categoria].filter(Boolean).length),
      ],
    },
    ...(podeEditar && pagina !== "extrato"
      ? [
          {
            titulo: "Adicionar",
            ferramentas: [
              {
                id: "add",
                label: pagina === "receitas" ? "Adicionar receita" : "Adicionar despesa",
                icon: PlusIcon,
                tom: "cinza" as const,
                run: () => setForm({ tipo: pagina === "receitas" ? "receita" : "despesa", lancamento: null }),
              },
            ],
          },
        ]
      : []),
  ]);

  const colunas: ReportColumn<Lancamento>[] = [
    { id: "codigo", header: "Código", width: "6.5rem", cell: (l) => <span className="tabular-nums">{l.codigo}</span> },
    { id: "descricao", header: "Descrição", primary: true, cell: (l) => <span className="font-medium">{l.descricao}</span> },
    ...(pagina === "extrato" ? [{ id: "tipo", header: "Tipo", width: "6rem", cell: (l: Lancamento) => (l.tipo === "receita" ? "Receita" : "Despesa") } as ReportColumn<Lancamento>] : []),
    { id: "categoria", header: "Categoria", width: "9rem", hideBelow: "2xl", cell: (l) => l.categoria || "—" },
    { id: "cliente", header: "Cliente · Operação", width: "16rem", wideWidth: "20%", hideBelow: "xl", cell: (l) => [l.cliente_nome, l.operacao_nome].filter(Boolean).join(" · ") || <span className="text-muted-foreground">Empresa</span> },
    ...(eu.admin ? [{ id: "consultor", header: "Consultor", width: "9rem", hideBelow: "2xl", cell: (l: Lancamento) => l.consultor_nome || "—" } as ReportColumn<Lancamento>] : []),
    { id: "venc", header: "Vencimento", width: "7rem", type: "date", cell: (l) => dataBR(l.vencimento) },
    { id: "pago", header: "Pagamento", width: "7rem", type: "date", hideBelow: "xl", cell: (l) => (l.pago_em ? dataBR(l.pago_em) : "—") },
    { id: "situacao", header: "Situação", width: "7.5rem", cell: (l) => <StatusPill tone={SITUACAO[l.situacao].tone}>{SITUACAO[l.situacao][l.tipo]}</StatusPill> },
    {
      id: "valor",
      header: "Valor",
      width: "9rem",
      type: "money",
      cell: (l) => <MoneyCell text={dinheiro(l.valor_centavos)} className={l.tipo === "receita" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"} />,
    },
  ];

  const soma = (lista: Lancamento[]) => lista.reduce((t, l) => t + l.valor_centavos, 0);
  const contar = (s: string) => doTipo.filter((l) => l.situacao === s).length;
  const item = (id: string, label: string) => ({ id, label, value: contar(id), pressed: situacao === id, onClick: () => setSituacao(situacao === id ? "" : id) });
  const receita = soma(filtrados.filter((l) => l.tipo === "receita"));
  const despesa = soma(filtrados.filter((l) => l.tipo === "despesa"));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {consulta.isPending ? (
        <Skeleton className="m-4 h-40" />
      ) : (
        <>
          <ReportTable
            label={`${nomes[pagina]} de ${nomeMes(mes)}`}
            columns={colunas}
            bulk={[
              podeEditar && { id: "pagar", label: pagina === "receitas" ? "Receber" : pagina === "despesas" ? "Pagar" : "Baixar", icon: CheckIcon, main: true, applies: (l) => !l.pago_em, run: (lista) => pagar.mutate({ lista, pago_em: hojeISO() }) },
              podeEditar && { id: "retornar", label: "Retornar", icon: Undo2Icon, applies: (l) => !!l.pago_em, run: (lista) => pagar.mutate({ lista, pago_em: null }) },
              podeEditar && { id: "editar", label: "Editar", icon: PencilIcon, unico: true, run: ([l]) => setForm({ tipo: l.tipo, lancamento: l }) },
              podeExcluir && { id: "excluir", label: "Excluir", icon: Trash2Icon, destructive: true, run: (lista) => setExcluir(lista) },
            ]}
            rows={pager.rows}
            rowKey={(l) => String(l.id)}
            onOpen={podeEditar ? (l) => setForm({ tipo: l.tipo, lancamento: l }) : undefined}
            openLabel={(l) => `Abrir ${l.descricao}`}
            scrollKey={pager.page}
            empty={
              busca || situacao || categoria ? (
                <EstadoVazio compact icon={<SearchXIcon />} title="Nada com esses filtros" />
              ) : (
                <EstadoVazio compact icon={<ReceiptTextIcon />} title={`Nada em ${nomeMes(mes)}`} description="Troque o mês na faixa ou adicione um lançamento." />
              )
            }
          />
          <Pagination pager={pager} total={filtrados.length} />
          <StatsLine
            label="Números do financeiro"
            items={[item("aberto", "Em aberto"), item("atrasado", "Atrasadas"), item("pago", "Pagas")]}
            summary={
              pagina === "extrato"
                ? [
                    { id: "r", label: "Receitas", value: dinheiro(receita) },
                    { id: "d", label: "Despesas", value: dinheiro(despesa) },
                    { id: "s", label: "Saldo", value: dinheiro(receita - despesa) },
                  ]
                : [{ id: "t", label: "Total do mês", value: dinheiro(receita + despesa) }]
            }
          />
        </>
      )}
      <PainelFiltro aberto={filtroAberto} onClose={() => setFiltroAberto(false)} mostrando={filtrados.length} total={doTipo.length} onLimpar={limpar}>
        <FormField label="Busca" htmlFor="fi-busca">
          <Input id="fi-busca" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código, descrição, cliente ou operação" />
        </FormField>
        <FormField label="Situação">
          <Escolha value={situacao} onChange={setSituacao} vazio="Todas" options={[{ value: "aberto", label: "Em aberto" }, { value: "atrasado", label: "Atrasadas" }, { value: "pago", label: "Pagas" }]} />
        </FormField>
        <FormField label="Categoria">
          <Escolha value={categoria} onChange={setCategoria} vazio="Todas" options={(consulta.data?.categorias ?? []).map((c) => ({ value: c, label: c }))} />
        </FormField>
      </PainelFiltro>
      {form && <LancamentoForm tipo={form.tipo} lancamento={form.lancamento} categorias={consulta.data?.categorias ?? []} onClose={() => setForm(null)} onSaved={atualizar} />}
      <ConfirmDialog
        open={!!excluir}
        onOpenChange={(o) => !o && setExcluir(null)}
        title={excluir?.length === 1 ? "Excluir lançamento?" : `Excluir ${excluir?.length} lançamentos?`}
        description={excluir?.length === 1 ? `${excluir[0].codigo} ${excluir[0].descricao} sai do financeiro.` : "Os lançamentos marcados saem do financeiro."}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => excluir && apagar.mutate(excluir)}
      />
    </div>
  );
}

// "1.234,56" → 123456
function paraCentavos(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Math.round(Number(limpo) * 100);
}

function LancamentoForm({
  tipo,
  lancamento: l,
  categorias,
  onClose,
  onSaved,
}: {
  tipo: TipoLancamento;
  lancamento: Lancamento | null;
  categorias: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const eu = useUsuario();
  const [d, setD] = useState({
    descricao: l?.descricao ?? "",
    categoria: l?.categoria ?? "",
    valor: l ? (l.valor_centavos / 100).toFixed(2).replace(".", ",") : "",
    vencimento: l?.vencimento ?? hojeISO(),
    pago_em: l?.pago_em ?? "",
    operacao_id: l?.operacao_id ? String(l.operacao_id) : "",
    observacao: l?.observacao ?? "",
  });
  const [erro, setErro] = useState("");
  const ops = useQuery({ queryKey: ["operacoes"], queryFn: () => api<{ operacoes: Operacao[] }>("/operacoes") });
  const nome = tipo === "receita" ? "receita" : "despesa";
  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { tipo, descricao: d.descricao, categoria: d.categoria, valor_centavos: paraCentavos(d.valor), vencimento: d.vencimento, pago_em: d.pago_em || null, operacao_id: d.operacao_id ? Number(d.operacao_id) : null, observacao: d.observacao };
      return l ? api(`/financeiro/lancamentos/${l.id}`, { metodo: "PUT", corpo }) : api("/financeiro/lancamentos", { corpo });
    },
    onSuccess: async () => {
      toast.success(l ? "Lançamento salvo." : `${tipo === "receita" ? "Receita" : "Despesa"} adicionada.`);
      await onSaved();
      onClose();
    },
    onError: (e) => setErro((e as Error).message),
  });
  const muda = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }));
  return (
    <FormPage
      title={l ? `Editar ${nome}` : `Nova ${nome}`}
      status={l?.codigo}
      onBack={onClose}
      onSubmit={() => {
        if (!d.descricao.trim()) return setErro("Preencha a descrição.");
        if (!(paraCentavos(d.valor) > 0)) return setErro("Informe o valor.");
        if (!eu.admin && !d.operacao_id) return setErro("Escolha uma das suas operações.");
        setErro("");
        salvar.mutate();
      }}
      busy={salvar.isPending}
      footerNote={erro && <span className="text-destructive">{erro}</span>}
    >
      <FormSection title="Lançamento" columns={2}>
        <FormField label="Descrição" htmlFor="la-desc" required span="full">
          <Input id="la-desc" autoFocus value={d.descricao} onChange={muda("descricao")} maxLength={160} />
        </FormField>
        <FormField label="Valor (R$)" htmlFor="la-valor" required>
          <Input id="la-valor" inputMode="decimal" value={d.valor} onChange={muda("valor")} placeholder="0,00" />
        </FormField>
        <FormField label="Categoria" htmlFor="la-cat">
          <Input id="la-cat" list="la-cats" value={d.categoria} onChange={muda("categoria")} maxLength={60} />
          <datalist id="la-cats">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Vencimento" htmlFor="la-venc" required>
          <Input id="la-venc" type="date" value={d.vencimento} onChange={muda("vencimento")} />
        </FormField>
        <FormField label={tipo === "receita" ? "Recebido em" : "Pago em"} htmlFor="la-pago">
          <Input id="la-pago" type="date" value={d.pago_em} onChange={muda("pago_em")} />
        </FormField>
      </FormSection>
      <FormSection title="Ligação" columns={1}>
        <FormField label="Operação" required={!eu.admin} help={eu.admin ? "Sem operação, é um lançamento da empresa: só o administrador vê." : undefined}>
          <Escolha
            value={d.operacao_id}
            onChange={(v) => setD((x) => ({ ...x, operacao_id: v }))}
            vazio={eu.admin ? "Empresa (sem operação)" : undefined}
            placeholder="Escolha a operação"
            options={(ops.data?.operacoes ?? []).map((o) => ({ value: String(o.id), label: `${o.codigo} · ${o.cliente_nome} · ${o.nome}` }))}
          />
        </FormField>
      </FormSection>
      <FormSection title="Observação" columns={1}>
        <FormField>
          <Textarea value={d.observacao} onChange={muda("observacao")} maxLength={500} placeholder="Opcional" aria-label="Observação" />
        </FormField>
      </FormSection>
    </FormPage>
  );
}
