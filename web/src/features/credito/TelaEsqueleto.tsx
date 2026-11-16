import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PlusIcon, SearchXIcon, type LucideIcon } from "lucide-react";

import { Escolha } from "@/components/Escolha";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FormField, FormPage, FormSection } from "@/components/FormPage";
import { PainelFiltro, ferramentaFiltro } from "@/components/PainelFiltro";
import { Pagination, usePagination } from "@/components/Pagination";
import { ReportTable, type ReportColumn } from "@/components/ReportTable";
import { StatsLine } from "@/components/StatsLine";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFerramentas } from "@/app/faixa";
import { useMigalhas, type Migalha } from "@/app/migalhas";
import { normalizar } from "@/lib/formato";

/** Telas de crédito em esqueleto: visual pronto, dados fictícios, nada grava ainda. */
export const avisoEsqueleto = () => toast.info("Tela de demonstração: esta ação será ligada ao banco de dados na próxima etapa.");

export function FaixaDemonstracao() {
  return <p className="shrink-0 border-b bg-amber-500/[0.10] px-4 py-1 text-xs text-amber-700 dark:text-amber-300">Tela de demonstração: dados fictícios. Ainda não grava nem está ligada ao banco de dados.</p>;
}

export interface CampoEsqueleto {
  label: string;
  tipo?: "texto" | "data" | "numero" | "area";
  opcoes?: string[];
  required?: boolean;
  inteiro?: boolean;
}

export interface FormEsqueleto {
  /** "Adicionar proposta" na faixa, "Nova proposta" no painel. */
  acao: string;
  titulo: string;
  secoes: { titulo: string; campos: CampoEsqueleto[] }[];
}

export function TelaEsqueleto<T>({
  migalhas,
  rotulo,
  colunas,
  linhas,
  chave,
  situacao,
  textoBusca,
  form,
  acoes = [],
  vazio,
}: {
  migalhas: Migalha[];
  rotulo: string;
  colunas: ReportColumn<T>[];
  linhas: T[];
  chave: (l: T) => string;
  /** A situação da linha: vira as contagens da barra de baixo e o filtro. */
  situacao?: (l: T) => string;
  textoBusca: (l: T) => string;
  form?: FormEsqueleto;
  /** O que aparece na faixa ao marcar uma linha. */
  acoes?: { id: string; label: string; icon: LucideIcon; main?: boolean; destructive?: boolean; varias?: boolean }[];
  vazio?: ReactNode;
}) {
  useMigalhas(migalhas);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [novo, setNovo] = useState(false);
  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return linhas.filter((l) => (!filtro || situacao?.(l) === filtro) && (!termo || normalizar(textoBusca(l)).includes(termo)));
  }, [linhas, busca, filtro, situacao, textoBusca]);
  const pager = usePagination(filtradas, `${busca}|${filtro}`, rotulo);
  const situacoes = situacao ? [...new Set(linhas.map(situacao))] : [];

  useFerramentas([
    { titulo: "Filtrar", ferramentas: [ferramentaFiltro(() => setFiltroAberto(true), [busca.trim(), filtro].filter(Boolean).length)] },
    ...(form ? [{ titulo: "Adicionar", ferramentas: [{ id: "add", label: form.acao, icon: PlusIcon, tom: "cinza" as const, run: () => setNovo(true) }] }] : []),
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <FaixaDemonstracao />
      <ReportTable
        label={rotulo}
        columns={colunas}
        rows={pager.rows}
        rowKey={chave}
        scrollKey={pager.page}
        bulk={acoes.map((a) => ({ id: a.id, label: a.label, icon: a.icon, main: a.main, destructive: a.destructive, unico: !a.varias, run: avisoEsqueleto }))}
        empty={vazio ?? <EstadoVazio compact icon={<SearchXIcon />} title="Nada com esses filtros" />}
      />
      <Pagination pager={pager} total={filtradas.length} />
      {situacao && (
        <StatsLine
          label={`Números de ${rotulo}`}
          items={situacoes.map((s) => ({ id: s, label: s, value: linhas.filter((l) => situacao(l) === s).length, pressed: filtro === s, onClick: () => setFiltro(filtro === s ? "" : s) }))}
        />
      )}
      <PainelFiltro aberto={filtroAberto} onClose={() => setFiltroAberto(false)} mostrando={filtradas.length} total={linhas.length} onLimpar={() => { setBusca(""); setFiltro(""); }}>
        <FormField label="Busca" htmlFor="esq-busca">
          <Input id="esq-busca" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite para buscar" />
        </FormField>
        {situacao && (
          <FormField label="Situação">
            <Escolha value={filtro} onChange={setFiltro} vazio="Todas" options={situacoes.map((s) => ({ value: s, label: s }))} />
          </FormField>
        )}
      </PainelFiltro>
      {novo && form && <PainelEsqueleto form={form} onClose={() => setNovo(false)} />}
    </div>
  );
}

function PainelEsqueleto({ form, onClose }: { form: FormEsqueleto; onClose: () => void }) {
  return (
    <FormPage
      title={form.titulo}
      onBack={onClose}
      footerNote="Demonstração: ainda não grava."
      onSubmit={() => {
        avisoEsqueleto();
        onClose();
      }}
    >
      {form.secoes.map((s) => (
        <FormSection key={s.titulo} title={s.titulo} columns={2}>
          {s.campos.map((c) => (
            <FormField key={c.label} label={c.label} required={c.required} span={c.tipo === "area" || c.inteiro ? "full" : 1}>
              {c.opcoes ? (
                <EscolhaLivre opcoes={c.opcoes} />
              ) : c.tipo === "area" ? (
                <Textarea aria-label={c.label} placeholder="Opcional" />
              ) : (
                <Input aria-label={c.label} type={c.tipo === "data" ? "date" : "text"} inputMode={c.tipo === "numero" ? "decimal" : undefined} />
              )}
            </FormField>
          ))}
        </FormSection>
      ))}
    </FormPage>
  );
}

function EscolhaLivre({ opcoes }: { opcoes: string[] }) {
  const [v, setV] = useState("");
  return <Escolha value={v} onChange={setV} placeholder="Escolha" options={opcoes.map((o) => ({ value: o, label: o }))} />;
}
