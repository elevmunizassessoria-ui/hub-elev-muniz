import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownIcon, ArrowUpIcon, FileStackIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FormField, FormPage, FormSection, Marcar, YesNo } from "@/components/FormPage";
import { ReportTable, type ReportColumn } from "@/components/ReportTable";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useFerramentas } from "@/app/faixa";
import { useMigalhas } from "@/app/migalhas";
import { usePode } from "@/app/sessao";
import { api } from "@/lib/api";
import { plural } from "@/lib/formato";
import type { PerfilDocumento, TipoDocumento } from "@/lib/tipos";

const ETAPAS_INICIAIS = [
  { nome: "Documentação", prazo_dias: 5 },
  { nome: "Análise", prazo_dias: 3 },
  { nome: "Em andamento", prazo_dias: 15 },
  { nome: "Concluída", prazo_dias: 0 },
];

/**
 * Predefinições de operação: etapas, prazos e documentos de cada tipo de operação. Antes "perfis de documentos": a lista de documentos de cada tipo de operação. Os documentos
 * são digitados livres aqui mesmo. Ao criar a operação de um cliente, o perfil vira a lista dela.
 */
export function PerfisDocumentoView() {
  useMigalhas([{ label: "Operações", caminho: "/operacoes" }, { label: "Predefinições" }]);
  const qc = useQueryClient();
  const podeEditar = usePode("cadastro_documentos", "editar");
  const podeExcluir = usePode("cadastro_documentos", "excluir");
  const [form, setForm] = useState<{ perfil: PerfilDocumento | null } | null>(null);
  const [excluir, setExcluir] = useState<PerfilDocumento | null>(null);
  const consulta = useQuery({ queryKey: ["perfis-documento"], queryFn: () => api<{ perfis: PerfilDocumento[] }>("/perfis-documento") });
  const perfis = consulta.data?.perfis ?? [];

  const apagar = useMutation({
    mutationFn: (p: PerfilDocumento) => api(`/perfis-documento/${p.id}`, { metodo: "DELETE" }),
    onSuccess: async () => {
      toast.success("Predefinição excluída.");
      await qc.invalidateQueries({ queryKey: ["perfis-documento"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useFerramentas(podeEditar ? [{ titulo: "Adicionar", ferramentas: [{ id: "nova", label: "Adicionar predefinição", icon: PlusIcon, tom: "cinza", run: () => setForm({ perfil: null }) }] }] : []);

  const colunas: ReportColumn<PerfilDocumento>[] = [
    {
      id: "nome",
      header: "Predefinição",
      primary: true,
      cell: (p) => (
        <span className="truncate">
          <span className="font-medium">{p.nome}</span>
          {p.descricao && <span className="text-muted-foreground"> · {p.descricao}</span>}
        </span>
      ),
    },
    {
      id: "etapas",
      header: "Etapas e prazo total",
      width: "13rem",
      cell: (p) => `${plural(p.etapas.length, "etapa", "etapas")} · ${p.etapas.reduce((t, e) => t + e.prazo_dias, 0)} dias`,
    },
    {
      id: "docs",
      header: "Documentos",
      width: "15rem",
      cell: (p) => (
        <span>
          {plural(p.itens.length, "documento", "documentos")} <span className="text-muted-foreground">· {p.itens.filter((i) => i.obrigatorio).length} obrigatórios</span>
        </span>
      ),
    },
    { id: "operacoes", header: "Operações usando", width: "10rem", type: "number", cell: (p) => p.operacoes },
    { id: "situacao", header: "Situação", width: "8rem", cell: (p) => (p.ativo ? <StatusPill tone="concluido">Ativo</StatusPill> : <StatusPill tone="neutro">Inativo</StatusPill>) },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
        {consulta.isPending ? (
          <Skeleton className="m-4 h-40" />
        ) : (
          <ReportTable
            label="Predefinições de operação"
            columns={colunas}
            bulk={[
              podeEditar && { id: "editar", label: "Editar predefinição", icon: PencilIcon, unico: true, run: ([p]) => setForm({ perfil: p }) },
              podeExcluir && { id: "excluir", label: "Excluir", icon: Trash2Icon, destructive: true, unico: true, run: ([p]) => setExcluir(p) },
            ]}
            rows={perfis}
            rowKey={(p) => String(p.id)}
            onOpen={podeEditar ? (p) => setForm({ perfil: p }) : undefined}
            openLabel={(p) => `Editar ${p.nome}`}
            empty={
              <EstadoVazio
                compact
                icon={<FileStackIcon />}
                title="Nenhuma predefinição"
                description="Crie uma para cada tipo de operação: etapas, prazos e documentos."
                action={
                  podeEditar && (
                    <Button onClick={() => setForm({ perfil: null })}>
                      <PlusIcon data-icon="inline-start" />
                      Adicionar predefinição
                    </Button>
                  )
                }
              />
            }
          />
        )}
      {form && <PerfilForm perfil={form.perfil} onClose={() => setForm(null)} />}
      <ConfirmDialog
        open={!!excluir}
        onOpenChange={(o) => !o && setExcluir(null)}
        title="Excluir predefinição?"
        description={`"${excluir?.nome}" sai da lista. As operações criadas com ele continuam com os documentos delas.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => excluir && apagar.mutate(excluir)}
      />
    </div>
  );
}

/** Um documento digitado livre: nome + Enter (ou Acrescentar). Sugere os que já existem. */
export function CampoNovoDocumento({ sugestoes, onAcrescentar, id }: { sugestoes: string[]; onAcrescentar: (nome: string) => void; id: string }) {
  const [nome, setNome] = useState("");
  const acrescentar = () => {
    if (!nome.trim()) return;
    onAcrescentar(nome.trim());
    setNome("");
  };
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        value={nome}
        list={`${id}-lista`}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            acrescentar();
          }
        }}
        maxLength={120}
        placeholder="Digite o nome do documento. Ex.: Alvará de funcionamento"
        className="h-9"
      />
      <datalist id={`${id}-lista`}>
        {sugestoes.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <Button type="button" variant="outline" className="h-9 shrink-0" disabled={!nome.trim()} onClick={acrescentar}>
        <PlusIcon data-icon="inline-start" />
        Acrescentar
      </Button>
    </div>
  );
}

interface ItemForm {
  chave: string;
  tipo_id: number | null;
  nome: string;
  obrigatorio: boolean;
  frente_verso: boolean;
  exige_validade: boolean;
}

function PerfilForm({ perfil, onClose }: { perfil: PerfilDocumento | null; onClose: () => void }) {
  const qc = useQueryClient();
  const tipos = useQuery({ queryKey: ["tipos-documento"], queryFn: () => api<{ tipos: TipoDocumento[] }>("/tipos-documento") });
  const [nome, setNome] = useState(perfil?.nome ?? "");
  const [descricao, setDescricao] = useState(perfil?.descricao ?? "");
  const [ativo, setAtivo] = useState(perfil?.ativo ?? true);
  const [itens, setItens] = useState<ItemForm[]>(() =>
    (perfil?.itens ?? []).map((i) => ({
      chave: `t${i.tipo_id}`,
      tipo_id: i.tipo_id,
      nome: i.nome,
      obrigatorio: i.obrigatorio,
      frente_verso: i.frente_verso,
      exige_validade: i.exige_validade,
    })),
  );
  const [etapas, setEtapas] = useState<{ chave: number; nome: string; prazo_dias: string }[]>(() =>
    (perfil?.etapas.length ? perfil.etapas : ETAPAS_INICIAIS).map((e, chave) => ({ chave, nome: e.nome, prazo_dias: String(e.prazo_dias) })),
  );
  const [erro, setErro] = useState("");
  const mudarEtapa = (chave: number, campos: Partial<{ nome: string; prazo_dias: string }>) => setEtapas((l) => l.map((e) => (e.chave === chave ? { ...e, ...campos } : e)));
  const moverEtapa = (i: number, delta: number) =>
    setEtapas((l) => {
      const n = [...l];
      const [e] = n.splice(i, 1);
      n.splice(i + delta, 0, e);
      return n;
    });

  const usados = new Set(itens.map((i) => i.nome.toLowerCase()));
  const sugestoes = (tipos.data?.tipos ?? []).map((t) => t.nome).filter((n) => !usados.has(n.toLowerCase()));

  const acrescentar = (texto: string) => {
    if (usados.has(texto.toLowerCase())) {
      toast.info(`"${texto}" já está na lista.`);
      return;
    }
    const existente = (tipos.data?.tipos ?? []).find((t) => t.nome.toLowerCase() === texto.toLowerCase());
    setItens((l) => [
      ...l,
      existente
        ? { chave: `t${existente.id}`, tipo_id: existente.id, nome: existente.nome, obrigatorio: true, frente_verso: existente.frente_verso, exige_validade: existente.exige_validade }
        : { chave: `n${Date.now()}`, tipo_id: null, nome: texto, obrigatorio: true, frente_verso: false, exige_validade: false },
    ]);
  };
  const mudar = (chave: string, campos: Partial<ItemForm>) => setItens((l) => l.map((i) => (i.chave === chave ? { ...i, ...campos } : i)));

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { nome, descricao, ativo, itens: itens.map(({ chave: _chave, ...i }) => i), etapas: etapas.map((e) => ({ nome: e.nome, prazo_dias: Number(e.prazo_dias) || 0 })) };
      return perfil ? api(`/perfis-documento/${perfil.id}`, { metodo: "PUT", corpo }) : api("/perfis-documento", { corpo });
    },
    onSuccess: async () => {
      toast.success(perfil ? "Predefinição salva." : "Predefinição criada.");
      await qc.invalidateQueries({ queryKey: ["perfis-documento"] });
      await qc.invalidateQueries({ queryKey: ["tipos-documento"] });
      onClose();
    },
    onError: (e) => setErro((e as Error).message),
  });

  return (
    <FormPage
      title={perfil ? perfil.nome : "Nova predefinição de operação"}
      status={`${plural(itens.length, "documento", "documentos")} · ${itens.filter((i) => i.obrigatorio).length} obrigatórios`}
      onBack={onClose}
      onSubmit={() => {
        if (!nome.trim()) return setErro("Escreva o nome da predefinição.");
        if (etapas.length < 2 || etapas.some((e) => !e.nome.trim())) return setErro("A predefinição precisa de pelo menos duas etapas com nome.");
        if (itens.length === 0) return setErro("Acrescente pelo menos um documento.");
        setErro("");
        salvar.mutate();
      }}
      busy={salvar.isPending}
      footerNote={
        erro ? <span className="text-destructive">{erro}</span> : perfil && perfil.operacoes > 0 ? "Operações já criadas não mudam." : undefined
      }
    >
      <FormSection title="Predefinição" columns={3}>
        <FormField label="Nome" htmlFor="pd-nome" required span={2} help="O tipo de operação.">
          <Input id="pd-nome" autoFocus={!perfil} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} placeholder="Ex.: Operação portuária" />
        </FormField>
        <FormField label="Ativa">
          <YesNo label="Ativa" value={ativo} onChange={setAtivo} />
        </FormField>
        <FormField label="Descrição" htmlFor="pd-desc" span="full">
          <Textarea id="pd-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={300} placeholder="Opcional" />
        </FormField>
      </FormSection>

      <FormSection title="Etapas e prazos" bodyClassName="flex flex-col gap-2">
        {etapas.map((e, i) => {
          const ultima = i === etapas.length - 1;
          return (
            <div key={e.chave} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <Input aria-label={`Nome da etapa ${i + 1}`} value={e.nome} onChange={(ev) => mudarEtapa(e.chave, { nome: ev.target.value })} maxLength={80} placeholder="Nome da etapa" />
              {ultima ? (
                <span className="w-28 shrink-0 text-center text-xs text-muted-foreground">Encerra</span>
              ) : (
                <label className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Input aria-label={`Prazo da etapa ${i + 1} em dias`} type="number" min={0} value={e.prazo_dias} onChange={(ev) => mudarEtapa(e.chave, { prazo_dias: ev.target.value })} className="w-16" />
                  dias
                </label>
              )}
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => moverEtapa(i, -1)}>
                <ArrowUpIcon />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Descer" disabled={ultima} onClick={() => moverEtapa(i, 1)}>
                <ArrowDownIcon />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label="Tirar etapa" disabled={etapas.length <= 2} onClick={() => setEtapas((l) => l.filter((x) => x.chave !== e.chave))}>
                <Trash2Icon />
              </Button>
            </div>
          );
        })}
        <button type="button" className="self-start text-[13px] text-primary-ink hover:underline" onClick={() => setEtapas((l) => [...l.slice(0, -1), { chave: Date.now(), nome: "", prazo_dias: "5" }, ...l.slice(-1)])}>
          + Adicionar etapa
        </button>
        <p className="text-xs text-muted-foreground">O prazo é contado em dias corridos e mede o SLA. A última etapa encerra a operação.</p>
      </FormSection>

      <FormSection title={`Documentos (${itens.length})`} bodyClassName="">
        <div className="pb-3">
          <CampoNovoDocumento id="pd-novo" sugestoes={sugestoes} onAcrescentar={acrescentar} />
          <p className="mt-1.5 text-xs text-muted-foreground">Escreva o nome que quiser e aperte Enter. Se já existir um documento com esse nome, ele é reaproveitado.</p>
        </div>
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Digite o nome do primeiro documento que este tipo de operação exige.</p>
        ) : (
          <ol>
            {itens.map((i, n) => (
              <li key={i.chave} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t py-2">
                <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{n + 1}</span>
                <span className="min-w-0 flex-1 basis-40 text-sm font-medium">
                  {i.nome}
                  {!i.tipo_id && <span className="ml-2 text-xs font-normal text-primary-text">novo</span>}
                </span>
                <Marcar checked={i.obrigatorio} onChange={(v) => mudar(i.chave, { obrigatorio: v })}>
                  Obrigatório
                </Marcar>
                <Marcar checked={i.frente_verso} onChange={(v) => mudar(i.chave, { frente_verso: v })}>
                  Frente e verso
                </Marcar>
                <Marcar checked={i.exige_validade} onChange={(v) => mudar(i.chave, { exige_validade: v })}>
                  Tem validade
                </Marcar>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Tirar ${i.nome}`}
                  title="Tirar da lista"
                  onClick={() => setItens((l) => l.filter((x) => x.chave !== i.chave))}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </FormSection>
    </FormPage>
  );
}
